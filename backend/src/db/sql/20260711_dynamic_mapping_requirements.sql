-- Motor Dinâmico de Requisitos de Mapeamento (KYC)
-- Migração aditiva e compatível com materiais legados.
-- Não remove dados, não cria URL pública e mantém actor_kyc_assets.asset_type apenas como coluna legada/depreciada.

create extension if not exists pgcrypto;

create table if not exists public.mapping_requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  media_type text not null check (media_type in ('image', 'audio', 'video')),
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mapping_requirements_active_idx
  on public.mapping_requirements (is_active, is_required, created_at);

alter table public.actor_kyc_assets
  add column if not exists mapping_requirement_id uuid references public.mapping_requirements(id) on delete restrict;

alter table public.actor_kyc_assets
  add column if not exists rejection_reason text;

alter table public.actor_kyc_assets
  add column if not exists reviewed_at timestamptz;

alter table public.actor_kyc_assets
  add column if not exists reviewer_profile_id uuid references public.profiles(id) on delete set null;

-- Converte automaticamente os tipos legados já existentes em requisitos administráveis.
-- Esses registros são criados como opcionais para não transformar dados históricos em novos bloqueios.
insert into public.mapping_requirements (
  title,
  description,
  media_type,
  is_required,
  is_active,
  created_at,
  updated_at
)
select distinct on (a.asset_type)
  initcap(replace(a.asset_type, '_', ' ')) as title,
  'Requisito migrado automaticamente de um material de mapeamento legado.' as description,
  case
    when lower(coalesce(a.content_type, '')) like 'audio/%'
      or lower(a.asset_type) like '%voice%'
      or lower(a.asset_type) like '%audio%'
      then 'audio'
    when lower(coalesce(a.content_type, '')) like 'video/%'
      or lower(a.asset_type) like '%video%'
      then 'video'
    else 'image'
  end as media_type,
  false as is_required,
  true as is_active,
  coalesce(a.created_at, now()) as created_at,
  now() as updated_at
from public.actor_kyc_assets a
where a.mapping_requirement_id is null
  and nullif(trim(a.asset_type), '') is not null
  and not exists (
    select 1
    from public.mapping_requirements r
    where lower(r.title) = lower(initcap(replace(a.asset_type, '_', ' ')))
  )
order by a.asset_type, a.created_at asc;

update public.actor_kyc_assets a
set mapping_requirement_id = (
  select r.id
  from public.mapping_requirements r
  where lower(r.title) = lower(initcap(replace(a.asset_type, '_', ' ')))
  order by r.created_at asc
  limit 1
)
where a.mapping_requirement_id is null
  and nullif(trim(a.asset_type), '') is not null;

-- O novo vínculo passa a ser a fonte de verdade. A coluna textual antiga permanece apenas para compatibilidade histórica.
alter table public.actor_kyc_assets alter column asset_type drop not null;
comment on column public.actor_kyc_assets.asset_type is
  'LEGADO/DEPRECIADO: novos fluxos devem usar mapping_requirement_id.';

create index if not exists actor_kyc_assets_requirement_idx
  on public.actor_kyc_assets (mapping_requirement_id);

-- Amplia o ciclo de revisão por requisito sem destruir estados já existentes.
alter table public.actor_kyc_assets
  drop constraint if exists actor_kyc_assets_status_check;

alter table public.actor_kyc_assets
  add constraint actor_kyc_assets_status_check
  check (status in (
    'uploaded',
    'pending_review',
    'approved',
    'registered_dry_run',
    'rejected',
    'quarantined',
    'archived'
  ));

alter table public.mapping_requirements enable row level security;

-- Atrizes/atores autenticados leem somente requisitos ativos.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mapping_requirements'
      and policyname = 'authenticated_read_active_mapping_requirements'
  ) then
    create policy authenticated_read_active_mapping_requirements
      on public.mapping_requirements
      for select
      to authenticated
      using (is_active = true);
  end if;
end $$;

-- Admin pode criar, editar, listar inativos e inativar requisitos.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mapping_requirements'
      and policyname = 'admin_manage_mapping_requirements'
  ) then
    create policy admin_manage_mapping_requirements
      on public.mapping_requirements
      for all
      to authenticated
      using (
        lower(coalesce(auth.jwt() ->> 'role', '')) in ('adm', 'admin', 'dono', 'owner', 'superadmin', 'super_admin')
      )
      with check (
        lower(coalesce(auth.jwt() ->> 'role', '')) in ('adm', 'admin', 'dono', 'owner', 'superadmin', 'super_admin')
      );
  end if;
end $$;

grant select on public.mapping_requirements to authenticated;
grant all on public.mapping_requirements to service_role;
