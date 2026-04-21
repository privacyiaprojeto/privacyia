Patch: recuperação de senha via Supabase no frontend.

Arquivos incluídos:
- frontend/package.json
- frontend/src/shared/lib/env.ts
- frontend/src/shared/lib/supabaseBrowser.ts
- frontend/src/features/auth/types.ts
- frontend/src/features/auth/index.ts
- frontend/src/app/router.tsx
- frontend/src/features/auth/pages/ForgotPassword.tsx
- frontend/src/features/auth/pages/ResetPassword.tsx
- frontend/src/features/auth/pages/SignIn.tsx

Depois de colar:
1) rode npm install dentro de frontend
2) confirme as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no frontend/.env
3) reinicie o frontend
