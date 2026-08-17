# Privacy IA — Glossário do projeto

## Objetivo e regra de evidência

Este glossário fixa o significado operacional dos termos usados no repositório. Ele descreve o estado observado no HEAD `01db327845467726420dca8ac2cc8217c1f8167d` e o contexto humano fornecido para esta base de conhecimento.

Regras de leitura:

- um nome de arquivo, rota, tabela ou gate confirma que o contrato existe no código local; não confirma deploy, dados, execução real ou homologação;
- SQL versionado confirma intenção de schema, não que a migration foi aplicada;
- comentários de milestone são marcadores históricos, não evidência de conclusão;
- `REQUIRES_HUMAN_CONTEXT` marca significado, estado externo ou decisão que o repositório local não comprova.

## Termos de produto e pessoas

### Privacy IA

Plataforma principal deste repositório. Reúne superfícies de Cliente, Atriz/Ator e Admin; autenticação; chat; catálogo; geração e entrega de mídia; Fábrica; identidade; compliance; e contratos financeiros. Não confundir com PIR.

### PIR

Projeto/motor independente desenvolvido no repositório `privacy-pir-repo`. PIR **não** significa “Produção Individual Real”.

O desenvolvimento recente informado para PIR tem linha própria de versões, incluindo PIR 0.3B, HF1 e a versão resultante 0.3.1. Seu escopo inclui runtime/motores de IA, model bundles, execução GPU e políticas de memória. Esses artefatos não estão presentes neste repositório e são distintos dos serviços de produção comercial do backend principal.

Estado: dependência/projeto externo. A expansão da sigla e o estado executável atual são `REQUIRES_HUMAN_CONTEXT` no repositório Privacy IA.

### Milestone

Rótulo histórico de fase ou entrega. O repositório contém referências como Milestone 4, M4.8, M4.9 e M4.5, mas a presença do rótulo ou do código não prova homologação nem execução externa. A sincronização `4f088aebb12803e9095d995999c686e5972cf382` concentrou grande volume de trabalho; por isso a quantidade de commits não representa a granularidade real do desenvolvimento.

### M4 / Milestone 4

Fase relacionada à construção/conclusão dos motores e da infraestrutura de geração de IA e seus fluxos associados. Inclui contratos locais de Fábrica, filas, mídia, produção controlada, QA, identidade e operações Admin. Código atrás de gate permanece “preparado” ou “bloqueado” até existir evidência separada de execução e homologação.

### M4.5 / M45

Identificador usado em nomes de APIs, hooks e painéis operacionais de Admin (`m45Operational*`). O código local o relaciona ao dashboard, readiness e ações controladas da Fábrica. O recorte histórico exato e o critério humano de conclusão de M4.5 são `REQUIRES_HUMAN_CONTEXT`.

### Cliente

Usuário com role `cliente`. A superfície React sob `/cliente/*` inclui feed, descoberta, notificações, chat, galeria, geração de imagem/vídeo, carteira, perfil e perfil público de Atriz. O acesso protegido depende do token e da role persistidos no Zustand e da validação do JWT no backend.

### Ator / Atriz

Pessoa ou entidade operacional representada principalmente por `actor_profiles` nos fluxos de onboarding, KYC, mapeamento, autorização, identidade e repasse. No frontend e no role model, `atriz` também é o nome da área do criador (`/atriz`).

`actor_profiles` e `companions` não são sinônimos: o primeiro sustenta identidade/compliance; o segundo sustenta a persona/avatar consumida pelo Cliente. O vínculo comprovado entre ambos é `avatar_production_authorizations`, que associa `actor_profile_id`, `companion_id` e `kyc_case_id`.

### Companion / personagem / avatar

Entidade `companions` apresentada ao Cliente como personagem, perfil ou “atriz”. Participa de catálogo, chat, assinaturas, mídia e produção. “Avatar” é usado no código para o companion cuja produção está vinculada a um Ator e a uma autorização. Não presumir que todo companion possui Ator, KYC ou autorização ativos.

### Empresa

