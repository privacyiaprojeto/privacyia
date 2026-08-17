# AGENTS.md — Privacy IA

## 1. Missão

Este repositório contém o Privacy IA.

O Codex deve atuar como agente de engenharia sob supervisão humana.

Prioridades, nesta ordem:

1. preservar comportamento homologado;
2. preservar segurança e privacidade;
3. evitar regressões;
4. reutilizar arquitetura existente;
5. executar mudanças pequenas e cirúrgicas;
6. produzir evidência verificável;
7. nunca ampliar o escopo por iniciativa própria.

Não realizar refatorações amplas apenas porque o código pode ser melhor organizado.

---

## 2. Arquitetura atual

Frontend:

- React;
- TypeScript;
- Vite;
- Tailwind;
- TanStack Query;
- Axios centralizado;
- Zustand para estado de sessão;
- Supabase no navegador somente nos fluxos autorizados de autenticação.

Backend:

- Node.js;
- ESM;
- Express;
- controllers;
- services;
- validação;
- Supabase/PostgreSQL.

Processamento assíncrono:

- Redis;
- BullMQ;
- workers independentes do processo HTTP.

Integrações sensíveis incluem:

- Supabase;
- Cloudflare R2;
- RunPod;
- OpenRouter;
- processamento de mídia;
- geração de imagem;
- geração de vídeo;
- geração de áudio;
- pipelines de identidade/LoRA.

Antes de criar nova entidade, página, rota, serviço ou fluxo, verificar se já existe algo que possa ser reutilizado ou alterado cirurgicamente.

### Base de conhecimento persistente

Antes de tarefas arquiteturais, funcionais ou de roadmap, consultar integralmente, conforme a relevância do escopo:

- `docs/PROJECT_GLOSSARY.md`;
- `docs/ARCHITECTURE.md`;
- `docs/ROADMAP_STATE.md`;
- `docs/PRODUCTION_GATES.md`.

Esses documentos orientam termos, fronteiras, estado comprovado e gates, sem transformar código preparado em funcionalidade homologada.

---

## 3. Regra de ouro

NÃO alterar UI/UX, layout, navegação, design, copy homologada ou fluxo do Cliente sem solicitação explícita.

NÃO duplicar:

- páginas;
- menus;
- rotas;
- services;
- controllers;
- tabelas;
- entidades;
- componentes;
- fluxos de negócio.

Primeiro procurar e compreender o que já existe.

---

## 4. Mudanças devem ser cirúrgicas

Para qualquer tarefa:

1. localizar o fluxo existente;
2. identificar a causa real;
3. determinar o menor conjunto de arquivos necessário;
4. explicar o impacto;
5. alterar somente o necessário;
6. validar;
7. apresentar diff e evidências.

Evitar:

- rewrites;
- reorganizações cosméticas;
- renomeações em massa;
- movimentação desnecessária de arquivos;
- criação de abstrações sem necessidade concreta;
- troca de biblioteca sem autorização;
- alteração de contratos estáveis apenas por preferência técnica.

---

## 5. Segurança — fail closed

Operações sensíveis devem permanecer bloqueadas por padrão.

Sem autorização explícita, NÃO executar:

- produção real de mídia;
- jobs RunPod;
- GPU;
- upload real ao R2;
- delete no R2;
- exclusão de dados;
- alteração financeira;
- cobrança;
- pagamento;
- alteração de wallet;
- criação ou alteração de credit ledger;
- criação de delivery comercial;
- publicação ao Cliente;
- exposição de URL pública;
- alteração destrutiva de banco;
- migration real;
- SQL de mutação em ambiente remoto;
- alteração de usuários reais;
- alteração de autenticação real;
- alteração de secrets;
- alteração de infraestrutura externa.

Quando houver dúvida, parar em modo somente leitura.

---

## 6. Banco de dados

Não alterar:

- schema;
- migrations;
- RLS;
- RPCs;
- triggers;
- policies;
- dados reais;

sem autorização explícita da tarefa.

Não executar SQL remoto automaticamente.

Sempre diferenciar:

- leitura;
- preparação;
- migration;
- mutação real.

Nunca inventar coluna ou contrato de banco sem verificar o schema existente.

---

## 7. RunPod, R2 e mídia

Por padrão:

- não disparar inference;
- não ligar GPU;
- não criar job;
- não fazer upload;
- não publicar mídia;
- não excluir objetos;
- não gerar URL pública;
- não alterar endpoints;
- não alterar workers remotos.

