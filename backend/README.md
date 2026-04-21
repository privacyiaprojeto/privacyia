# Privacy RPG Backend

Backend Node.js + Express compatível com o front atual do Privacy RPG.

## Estrutura

- `src/server.js`
- `src/app.js`
- `src/config/*`
- `src/routes/*`
- `src/controllers/*`
- `src/services/*`
- `src/middlewares/*`
- `src/validators/*`

## Subida local

```bash
npm install
cp .env.example .env
npm run dev
```

## Observação crítica do front

Em `frontend/src/main.tsx`, o MSW é iniciado automaticamente em ambiente DEV.
Isso intercepta as rotas de auth, chat, feed, galeria, carteira e notificações.
Para testar o backend real, desative o mocking do front.
