Patch mínimo para corrigir a proteção de rotas em produção.

Arquivo incluído:
- frontend/src/app/router.tsx

O que corrige:
- impede acesso direto a /cliente/*, /atriz e /adm sem token + user no store
- redireciona para /sign-in?redirect=... antes de disparar chamadas protegidas
- respeita papel do usuário (cliente, atriz, adm)

Como aplicar:
1. Copie o arquivo por cima do projeto atual.
2. Faça novo build do frontend.
3. Refaça o deploy no Netlify.
