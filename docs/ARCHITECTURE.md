# Privacy IA — Arquitetura observada

## Escopo e confiabilidade

Snapshot estático do HEAD `01db327845467726420dca8ac2cc8217c1f8167d`. A arquitetura abaixo foi derivada de entrypoints, rotas, controllers, services, validators, filas, workers, frontend e SQL local.

Este documento **não** confirma deploy, secrets, migrations aplicadas, dados reais, jobs externos, qualidade de modelo ou homologação. Para estado e gates, consultar `ROADMAP_STATE.md` e `PRODUCTION_GATES.md`.

## Visão geral

```text
Browser React
  ├─ Supabase Auth (somente fluxos autorizados de autenticação)
  └─ Axios + Bearer JWT
          │
          ▼
Express HTTP
  ├─ auth/role middlewares
  ├─ controllers → services → Supabase/PostgreSQL
  ├─ OpenRouter (chat/embeddings)
  ├─ R2 (mídia pública e privada)
  └─ BullMQ → Redis → workers isolados
                         ├─ RunPod imagem
                         ├─ RunPod Wan I2V/V2V
                         ├─ RunPod Qwen3-TTS
                         └─ FFmpeg/FFprobe renditions

PIR/runtime e model bundles: outro repositório / infraestrutura externa
```

## Frontend

### Stack e bootstrap

- React 19 + TypeScript + Vite em `frontend/`;
- Tailwind 4 via plugin Vite;
- TanStack Query em `app/providers.tsx`;
- Axios centralizado em `shared/lib/axios.ts`;
- Zustand com persistência em `sessionStorage` para token e usuário;
- Zod para ambiente e formulários/contratos;
- MSW apenas quando `DEV` e `VITE_ENABLE_MSW=true`.

O bootstrap é `src/main.tsx` → `App` → `Providers` → `Router`.

### Navegação e superfícies

`app/router.tsx` define três áreas por role:

- Cliente (`cliente`): `/cliente/*`, com feed, descobrir, notificações, chat, galeria, geração, carteira, perfil e perfil de Atriz;
- Atriz (`atriz`): `/atriz/*`, com dashboard, mapeamento, produtos, financeiro, notificações, configurações e suporte;
- Admin (`adm`): `/adm`, cuja página agrega os painéis administrativos.

O onboarding de Ator por convite é público em `/atores/onboarding/:inviteToken`. Landing, login, cadastro e recuperação de senha também são públicos.

Incerteza observada: `ResetPassword.tsx` existe e o e-mail aponta para `/reset-password`, mas essa rota não está registrada em `app/router.tsx`. Estado de homologação: `REQUIRES_HUMAN_CONTEXT`.

### Comunicação e sessão

As chamadas funcionais usam `VITE_API_URL`. O interceptor Axios acrescenta `Authorization: Bearer <token>` a partir do Zustand. O route guard do browser melhora UX, mas a autorização real é do backend.

O cliente Supabase do browser é usado em login por sessão OAuth, reset de senha, atualização de senha e logout do fluxo de recuperação. Cadastro e login por e-mail/senha usuais passam pelo backend.

Há fallbacks e mocks de Atrizes/dados. Eles não provam dados reais nem devem ser interpretados como catálogo homologado.

## Backend HTTP

### Stack e entrypoint

- Node.js 22, ESM e Express 4 em `backend/`;
- `src/server.js` cria o app e escuta `PORT`;
- `src/app.js` instala Helmet, CORS, JSON, Morgan, rotas e middlewares de erro;
- controllers recebem HTTP, validators normalizam entrada e services concentram acesso a dados/integrações.

Swagger/OpenAPI existe, porém só é montado com `ENABLE_SWAGGER=true` para reduzir exposição de informação.

### Rotas e fronteiras de acesso

Rotas públicas: health, login/cadastro, onboarding por convite e playback tokenizado. Rotas Cliente/Atriz usam `authMiddleware`. Rotas administrativas adicionais são montadas com `authMiddleware` + `adminMiddleware`.

O `authMiddleware`:

1. exige Bearer token;
2. valida o token com Supabase Auth;
3. carrega `profiles`;
4. anexa usuário e perfil a `req.auth`.

O `adminMiddleware` faz a checagem de role no servidor. Portanto a proteção de rota React não é fronteira de segurança.

## Banco e Supabase

O backend usa dois clientes sem sessão persistida:

- `supabaseAuth`, com anon key, para autenticação de usuário;
- `supabaseAdmin`, com service-role, para Auth admin e consultas/mutações da aplicação.

Domínios observados por services/SQL incluem:

- autenticação/perfis: `profiles`;
- Cliente/personagem: `companions`, subscriptions, conversations, messages, memories, feed, gallery e notifications;
- financeiro: `credit_ledger`, `credit_packages`, `payment_methods`, `payment_transactions`;
- Fábrica: combinations, batches, batch items, variants, assets, renditions e deliveries;
- Ator/compliance: actor profiles, invites, KYC cases/assets, payout requests e authorizations;
- identidade: training runs e adapters;
- direção/inteligência: base scenes, scene directions, product splits, mapping requirements, prompt dictionaries e audio storylines.

Os arquivos de `backend/src/db/sql` são patches SQL locais. Não existe runner de migrations no `package.json`, e nenhuma leitura remota foi feita nesta auditoria. O schema efetivamente implantado é `REQUIRES_HUMAN_CONTEXT`.

## Processamento assíncrono

### Filas

As filas BullMQ são:

| Fila | Jobs principais | Responsabilidade |
| --- | --- | --- |
| `media:image` | dry-run, imagem real, stage do Ator | imagem/Fábrica |
| `media:video-short` | scene direction | vídeo curto/I2V |
| `media:video-v2v` | scene direction | V2V/Live Action |
| `media:audio` | Live Audio | TTS/produto de áudio |
| `media:rendition` | preview/HLS/stream | derivados privados |

Aliases em `queues/names.js` preservam compatibilidade; não criam filas adicionais.

### Workers

`src/all-workers.js` e `src/rendition-worker.js` são processos independentes do HTTP. Por padrão, `WORKERS_ENABLED=false`; rendition também exige `RENDITION_QUEUE_ENABLED=true`. Em desenvolvimento, Redis externo é bloqueado sem `ALLOW_EXTERNAL_REDIS_WORKERS=true`.

O runtime standalone valida FFmpeg/FFprobe quando necessário, trata sinais e fecha workers, filas e Redis com graceful shutdown.

## Motores e integrações de IA

### OpenRouter

`openrouter.service.js` implementa respostas de chat, streaming e embeddings, com modelos configuráveis, timeout, fallbacks e filtros. Sem API key, os caminhos retornam fallback/indisponibilidade conforme o serviço; nenhuma chamada foi executada nesta auditoria.

### RunPod

`services/providers/runpod.provider.js` encapsula submit, status, polling, timeout e cancelamento. Há endpoints separados para imagem, vídeo e áudio; identidade usa seu próprio contrato de dispatch para endpoint trainer.

O provider confirma wiring para:

- imagem;
- vídeo Wan I2V/V2V;
- Qwen3-TTS/CosyVoice;
- healthchecks operacionais.

Telemetria, custo e leases estão em services separados. Endpoints reais, containers implantados e outputs válidos não são comprovados.

### PIR

PIR não está implementado neste repositório. Runtime, bundles, GPU e políticas de memória pertencem a `privacy-pir-repo`/infraestrutura externa. A fronteira de integração exata entre a versão atual do PIR e este backend é `REQUIRES_HUMAN_CONTEXT`.

## Identidade, KYC e LoRA

O fluxo local é:

```text
actor_profile
  → convite/onboarding
  → KYC case + mapping assets privados
  → aprovação e avatar_production_authorization
  → autorização de preparação de identidade
  → auditoria/registro do dataset
  → readiness dry-run
  → preflight controlado
  → treinamento controlado (gate fechado)
  → adapter privado em QA
  → preview + auditorias forense/alvo
  → aprovação/rejeição
  → gate de produção por conteúdo
```

O contrato v2 de treino compila 800 optimizer steps com checkpoints 400, 600 e 800. Base model, revision, fingerprint, engine commit, bucket privado, escopo one-shot e janela temporal são parte do gate. A injeção em inferência permanece desligada por padrão.

O SQL local exige checksum, storage privado, QA aprovado e unicidade do adapter ativo. Isso é contrato preparado; não há comprovação local de training run ou adapter real aprovado.

## Pipelines de mídia

### Imagem Cliente

O pedido resolve companion autorizado, preço, opções e identidade; cria job/registro, debita créditos e enfileira uma produção canônica. Em falha de enqueue, tenta estorno. O resultado deve permanecer privado e em QA antes de entrega/publicação.

