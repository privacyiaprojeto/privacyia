# Privacy IA — Gates para operações reais

## Princípio

O padrão é **FAIL CLOSED**. Ausência de informação, flag, secret, confirmação, evidência de ownership, aprovação de QA ou autorização humana significa **não executar**.

Os gates implementados no código são necessários, mas não suficientes. Uma flag verdadeira ou uma frase correta **não constitui autorização do usuário**. A tarefa também precisa autorizar explicitamente a operação real, o ambiente, o alvo e o limite de custo/impacto.

## Níveis de ação

### READ

Leitura local ou externa sem mutação, dentro do escopo autorizado. Exemplos: código local, diff, status Git, configuração mascarada, metadata e relatórios read-only. Leitura externa sensível ainda exige que a tarefa a coloque em escopo.

### PREPARE

Produz plano, payload local, dry-run, checklist, patch SQL não aplicado ou preview sem disparo externo. Não cria job, não envia arquivo, não publica e não altera dado remoto.

### SIMULATE

Executa caminho explicitamente simulado, com garantias verificáveis de que não há cobrança, wallet mutation, job GPU, upload, publicação ou entrega comercial. “Preview” só é simulação se o código e o ambiente comprovarem ausência dessas mutações.

### EXECUTE_REAL

Qualquer ação que altere sistema externo, dado real ou estado comercial; gere custo; use GPU; transfira/exclua mídia; mude autenticação; publique; cobre; ou faça deploy. Exige autorização humana explícita e escopo fechado.

## Matriz de gates

| Operação | READ | PREPARE / SIMULATE | EXECUTE_REAL |
| --- | --- | --- | --- |
| RunPod/GPU | inspecionar código/config mascarada | compilar payload local/dry-run | autorização explícita, endpoint e job alvo, custo/limite, gate técnico e plano de parada |
| Treinamento Identity/LoRA | auditar dataset/contrato | readiness e preflight sem submit | Ator/run one-shot, KYC/autorização, target audit, flags, expiração, confirmação e orçamento |
| Alterar endpoint/modelo | ler env schema/locks | propor patch sem aplicar em ambiente | autorização para ambiente específico, compatibilidade e rollback |
| R2 upload/copy | listar metadata se autorizado | gerar key/manifest local | bucket/key exatos, privacidade, tamanho/hash e autorização |
| R2 delete | head/list do alvo | plano de exclusão | autorização destrutiva explícita, alvo exato e evidência de recuperação/retention |
| Publicação de mídia | ler QA/visibilidade | preview de decisão | asset exato, QA aprovado, preço/contrato válidos e autorização comercial |
| URL pública | inspecionar política | propor acesso privado/token | autorização explícita; nunca para KYC, dataset, adapter ou master sensível |
| Supabase | select autorizado | SQL/patch local não aplicado | autorização para projeto/ambiente e mutação exata |
| Migration/RLS/RPC/trigger | ler SQL local | preparar/revisar migration | autorização explícita, backup/rollback e ambiente confirmado |
| Auth/usuários reais | ler contrato local | simular com fixture local | usuário/tenant exato, consentimento e autorização explícita |
| Wallet/ledger/créditos | relatórios read-only | cálculo local/simulação sem mutação | autorização financeira, perfil/valor/idempotência e reconciliação |
| Gateway/cobrança | ler integração | mock/sandbox explicitamente isolado | autorização financeira e confirmação de ambiente real |
| Payout/saque | relatório estimado | cálculo local | beneficiário, valor, método, aprovação e autorização financeira explícita |
| Produção comercial/delivery | inspecionar contratos | preview sem claim | asset/cliente/preço exatos, ownership, idempotência e autorização |
| Deploy | ler manifests/workflows | build local/plano | autorização do ambiente, versão, janela e rollback |

## Gates específicos observados no código

### Workers, Redis e renditions

- `WORKERS_ENABLED` deve estar explicitamente ativo;
- Redis externo em desenvolvimento exige `ALLOW_EXTERNAL_REDIS_WORKERS=true`;
- rendition exige `RENDITION_QUEUE_ENABLED=true`;
- FFmpeg e FFprobe precisam existir no runtime;
- filas devem permanecer isoladas e o shutdown seguro preservado.

Não iniciar workers durante auditoria/documentação.

### RunPod e produção de mídia

- API key e endpoint do tipo correto precisam existir;
- produção Cliente bloqueia quando worker/queue ou endpoint não estão prontos;
- timeouts, cancelamento, telemetria, custo e lease não devem ser contornados;
- masters devem permanecer privados e ir a QA/rendition antes de delivery;
- healthcheck ou status read-only não autoriza submit.

### Produção real controlada

O código separa readiness, preparação, configuração de candidato, compliance, criação de combination, preview de execução, start, auditoria, watchdog, QA e release.

Há frase padrão `CONFIRMAR PRODUCAO REAL DE 1 ITEM` e flags adicionais. A frase só é válida dentro de uma tarefa que já autorizou `EXECUTE_REAL`; nunca deve ser preenchida automaticamente por um agente.

Antes de start real, confirmar no mínimo:

- ambiente correto e não ambíguo;
- um único alvo autorizado;
- Ator, KYC, companion e authorization coerentes;
- adapter/identidade quando o tipo exigir;
- endpoint/worker/custo/lease prontos;
- storage privado e QA posterior;
- idempotência e ausência de job duplicado;
- limite de custo/tempo e ação de cancelamento;
- autorização humana explícita nesta tarefa.