Auditorias devem preferir análise estática e operações locais.

Qualquer operação real precisa de autorização explícita e escopo definido.

---

## 8. Financeiro

Por padrão, NÃO:

- cobrar usuário;
- debitar créditos;
- creditar carteira;
- modificar wallet;
- criar ledger real;
- processar gateway;
- criar repasse;
- executar payout.

Testes financeiros devem permanecer simulados ou somente leitura salvo autorização explícita.

---

## 9. Git

Não trabalhar diretamente na branch main quando houver branch de trabalho definida.

Nunca executar por iniciativa própria:

- git reset --hard;
- git clean -fd;
- git push --force;
- git push --force-with-lease;
- rebase destrutivo;
- checkout descartando alterações;
- delete de branch remota;
- alteração de tags de release;
- commit;
- push;
- merge.

Commit, push e merge devem ocorrer somente quando a tarefa autorizar explicitamente.

Antes e depois de qualquer mudança relevante, conferir:

- branch;
- HEAD;
- git status --short.

Nunca esconder alteração inesperada.

---

## 10. Arquivos inesperados

Se o working tree já estiver sujo antes da tarefa:

- não sobrescrever;
- não apagar;
- não assumir autoria;
- não fazer stash automaticamente;
- reportar os arquivos encontrados.

Se durante a tarefa surgir modificação fora do escopo:

- parar;
- identificar;
- reportar.

---

## 11. Testes históricos removidos

O projeto possuía grande quantidade de:

- tests;
- inspectors;
- auditors;
- readiness scripts;
- smoke scripts;
- scripts temporários de milestones.

Grande parte dessa infraestrutura foi removida INTENCIONALMENTE após auditoria e limpeza segura do repositório.

A ausência desses testes históricos NÃO deve ser tratada automaticamente como corrupção ou perda de arquivos.

Não restaurar infraestrutura histórica de testes sem solicitação explícita.

Referências textuais legadas a comandos inexistentes devem primeiro ser classificadas quanto ao impacto real no runtime.

---

## 12. Validação

Nunca afirmar que uma mudança está pronta apenas porque o código parece correto.

Usar, quando aplicável e seguro:

- análise estática;
- parser;
- build;
- typecheck;
- lint, se configurado;
- testes existentes;
- git diff --check;
- git status --short.

Quando uma tarefa modificar código e o Harness local for aplicável, executar `node tools/agent-verify-local.mjs` antes de declarar readiness. O Harness não substitui validações específicas do domínio.

Não executar teste que possa:

- acessar produção;
- alterar banco;
- consumir GPU;
- gerar custos;
- enviar mídia;
- alterar serviço externo;

sem autorização.

Se alguma validação não puder ser executada, declarar explicitamente.

---

## 13. Evidência obrigatória

Ao concluir uma tarefa, informar:

- causa identificada;
- arquivos alterados;
- motivo de cada alteração;
- validações executadas;
- resultado das validações;
- riscos residuais;
- git status final.

Nunca declarar sucesso sem evidência correspondente.

---

## 14. Escopo

Se uma solicitação tiver escopo específico, tratar o restante do sistema como fora de escopo.

Não aproveitar uma correção para:

- limpar código adjacente;
- reformular arquitetura;
- alterar estilo;
- corrigir outros módulos;
- atualizar dependências;
- modernizar componentes;

a menos que isso seja tecnicamente indispensável para a tarefa.

---

## 15. Arquivos grandes

Arquivos grandes ou "god files" podem existir por razões históricas.

Não refatorá-los automaticamente.

Uma refatoração estrutural exige tarefa própria, análise de risco e autorização explícita.

---

## 16. Cliente e superfícies homologadas

Tratar superfícies já homologadas como contratos.

Não alterar silenciosamente:

- comportamento do Cliente;
- cards;
- CTA;
- navegação;
- catálogo;
- chat;
- galeria;
- playback;
- fluxos de compra;
- fluxos de atriz/ator;
- Admin/Fábrica.

Mudança visual ou comportamental precisa fazer parte explicitamente do objetivo.

---

## 17. Definition of Done

Uma tarefa só pode ser considerada concluída quando:

- objetivo solicitado foi atendido;
- escopo permaneceu controlado;
- nenhuma operação proibida foi executada;
- diff foi revisado;
- validações possíveis passaram;
- nenhuma alteração inesperada ficou escondida;
- estado final do Git foi informado.

Em caso de conflito entre velocidade e segurança, escolher segurança.
