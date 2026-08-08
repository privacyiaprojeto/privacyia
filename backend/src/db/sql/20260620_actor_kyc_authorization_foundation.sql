-- Sprint 5.9A — Fundação Atores/KYC/Autorização
-- Seguro/aditivo: não apaga dados, não executa DROP TABLE e não cria URL pública para KYC.
-- Objetivo: bloquear produção marcada como real quando o avatar não tiver autorização ativa.

create extension if not exists pgcrypto;

create table if not exists public.actor_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  country_code text not null default 'BR',
  document_last4 text,
  status text not null default 'draft' check (status in ('draft','invited','onboarding','kyc_pending','approved','blocked','rejected','archived')),
  kyc_status text not null default 'not_started' check (kyc_status in ('not_started','pending_review','approved','rejected','expired')),
  production_status text not null default 'not_authorized' check (production_status in ('not_authorized','authorized','suspended')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  blocked_at timestamptz,
  blocked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.actor_onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  email text,
  invite_token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.actor_kyc_cases (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  case_type text not null default 'identity',
  status text not null default 'pending_review' check (status in ('draft','pending_review','approved','rejected','revoked','expired')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.actor_kyc_assets (
  id uuid primary key default gen_random_uuid(),
  kyc_case_id uuid not null references public.actor_kyc_cases(id) on delete restrict,
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  asset_type text not null,
  r2_bucket text not null,
  r2_key text not null,
  original_filename text,
  content_type text,
  byte_size bigint,
  checksum_sha256 text,
  status text not null default 'uploaded' check (status in ('uploaded','registered_dry_run','rejected','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (r2_bucket, r2_key)
);

create table if not exists public.actor_payout_method_requests (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','rejected','archived')),
  payout_type text,
  holder_name text,
  pix_key_masked text,
  bank_name text,
  account_last4 text,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_production_authorizations (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete restrict,
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  kyc_case_id uuid not null references public.actor_kyc_cases(id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked','expired','suspended')),
  authorized_for_content_types text[] not null default array['image','video','short_video','live_action','audio','live_audio'],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  authorization_note text,
  terms_snapshot jsonb not null default '{}'::jsonb,
  finance_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  authorized_by_profile_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists avatar_production_authorizations_one_active_per_companion_idx
  on public.avatar_production_authorizations (companion_id)
  where status = 'active';

create index if not exists actor_profiles_status_idx on public.actor_profiles (status);
create index if not exists actor_profiles_email_idx on public.actor_profiles (lower(email));
create index if not exists actor_invites_actor_profile_id_idx on public.actor_onboarding_invites (actor_profile_id);
create index if not exists actor_invites_status_expires_idx on public.actor_onboarding_invites (status, expires_at);
create index if not exists actor_kyc_cases_actor_profile_id_idx on public.actor_kyc_cases (actor_profile_id);
create index if not exists actor_kyc_cases_status_idx on public.actor_kyc_cases (status);
create index if not exists actor_kyc_assets_case_idx on public.actor_kyc_assets (kyc_case_id);
create index if not exists actor_kyc_assets_actor_idx on public.actor_kyc_assets (actor_profile_id);
create index if not exists actor_payout_requests_actor_idx on public.actor_payout_method_requests (actor_profile_id);
create index if not exists avatar_authorizations_companion_status_idx on public.avatar_production_authorizations (companion_id, status);
create index if not exists avatar_authorizations_actor_idx on public.avatar_production_authorizations (actor_profile_id);

alter table public.media_generation_batches add column if not exists actor_profile_id uuid references public.actor_profiles(id) on delete set null;
alter table public.media_generation_batches add column if not exists avatar_production_authorization_id uuid references public.avatar_production_authorizations(id) on delete set null;
alter table public.media_generation_batches add column if not exists media_origin text;
alter table public.media_generation_batches add column if not exists finance_snapshot jsonb not null default '{}'::jsonb;

alter table public.media_generation_batch_items add column if not exists actor_profile_id uuid references public.actor_profiles(id) on delete set null;
alter table public.media_generation_batch_items add column if not exists avatar_production_authorization_id uuid references public.avatar_production_authorizations(id) on delete set null;
alter table public.media_generation_batch_items add column if not exists media_origin text;
alter table public.media_generation_batch_items add column if not exists finance_snapshot jsonb not null default '{}'::jsonb;

alter table public.media_combinations add column if not exists actor_profile_id uuid references public.actor_profiles(id) on delete set null;
alter table public.media_combinations add column if not exists avatar_production_authorization_id uuid references public.avatar_production_authorizations(id) on delete set null;
alter table public.media_combinations add column if not exists media_origin text;
alter table public.media_combinations add column if not exists finance_snapshot jsonb not null default '{}'::jsonb;

alter table public.media_asset_variants add column if not exists actor_profile_id uuid references public.actor_profiles(id) on delete set null;
alter table public.media_asset_variants add column if not exists avatar_production_authorization_id uuid references public.avatar_production_authorizations(id) on delete set null;
alter table public.media_asset_variants add column if not exists media_origin text;
alter table public.media_asset_variants add column if not exists finance_snapshot jsonb not null default '{}'::jsonb;

create index if not exists media_batches_actor_profile_id_idx on public.media_generation_batches (actor_profile_id);
create index if not exists media_batches_authorization_id_idx on public.media_generation_batches (avatar_production_authorization_id);
create index if not exists media_batch_items_actor_profile_id_idx on public.media_generation_batch_items (actor_profile_id);
create index if not exists media_batch_items_authorization_id_idx on public.media_generation_batch_items (avatar_production_authorization_id);
create index if not exists media_combinations_actor_profile_id_idx on public.media_combinations (actor_profile_id);
create index if not exists media_combinations_authorization_id_idx on public.media_combinations (avatar_production_authorization_id);
create index if not exists media_asset_variants_actor_profile_id_idx on public.media_asset_variants (actor_profile_id);
create index if not exists media_asset_variants_authorization_id_idx on public.media_asset_variants (avatar_production_authorization_id);

alter table public.actor_profiles enable row level security;
alter table public.actor_onboarding_invites enable row level security;
alter table public.actor_kyc_cases enable row level security;
alter table public.actor_kyc_assets enable row level security;
alter table public.actor_payout_method_requests enable row level security;
alter table public.avatar_production_authorizations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_profiles' and policyname = 'admin_all_actor_profiles') then
    create policy admin_all_actor_profiles on public.actor_profiles
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_onboarding_invites' and policyname = 'admin_all_actor_onboarding_invites') then
    create policy admin_all_actor_onboarding_invites on public.actor_onboarding_invites
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_kyc_cases' and policyname = 'admin_all_actor_kyc_cases') then
    create policy admin_all_actor_kyc_cases on public.actor_kyc_cases
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_kyc_assets' and policyname = 'admin_all_actor_kyc_assets') then
    create policy admin_all_actor_kyc_assets on public.actor_kyc_assets
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_payout_method_requests' and policyname = 'admin_all_actor_payout_method_requests') then
    create policy admin_all_actor_payout_method_requests on public.actor_payout_method_requests
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avatar_production_authorizations' and policyname = 'admin_all_avatar_production_authorizations') then
    create policy admin_all_avatar_production_authorizations on public.avatar_production_authorizations
      for all using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;
end $$;