Esse caminho só abre com worker/queue e endpoint RunPod configurados. A presença da rota `/nsfw/imagem/gerar` não confirma que o gate esteja aberto.

### Vídeo, I2V e V2V

I2V usa imagem de referência e não aceita cena base. V2V exige cena base privada e passa por scene direction/casting. A identidade aprovada é exigida para vídeo, short video e Live Action. As filas de vídeo são isoladas e o provider compila contrato Wan.

### Live Action

É representado como V2V no pipeline de Ator e como renderer protegido de vídeo no Cliente. A UI só abre conteúdo quando o contrato declara `clientOpenable` e existe `protectedViewUrl`. A própria matriz Admin manda mantê-lo bloqueado até renderer protegido homologado.

### Live Audio e TTS

O pipeline do Ator cria combination, batch e items `live_audio`, enfileira `audio.live.item`, gera TTS e registra asset/master para QA. O Cliente usa delivery e player protegido.

Separadamente, áudio de mensagens do chat chama RunPod Qwen3-TTS e usa `uploadAudioBuffer`, que segue o caminho público baseado em `R2_PUBLIC_BASE_URL`. A política e homologação desse caminho público de áudio de chat são `REQUIRES_HUMAN_CONTEXT`; ele não deve ser generalizado para KYC, adapters, masters ou produtos protegidos.

## Storage, proteção e delivery

`storage.service.js` oferece primitives públicas e privadas do R2. Os fluxos sensíveis usam bucket/key, cache `private, no-store`, URLs assinadas curtas ou proxy.

O ciclo de mídia protegida é:

```text
master privado → rendition privada → QA → asset available
→ preço/visibilidade/publicação → purchase/claim atômico
→ user_media_delivery → token/descriptor temporário
→ proxy protegido ou HLS/rendition
```

O backend verifica ownership do delivery, status do asset, media contract e rendition. Tokens de playback têm assinatura, profile, escopo, resource e TTL limitado.

Há referências a RPCs `claim_media_asset_without_credits` e `claim_media_asset_with_universal_credits`, mas os SQLs `20260617_*` indicados pelas mensagens de erro não estão na árvore atual. O estado desses RPCs no Supabase é `REQUIRES_HUMAN_CONTEXT`.

## Fábrica, Admin e QA

A Fábrica administra conteúdo guiado, combinations, batches, items, assets, pricing, estoque, deliveries e publicação. Existem caminhos distintos para preview/dry-run, produção real controlada, auditoria, watchdog, QA e release.

QA transforma `qa_pending` em `available` ou `rejected`. Publicação é outra decisão: combina status aprovado, preço, estoque, visibility e contrato do renderer. Admin não deve tratar `available` como automaticamente publicado.

O frontend Admin concentra muitos painéis em `AdmDashboard.tsx`, um arquivo historicamente grande. Sua dimensão não autoriza refatoração fora de tarefa própria.

## Financeiro

O código local contém:

- consulta de saldo/histórico/pacotes/métodos;
- adição de método;
- compra de créditos com mutação de `profiles`, ledger e payment transaction;
- débito/refund atômico por RPC com fallback otimista;
- claim pago de mídia por RPC;
- pricing comercial, splits e estimativas de repasse;
- relatórios de vendas, margem e payout.

Não foi encontrada comprovação de gateway externo liquidando pagamento ou payout. Relatórios de repasse são estimativos/operacionais; executar mutações financeiras requer autorização humana explícita.

## Lacunas de integração observadas

- `ResetPassword` não está registrado no router: `REQUIRES_HUMAN_CONTEXT`.
- Alguns módulos frontend ainda chamam `/atriz/painel/*`, enquanto as rotas backend locais do Ator estão sob `/api/actor/*`: `REQUIRES_HUMAN_CONTEXT` sobre uso atual, proxy externo ou legado.
- RPCs de claim referenciam SQLs ausentes da árvore: `REQUIRES_HUMAN_CONTEXT` sobre deployment prévio.
- O exemplo de treino de readiness usa 900 steps; o contrato v2 de dispatch usa 800: `REQUIRES_HUMAN_CONTEXT` sobre limpeza do exemplo.
- O estado de migrations, endpoints, workers, Redis, R2, adapters, mídia e pagamentos reais não é observável sem acesso externo e permaneceu não consultado.
