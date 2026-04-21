Patch: logout + proteção de rotas + sessão por aba

Arquivos para copiar por cima dos atuais:
- frontend/src/shared/stores/useAuthStore.ts
- frontend/src/features/auth/hooks/useLogout.ts
- frontend/src/features/auth/components/ProtectedRoute.tsx
- frontend/src/app/router.tsx
- frontend/src/features/cliente/components/Header.tsx
- frontend/src/features/cliente/perfil/pages/Perfil.tsx
- frontend/src/features/atriz/pages/AtrizDashboard.tsx
- frontend/src/features/adm/pages/AdmDashboard.tsx

O que muda:
1. Logout visível no header e nas telas de perfil/painéis.
2. Rotas /cliente, /atriz e /adm ficam protegidas.
3. Sessão passa a usar sessionStorage. Refresh continua funcionando, mas fechar a aba/janela exige novo login.
4. No logout, o token local e o cache de queries são limpos.