Classificação local usada como beneficiário de split (`beneficiary_type = company`) e como possível representação de um cadastro de Ator por metadata. Não existe uma role de autenticação `empresa`; as roles locais são `cliente`, `atriz` e `adm`. A natureza jurídica e o modelo completo de contas de Empresa são `REQUIRES_HUMAN_CONTEXT`.

### Admin

Superfície administrativa sob `/adm` e rotas backend `/api/admin/*`. O backend exige autenticação e `adminMiddleware`; este aceita roles administrativas normalizadas (`adm`, `admin`, `dono`, `owner`, `superadmin`, `super_admin`). A UI de Admin agrega Fábrica, QA, Atores/KYC, identidade, direção de cena, inteligência, produção real controlada e relatórios.

### KYC

Fluxo de identificação, revisão e autorização do Ator. Os contratos locais incluem `actor_kyc_cases`, assets privados em `actor_kyc_assets`, requisitos dinâmicos de mapeamento e decisões administrativas. KYC aprovado é uma das condições para autorização de produção, mas a aplicação dos SQLs e a existência de casos reais não são comprovadas localmente.

## Termos de IA, identidade e mídia

### Identity / LoRA

Pipeline de identidade dos Atores. O código local cobre autorização de preparação, auditoria e registro de dataset, readiness dry-run, preflight, treinamento controlado, registro de adapter privado, preview, auditoria forense, auditoria do alvo e decisão de QA.

Há histórico experimental D3.6 e derivados. Os gates padrão mantêm treinamento real e injeção em inferência desligados. A existência desse pipeline não comprova adapter aprovado ou uso homologado em produção.

### Adapter

Artefato LoRA privado registrado em `actor_identity_adapters`, vinculado a Ator, training run, modelo-base, fingerprint, checksum e estado de QA. O contrato exige aprovação e compatibilidade antes do uso em vídeo. Adapter presente no banco não equivale automaticamente a adapter aprovado, carregável ou homologado.

### Wan-DiT

Perfil de alvo de treinamento de identidade em vídeo. O contrato de dispatch aceita `wan_dit_identity_video_v1`; o perfil anterior `wan_vace_identity_poc_v1` é tratado pelo auditor como legado. A implementação executável do motor e seus model bundles não estão neste repositório.

### Wan I2V / V2V

Modos de produção de vídeo comprovados no código:

- I2V: produção solo; o validador não aceita `baseSceneId`, e o compilador usa uma imagem de referência como fonte;
- V2V: exige vídeo/cena base e preserva movimento/enquadramento conforme a direção de cena.

Os contratos usam engines `wan-2.1-i2v` e `wan-2.1-v2v`, fila separada para V2V e provider RunPod. Isso prova wiring local, não o endpoint implantado nem sua homologação.

### VACE

Família/modelo-base presente no pipeline de identidade: `Wan-AI/Wan2.1-VACE-14B`. Locks, manifestos, auditoria do alvo e tabelas de adapter referenciam VACE. Não inferir arquitetura ou compatibilidade além dos locks, fingerprints e contratos efetivamente encontrados.

### Checkpoints 400/600/800

No contrato v2 compilado por `actor-identity-training-dispatch.service.js`, são checkpoints de **uma única execução controlada de 800 optimizer steps**, e não três treinamentos independentes.

Existe um `training_config.example.json` de readiness com 900 steps e checkpoint adicional 900. Ele não deve substituir silenciosamente o contrato v2 de dispatch. A destinação desse exemplo divergente é `REQUIRES_HUMAN_CONTEXT`.

### Live Action

Modalidade de produto audiovisual integrada a Ator/companion, identidade, direção de cena e motores de vídeo. O pipeline local a normaliza como vídeo V2V, exige cena base e usa entrega protegida. A matriz Admin contém orientação explícita para mantê-la bloqueada até renderer protegido homologado; portanto UI e serviços existentes não bastam para declará-la homologada.

### Live Audio / Audio Live

Modalidade distinta de Live Action, centrada em áudio/fala e experiência audiovisual associada quando aplicável. O pipeline local possui storyline, combinação/lote, fila `media:audio`, worker, TTS e player protegido. Há também geração de áudio de mensagem de chat por caminho próprio. “Live Audio”, “Audio Live” e `live_audio` são variações de nomenclatura do mesmo tipo local, não de Live Action.

