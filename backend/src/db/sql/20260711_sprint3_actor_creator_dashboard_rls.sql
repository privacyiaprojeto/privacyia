-- Sprint 3 — Painel da Atriz / Creator Dashboard
-- Defesa em profundidade, aditiva e não destrutiva.
--
-- O Creator Dashboard NÃO consulta Supabase diretamente. Todas as leituras e escritas
-- sensíveis passam pela API Node.js com service role e são filtradas pelo actor_profile
-- vinculado ao profile autenticado.
--
-- Deliberadamente NÃO criamos policies diretas da atriz para actor_kyc_assets,
-- media_combinations, media_asset_variants ou user_media_deliveries, pois essas tabelas
-- possuem ponteiros de storage, prompts internos e dados comerciais que devem ser
-- sanitizados pelos Read Models do backend.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'actor_profiles'
      and policyname = 'actor_read_own_profile'
  ) then
    create policy actor_read_own_profile on public.actor_profiles
      for select
      using (profile_id = auth.uid());
  end if;
end $$;

comment on policy actor_read_own_profile on public.actor_profiles is
  'Permite à atriz ler somente o próprio perfil base. KYC, produtos, assets, entregas e financeiro permanecem acessíveis apenas por Read Models autenticados da API.';
