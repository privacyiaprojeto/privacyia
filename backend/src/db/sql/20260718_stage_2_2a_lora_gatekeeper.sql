-- Privacy IA — Stage 2.2A — LoRA Gatekeeper / VACE Identity Training Readiness
-- Aditiva, reversível e fail-closed. Não dispara RunPod, não cria URL pública e não move objetos R2.

create extension if not exists pgcrypto;

create table if not exists public.actor_identity_training_runs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  kyc_case_id uuid not null references public.actor_kyc_cases(id) on delete restrict,
  mode text not null default 'readiness_dry_run'
    check (mode in ('readiness_dry_run','training_controlled')),
  status text not null default 'dataset_pending'
    check (status in (
      'dataset_pending','dataset_ready','dry_run_ready','training_pending','training_in_progress',
      'training_completed','qa_pending','approved','failed','cancelled','revoked'
    )),
  dataset_manifest jsonb not null default '{}'::jsonb,
  dataset_manifest_sha256 text,
  dataset_r2_bucket text,
  dataset_r2_prefix text,
  base_model text not null default 'Wan-AI/Wan2.1-VACE-14B',
  base_model_fingerprint text,
  training_engine text not null default 'DiffSynth-Studio',
  training_engine_commit text not null,
  trigger_token text not null,
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dataset_r2_bucket is null or dataset_r2_bucket !~* '^https?://'),
  check (dataset_r2_prefix is null or dataset_r2_prefix !~* '^https?://'),
  check (dataset_manifest_sha256 is null or dataset_manifest_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists public.actor_identity_adapters (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.actor_profiles(id) on delete restrict,
  training_run_id uuid not null references public.actor_identity_training_runs(id) on delete restrict,
  adapter_version integer not null check (adapter_version > 0),
  status text not null default 'draft'
    check (status in ('draft','training','qa_pending','approved','rejected','revoked','superseded')),
  qa_status text not null default 'pending'
    check (qa_status in ('pending','approved','rejected')),
  base_model text not null,
  base_model_fingerprint text not null,
  r2_bucket text not null,
  r2_key text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  trigger_token text not null,
  rank integer not null default 32 check (rank between 1 and 256),
  alpha integer not null default 32 check (alpha between 1 and 512),
  recommended_strength_model numeric(5,4) not null default 0.6500
    check (recommended_strength_model > 0 and recommended_strength_model <= 2),
  consent_version text not null,
  training_engine text not null,
  training_engine_commit text not null,
  manifest jsonb not null default '{}'::jsonb,
  qa_report jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles(id) on delete set null,
  revocation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_profile_id, adapter_version),
  unique (r2_bucket, r2_key),
  check (r2_bucket !~* '^https?://'),
  check (r2_key !~* '^https?://'),
  check (position('/' in r2_key) > 0),
  check (status <> 'approved' or (qa_status = 'approved' and approved_at is not null)),
  check (qa_status <> 'approved' or (status = 'approved' and approved_at is not null)),
  check (revoked_at is null or status in ('revoked','superseded'))
);

create index if not exists actor_identity_training_runs_actor_created_idx
  on public.actor_identity_training_runs (actor_profile_id, created_at desc);
create index if not exists actor_identity_training_runs_status_idx
  on public.actor_identity_training_runs (status, created_at desc);
create unique index if not exists actor_identity_training_runs_one_active_per_actor_idx
  on public.actor_identity_training_runs (actor_profile_id)
  where status in (
    'dataset_pending','dataset_ready','dry_run_ready','training_pending','training_in_progress',
    'training_completed','qa_pending'
  );
create index if not exists actor_identity_adapters_actor_status_idx
  on public.actor_identity_adapters (actor_profile_id, status, qa_status, created_at desc);
create index if not exists actor_identity_adapters_training_run_idx
  on public.actor_identity_adapters (training_run_id);

create unique index if not exists actor_identity_adapters_one_active_approved_idx
  on public.actor_identity_adapters (actor_profile_id, base_model)
  where status = 'approved' and qa_status = 'approved' and revoked_at is null;

alter table public.actor_identity_training_runs enable row level security;
alter table public.actor_identity_adapters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'actor_identity_training_runs'
      and policyname = 'admin_all_actor_identity_training_runs'
  ) then
    create policy admin_all_actor_identity_training_runs
      on public.actor_identity_training_runs
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'actor_identity_adapters'
      and policyname = 'admin_all_actor_identity_adapters'
  ) then
    create policy admin_all_actor_identity_adapters
      on public.actor_identity_adapters
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;
end $$;

comment on table public.actor_identity_training_runs is
  'Stage 2.2A: histórico de preparação/treino da LoRA de identidade. Nenhum status desta tabela sozinho libera produção.';
comment on table public.actor_identity_adapters is
  'Adapters LoRA de identidade privados. Produção de vídeo exige status e QA approved, consentimento, hash e compatibilidade do modelo-base.';
