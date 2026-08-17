# Privacy IA — Snapshot honesto do roadmap

## Referência

- Snapshot: 2026-08-17.
- Branch auditada: `chore/agentic-engineering-bootstrap-v1`.
- HEAD base: `01db327845467726420dca8ac2cc8217c1f8167d`.
- Método: leitura estática local; nenhuma rede, banco remoto, RunPod, GPU ou R2.

O commit `4f088aebb12803e9095d995999c686e5972cf382` é uma grande sincronização do estado da aplicação. Não inferir roadmap pela quantidade de commits nem inventar milestones ausentes.

As categorias abaixo são evidenciais, não uma ordem de execução. Este documento não define uma “próxima fase definitiva”.

## A. Confirmado no código local

### Plataforma e acesso

- Frontend React/TypeScript/Vite/Tailwind com TanStack Query, Axios e Zustand.
- Superfícies roteadas para Cliente, Atriz/Ator e Admin, com guards por role.
- Backend Express/ESM em camadas de routes, controllers, validators e services.
- Autenticação Supabase, Bearer JWT no backend e role admin validada no servidor.
- MSW opt-in apenas em desenvolvimento.

### Dados e infraestrutura

- Clientes Supabase anon e service-role.
- Patches SQL locais para Fábrica, Ator/KYC, direção de cena, inteligência, mídia master/renditions e identity LoRA.
- R2 com primitives públicas/privadas, signed URLs, proxy, upload, download, copy e delete.
- Redis/BullMQ com filas isoladas de imagem, vídeo curto, V2V, áudio e rendition.
- Processos de worker separados do HTTP, graceful shutdown e validação de FFmpeg/FFprobe.

### Produto e mídia

- Fluxos Cliente de catálogo, feed, chat, galeria, geração, carteira e perfil.
- Fluxos Atriz/Ator de onboarding, mapeamento, produtos, overview e financeiro.
- Painéis Admin de Fábrica, QA, Atores/KYC, identidade, direção de cena, narrativa, inteligência, pricing e operação.
- Contratos de imagem, Wan I2V/V2V, Live Action, Live Audio e TTS.
- Masters/renditions, QA, publicação separada de disponibilidade e entrega protegida com tokens temporários.
- Débito/refund, claim pago, pricing, splits e relatórios financeiros implementados como código local.

### Identidade

- Gatekeeper LoRA de identidade com dataset, readiness, preflight, dispatch, status, adapter, preview, auditorias e decisão de revisão.
- Contrato v2 atual de uma execução controlada com 800 optimizer steps e checkpoints 400/600/800.
- Perfil-alvo `wan_dit_identity_video_v1`; perfil `wan_vace_identity_poc_v1` reconhecido como legado pelo auditor.
- Requisitos de KYC, autorização, storage privado, fingerprint, checksum e QA antes de produção.

## B. Preparado mas não comprovado em execução real

- Patches SQL estão versionados, mas sua aplicação em qualquer Supabase não foi verificada.
- Providers RunPod e contratos de payload existem, mas endpoints, images/containers e execução real não foram consultados.
- Filas e workers estão implementados, mas `WORKERS_ENABLED` é falso por padrão e nenhum runtime foi iniciado.
- Produção de imagem/vídeo/áudio possui wiring, mas não há evidência local de jobs completos, custo real ou qualidade homologada.
- Pipeline Identity/LoRA possui dispatch real controlado, mas não há evidência local de training run, adapter aprovado ou injeção real.
- R2 privado, renditions e playback protegido possuem implementação, mas objetos, buckets e entrega em ambiente real não foram inspecionados.
- Fábrica possui dry-run, produção controlada, QA e release, mas estoque/publicação comercial reais não foram confirmados.
- Wallet, ledger, purchase RPCs e relatórios existem, mas gateway/liquidação/payout real não foram comprovados.
- OpenRouter está integrado em código, mas configuração e comportamento em ambiente implantado não foram testados.

## C. Incompleto

- O componente `ResetPassword.tsx` é exportado e o fluxo de e-mail direciona a `/reset-password`, porém a rota não está registrada no router.
- Há clientes frontend para `/atriz/painel/*` sem rotas correspondentes no backend local; o backend canônico de Ator observado usa `/api/actor/*`.
- O serviço de delivery orienta instalar RPCs por SQLs `20260617_claim_media_asset_*`, mas esses arquivos não existem na árvore atual.
- A injeção do adapter Identity/LoRA em inferência está explicitamente desabilitada por padrão.
- A matriz operacional instrui manter Live Action bloqueado até renderer protegido homologado.
- O estado real de gateway de pagamento e payout não está implementado/comprovado de ponta a ponta na evidência local.