### Geração de imagem

Fluxo de mídia com opções guiadas, pricing, débito de créditos, fila `media:image`, worker e provider RunPod. O caminho canônico prevê master privado, QA e renditions antes da entrega. Workers e endpoint estão desligados/ausentes por padrão.

### Geração de vídeo

Fluxo I2V/V2V com direção de cena, filas isoladas (`media:video-short` e `media:video-v2v`), RunPod e controle de identidade. O caminho canônico prevê master privado, QA e renditions. Wiring local não comprova produção real.

### Geração de áudio / TTS

O provider atual seleciona `RUNPOD_QWEN_TTS_ENDPOINT_ID` para Qwen3-TTS/CosyVoice. Variáveis de Fish Speech e endpoint genérico permanecem descritas como antigas/legadas no arquivo de ambiente. O pipeline de Live Audio usa fila; a geração de áudio de mensagem usa chamada direta ao provider e upload pelo serviço de storage.

## Termos de plataforma e operação

### Fábrica / Factory

Domínio administrativo de preparação, produção, lotes/itens, assets, QA, pricing, publicação, delivery e relatórios. Há modos dry-run e produção real controlada. “Fábrica existente” não significa que workers, endpoints, migrations ou estoque real estejam ativos.

### QA

Quality Assurance/revisão antes de disponibilização. Assets normalmente passam por `qa_pending`; aprovação os torna `available`, e rejeição os bloqueia. Há QA adicional para identidade, produção real, narrativa e renditions. “Available” ainda não implica publicação comercial: visibilidade, preço, contrato de compra e renderer também precisam estar válidos.

### Protected delivery / entrega protegida

Entrega vinculada ao perfil comprador e a um asset/rendition autorizado, acessada por descriptor ou stream protegido. O código usa ownership, contratos de mídia, token temporário assinado, TTL curto, proxy/backend ou HLS e headers `private/no-store`. Não deve ser convertida em URL pública como atalho.

### Cloudflare R2 / R2

Storage de mídia acessado pela API compatível com S3. O serviço local suporta objetos públicos e privados, upload, download, cópia, delete e URLs assinadas. KYC, datasets, adapters, masters e previews sensíveis devem usar referências privadas de bucket/key. Toda operação real exige autorização explícita.

### Supabase

PostgreSQL, autenticação e recursos relacionados usados pela plataforma. O browser usa a anon key apenas nos fluxos autorizados de autenticação; o backend mantém clientes anon e service-role. Arquivos em `backend/src/db/sql` são artefatos locais e não comprovam schema remoto aplicado.

### RunPod

Infraestrutura GPU referenciada pelos providers e pipelines de imagem, vídeo, áudio e identidade. O código contém submit, polling, timeout, cancelamento, telemetria, custo e leases. Uma rota ou função RunPod não é autorização para job real; execução pode gerar custo.

### Redis / BullMQ

Redis fornece conexão para filas BullMQ isoladas de imagem, vídeo curto, V2V, áudio e rendition. Workers são processos independentes do HTTP e exigem `WORKERS_ENABLED=true`; Redis externo em desenvolvimento exige autorização adicional.

### Rendition / derivado de mídia

Derivado de um master de mídia, como preview ou HLS, criado com FFmpeg/FFprobe e registrado separadamente. Renditions privadas suportam a entrega protegida sem expor o master.

### Publicação

Mudança que torna produto/card/combinação visível ao Cliente. É distinta de geração, QA e disponibilidade técnica. Publicação exige autorização humana quando a tarefa não a pedir explicitamente.

### Wallet / credit ledger

`profiles.credits` representa saldo; `credit_ledger` registra movimentos. Há código de compra, débito atômico/fallback e estorno. Esses caminhos mutam dados financeiros e nunca devem ser executados por auditoria/documentação.

### Gateway / payout / saque

Gateway é o processador externo de pagamento; integração real não foi comprovada no código auditado. Payout/repasse é calculado a partir de vendas, regras e métodos do Ator, mas relatórios/estimativas não comprovam liquidação. Execução financeira real e o provedor final são `REQUIRES_HUMAN_CONTEXT`.