### Identity/LoRA

Defaults fail-closed observados:

- `IDENTITY_LORA_TRAINING_ENABLED=false`;
- `IDENTITY_LORA_TRAINER_DRY_RUN_ONLY=true`;
- `IDENTITY_LORA_INFERENCE_INJECTION_READY=false`;
- real smoke e preview smoke desativados;
- target audit e paid training não aprovados por padrão.

Uma execução real exige, além da autorização humana:

- actor/run UUIDs exatos e permitidos;
- janela não expirada;
- exatamente um job;
- dataset aprovado sem documento de identidade;
- bucket/prefix privados e checksums;
- base model revision/fingerprint e engine commit fixados;
- perfil `wan_dit_identity_video_v1` aprovado;
- preflight concluído;
- injeção de inferência ainda bloqueada durante treino;
- QA/auditoria antes de aprovar o adapter.

As frases de confirmação de preparação, treino, preview, auditoria e revisão são barreiras técnicas. Não as emitir nem reutilizar sem autorização específica para a etapa correspondente.

### R2 e privacidade

KYC, datasets, adapters, masters, base scenes e previews sensíveis devem usar bucket/key privados; URL HTTP não substitui referência privada. Preferir proxy, stream ou signed URL de TTL curto.

Antes de upload real:

- validar bucket e key exatos;
- confirmar classificação de dados;
- impedir caminho público para material sensível;
- registrar checksum/tamanho quando o contrato exigir;
- evitar overwrite não autorizado.

Antes de delete real:

- listar/head do objeto exato;
- confirmar que não é master, evidência KYC, adapter ativo ou objeto referenciado;
- obter autorização destrutiva explícita;
- documentar retenção/recuperabilidade.

### Delivery protegido e publicação

Geração, QA, disponibilidade, publicação, compra e playback são estados distintos.

Para publicar ou entregar:

- asset em estado permitido e QA aprovado;
- combination ativa e visível somente quando autorizado;
- preço e estoque válidos;
- renderer/rendition homologado para o tipo;
- purchase contract `clientPurchasable`/`canCharge` quando pago;
- claim idempotente e delivery pertencente ao perfil;
- token temporário com scope/resource/profile corretos;
- headers privados/no-store;
- nenhum master sensível exposto.

Live Action deve permanecer bloqueado até confirmação humana de que o renderer protegido está homologado.

### Banco e migrations

Nunca inferir que SQL local foi aplicado. Antes de `EXECUTE_REAL`:

- identificar projeto Supabase e ambiente;
- revisar schema atual e dependências;
- confirmar migration/RPC/RLS/trigger exatos;
- definir rollback e impacto de lock/dados;
- obter autorização explícita;
- registrar resultado verificável.

Os RPCs de claim citados pelo serviço não possuem seus SQLs `20260617_*` na árvore atual. Não recriá-los por inferência; `REQUIRES_HUMAN_CONTEXT`.

### Autenticação e usuários

Não criar, alterar senha/role, bloquear ou remover usuário real sem autorização explícita. Service-role deve permanecer apenas no backend. Não registrar tokens, secrets ou dados KYC em logs/documentos.

### Financeiro

São operações reais: comprar créditos, alterar `profiles.credits`, inserir ledger/payment transaction, claim pago, refund, regra de payout, gateway, saque e payout.

Antes de qualquer mutação:

- ambiente e perfil exatos;
- valor/moeda/créditos exatos;
- autorização financeira explícita;
- idempotência;
- atomicidade ou rollback comprovado;
- reconciliação de saldo, ledger e transação;
- confirmação de sandbox versus produção no gateway.

Relatório ou cálculo estimado de payout não autoriza pagamento.

### Deploy

Build local e inspeção de workflow são `PREPARE`. Deploy, alteração de secret, endpoint, worker remoto, DNS ou infraestrutura são `EXECUTE_REAL`. Sem autorização de ambiente e versão, parar.

## Checklist obrigatório para EXECUTE_REAL

Um agente só pode prosseguir quando todas forem verdadeiras:

1. a solicitação autoriza explicitamente a categoria real;
2. ambiente, recurso e alvo estão identificados sem ambiguidade;
3. impacto, custo e limite estão definidos;
4. leitura/preflight comprovou todos os gates;
5. nenhuma incerteza `REQUIRES_HUMAN_CONTEXT` afeta a decisão;
6. idempotência, rollback/cancelamento e evidência pós-ação estão definidos;
7. secrets e dados sensíveis não serão expostos;
8. o menor escopo possível foi escolhido.

Se qualquer item falhar: permanecer em `READ`, `PREPARE` ou `SIMULATE` e reportar o blocker.

## Evidência após ação autorizada

Registrar sem secrets:

- autorização e escopo recebidos;
- ambiente e identificadores mascarados quando necessário;
- nível executado (`READ`, `PREPARE`, `SIMULATE`, `EXECUTE_REAL`);
- gates avaliados e resultado;
- operação e resposta relevante;
- custo/tempo quando aplicável;
- mutações produzidas;
- rollback/cancelamento ou motivo de não aplicação;
- estado final e riscos residuais.