Cada item acima é `REQUIRES_HUMAN_CONTEXT` quanto à prioridade, impacto em ambiente e eventual implementação externa já existente.

## D. Bloqueado por gate

### Runtime e produção

- Workers: `WORKERS_ENABLED=false` por padrão.
- Redis externo em desenvolvimento: bloqueado sem `ALLOW_EXTERNAL_REDIS_WORKERS=true`.
- Rendition: exige `RENDITION_QUEUE_ENABLED=true` e binaries válidos.
- Geração Cliente: exige workers/filas e endpoint RunPod configurado.
- Produção real: exige ambiente, candidato, KYC/autorização, readiness, frase exata, limites e demais blockers zerados.

### Identity/LoRA

- `IDENTITY_LORA_TRAINING_ENABLED=false`.
- `IDENTITY_LORA_TRAINER_DRY_RUN_ONLY=true`.
- `IDENTITY_LORA_INFERENCE_INJECTION_READY=false`.
- Training target audit e paid training precisam de aprovação explícita.
- Smoke real é one-shot, escopado a Ator/run, com expiração e no máximo um job.
- Preview privado também é one-shot, escopado e dry-run-only por padrão.

### Comercial e entrega

- QA precede `available`.
- Publicação/visibilidade é decisão separada.
- Compra depende de preço, estoque, contrato client-purchasable e RPC atômica.
- Playback depende de ownership, status, renderer/rendition e token válido.
- Live Action permanece bloqueado até homologação do renderer protegido.

Esses gates técnicos nunca substituem autorização humana da tarefa.

## E. Legado/substituído

- `RUNPOD_FISH_SPEECH_ENDPOINT_ID` está comentado como endpoint antigo e `RUNPOD_AUDIO_ENDPOINT_ID` como fallback legado; o provider atual seleciona Qwen3-TTS.
- Aliases `FACTORY_*` e `ACTOR_PIPELINE_LIVE_AUDIO` em `queues/names.js` são compatibilidade de nomes, não novas filas.
- O perfil `wan_vace_identity_poc_v1` é classificado como legado em relação a `wan_dit_identity_video_v1`.
- `training_config.example.json` ainda descreve 900 steps/checkpoint 900, enquanto o dispatch v2 efetivo compila 800 e 400/600/800. Não usar o exemplo para redefinir o contrato atual. Remoção ou atualização: `REQUIRES_HUMAN_CONTEXT`.
- Mocks/fallbacks frontend são suporte de desenvolvimento, não prova de catálogo real.
- Referências textuais a scripts históricos ausentes devem ser avaliadas por impacto; a ausência, isoladamente, não autoriza restauração.

## F. Dependente de outro repositório ou estado externo

### PIR

PIR é projeto/motor independente em `privacy-pir-repo`, com linha própria PIR 0.3B / HF1 / 0.3.1. Runtime, model bundles, GPU e políticas de memória não estão neste repositório. Relação exata da versão implantada com os endpoints do Privacy IA: `REQUIRES_HUMAN_CONTEXT`.

### Infraestrutura e dados

- Supabase remoto: schema aplicado, RLS, RPCs, Auth e dados reais.
- Cloudflare R2: buckets, objetos privados, lifecycle e domínio público.
- Redis: instância, conectividade e filas atuais.
- RunPod: endpoints, templates, workers, GPU, jobs e custos.
- OpenRouter: chaves, modelos disponíveis e operação real.
- Deploy frontend/backend/workers e configuração de observabilidade.
- Gateway de pagamento, liquidação e payout.
- Modelos/fingerprints e artefatos externos referenciados pelos locks.

Todos os estados acima são `REQUIRES_HUMAN_CONTEXT` até evidência externa autorizada.

## Pontos que não podem ser concluídos deste snapshot

- quais fluxos estão homologados pelo Cliente/negócio;
- quais migrations/RPCs estão instaladas;
- quais features estão ligadas em produção;
- se existem mídia, deliveries, adapters ou transações reais válidos;
- qual versão do PIR está atualmente integrada;
- qual deve ser a próxima fase do roadmap.

Não converter essas incertezas em suposições. Solicitar contexto humano ou auditoria externa explicitamente autorizada.
