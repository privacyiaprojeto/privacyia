# Privacy IA — Local Validation Harness V1

## Finalidade

`tools/agent-verify-local.mjs` é o Harness local para validação segura de alterações feitas por agentes. Ele opera exclusivamente em modo `SAFE_LOCAL`, com gates fail-closed, e não autoriza nenhuma operação `EXECUTE_REAL`.

Execute a partir de qualquer diretório dentro do repositório:

```bash
node tools/agent-verify-local.mjs
```

## O que executa

- detecta a raiz Git, branch, HEAD e `git status --short`;
- bloqueia execução em `main` e `master`;
- inspeciona somente `process.env`, sem carregar `.env`, e bloqueia flags inequivocamente permissivas de workers, Redis externo, RunPod, treino ou preview LoRA;
- bloqueia o build quando `frontend/package.json`, `frontend/package-lock.json` ou `frontend/vite.config.ts` possui alteração staged, unstaged ou untracked em relação ao HEAD;
- lê `frontend/package.json` localmente e exige `scripts.build` exatamente igual a `vite build`, sem scripts `prebuild` ou `postbuild`;
- obtém pelo Git os arquivos `.js` rastreados e novos/não ignorados do backend e executa `node --check` individualmente, sem importar módulos;
- confirma que `frontend/dist` está ignorado e executa somente `npm run build` em `frontend/`;
- executa `git diff --check` e `git diff --cached --check`;
- reporta ao final os arquivos modificados e não rastreados.

O Harness não exige working tree limpo. O build pode criar ou atualizar apenas a saída local ignorada em `frontend/dist`.

## O que não executa

O Harness não inicia backend, frontend dev/preview, workers, Redis, Docker ou GitHub Actions. Não importa `app.js` ou `server.js`, não instala dependências e não executa lint ou typecheck. Seu código não implementa clientes HTTP ou SDKs externos para Supabase, RunPod, R2, OpenRouter ou outros serviços; não treina ou produz mídia; não realiza operação financeira; e não executa `git add`, commit, push ou merge.

A V1 não fornece isolamento de rede em nível de sistema operacional. Por isso, as superfícies capazes de alterar o código executado por `npm run build` ficam congeladas pelo gate Git e qualquer mudança exige review humano separado. A saída registra essa limitação como:

```text
external_operations_in_harness=false
network_isolation=NOT_ENFORCED
```

Na V1, a ausência de configuração homologada é reportada explicitamente como:

```text
frontend_lint=NOT_CONFIGURED
frontend_typecheck=NOT_CONFIGURED
```

## Resultados

- `AGENT_VERIFY_LOCAL_PASS`: todas as validações locais configuradas passaram.
- `AGENT_VERIFY_LOCAL_FAIL`: uma validação local falhou, como sintaxe, build ou diff check.
- `AGENT_VERIFY_BLOCKED`: um gate de segurança bloqueou a execução, por branch protegida, ambiente perigoso, superfície de build alterada ou contrato NPM divergente.

Qualquer resultado diferente de PASS encerra com exit code não zero. Um build com exit code zero passa mesmo que o Vite emita avisos de bundle ou chunk.

`PASS` não equivale a homologação funcional, não abre gates de produção, não autoriza `EXECUTE_REAL` e não substitui review humano nem validações específicas do domínio. Também não deve ser interpretado como prova forense de ausência de tráfego de rede do processo inteiro.
