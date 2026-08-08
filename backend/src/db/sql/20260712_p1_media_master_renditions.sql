-- Privacy IA — P1: Master Limpo x Rendições Protegidas
-- Migração aditiva e idempotente. Não gera mídia, não expõe URL pública e não remove registros.
-- Ordem obrigatória: aplicar antes de iniciar os workers P2.

begin;

create extension if not exists pgcrypto;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.actor_profiles(id) on delete restrict,
  combination_id uuid references public.media_combinations(id) on delete set null,
  legacy_variant_id uuid references public.media_asset_variants(id) on delete set null,
  media_type text,
  content_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  checksum_sha256 text,
  master_r2_bucket text not null,
  master_r2_key text not null,
  status text not null default 'qa_pending'
    check (status in ('uploading','processing','qa_pending','available','published','rejected','failed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_r2_bucket, master_r2_key)
);

create unique index if not exists media_assets_legacy_variant_uidx
  on public.media_assets (legacy_variant_id)
  where legacy_variant_id is not null;

create index if not exists media_assets_actor_status_idx
  on public.media_assets (actor_profile_id, status, created_at desc);

create index if not exists media_assets_combination_idx
  on public.media_assets (combination_id, created_at desc)
  where combination_id is not null;

create table if not exists public.media_asset_renditions (
  id uuid primary key default gen_random_uuid(),
  master_asset_id uuid not null references public.media_assets(id) on delete cascade,
  rendition_type text not null
    check (rendition_type in ('preview','forensic_watermark','hls_stream')),
  delivery_id uuid references public.user_media_deliveries(id) on delete set null,
  r2_bucket text not null,
  r2_key text not null,
  status text not null default 'queued'
    check (status in ('queued','processing','available','failed','revoked','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (r2_bucket, r2_key)
);

create index if not exists media_asset_renditions_master_type_idx
  on public.media_asset_renditions (master_asset_id, rendition_type, status, created_at desc);

create index if not exists media_asset_renditions_delivery_idx
  on public.media_asset_renditions (delivery_id, status)
  where delivery_id is not null;

create unique index if not exists media_asset_renditions_preview_uidx
  on public.media_asset_renditions (master_asset_id, rendition_type)
  where rendition_type = 'preview' and delivery_id is null and status <> 'archived';

create unique index if not exists media_asset_renditions_delivery_type_uidx
  on public.media_asset_renditions (master_asset_id, rendition_type, delivery_id)
  where delivery_id is not null and status <> 'archived';

alter table public.media_asset_variants
  add column if not exists master_asset_id uuid references public.media_assets(id) on delete set null;

alter table public.user_media_deliveries
  add column if not exists master_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists rendition_id uuid references public.media_asset_renditions(id) on delete set null;

create index if not exists media_asset_variants_master_asset_idx
  on public.media_asset_variants (master_asset_id)
  where master_asset_id is not null;

create index if not exists user_media_deliveries_master_asset_idx
  on public.user_media_deliveries (master_asset_id)
  where master_asset_id is not null;

create index if not exists user_media_deliveries_rendition_idx
  on public.user_media_deliveries (rendition_id)
  where rendition_id is not null;

-- Backfill seguro: cada asset legado privado passa a apontar para um Master Limpo.
-- O vínculo por legacy_variant_id torna a operação idempotente.
insert into public.media_assets (
  actor_profile_id,
  combination_id,
  legacy_variant_id,
  media_type,
  master_r2_bucket,
  master_r2_key,
  status,
  metadata,
  created_at,
  updated_at
)
select
  v.actor_profile_id,
  v.combination_id,
  v.id,
  v.media_type,
  v.r2_bucket,
  v.r2_key,
  case
    when lower(coalesce(v.status, '')) in ('available','published') then lower(v.status)
    when lower(coalesce(v.status, '')) in ('rejected','failed','archived','processing','qa_pending') then lower(v.status)
    else 'qa_pending'
  end,
  jsonb_build_object(
    'source', 'p1_backfill_media_asset_variants',
    'legacyVariantId', v.id,
    'privateStorage', true,
    'publicUrl', false
  ),
  coalesce(v.created_at, now()),
  coalesce(v.updated_at, now())
from public.media_asset_variants v
where v.r2_bucket is not null
  and v.r2_key is not null
  and not exists (
    select 1
    from public.media_assets a
    where a.legacy_variant_id = v.id
       or (a.master_r2_bucket = v.r2_bucket and a.master_r2_key = v.r2_key)
  );

update public.media_asset_variants v
set master_asset_id = a.id
from public.media_assets a
where v.master_asset_id is null
  and (
    a.legacy_variant_id = v.id
    or (a.master_r2_bucket = v.r2_bucket and a.master_r2_key = v.r2_key)
  );

create or replace function public.touch_media_master_rendition_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists media_assets_touch_updated_at on public.media_assets;
create trigger media_assets_touch_updated_at
before update on public.media_assets
for each row execute function public.touch_media_master_rendition_updated_at();

drop trigger if exists media_asset_renditions_touch_updated_at on public.media_asset_renditions;
create trigger media_asset_renditions_touch_updated_at
before update on public.media_asset_renditions
for each row execute function public.touch_media_master_rendition_updated_at();

alter table public.media_assets enable row level security;
alter table public.media_asset_renditions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'media_assets' and policyname = 'admin_all_media_assets'
  ) then
    create policy admin_all_media_assets on public.media_assets
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'media_asset_renditions' and policyname = 'admin_all_media_asset_renditions'
  ) then
    create policy admin_all_media_asset_renditions on public.media_asset_renditions
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;
end $$;

revoke all on public.media_assets from anon, authenticated;
revoke all on public.media_asset_renditions from anon, authenticated;
grant all on public.media_assets to service_role;
grant all on public.media_asset_renditions to service_role;

comment on table public.media_assets is
  'Master Limpo privado. Nunca deve ser entregue diretamente ao Cliente nem receber URL pública persistente.';
comment on column public.media_assets.master_r2_key is
  'Chave privada do arquivo original no Cloudflare R2.';
comment on table public.media_asset_renditions is
  'Derivados do Master: preview, cópia forense ou stream HLS. A entrega ao Cliente deve apontar para uma rendition.';
comment on column public.media_asset_renditions.r2_key is
  'Chave privada da cópia derivada. Para HLS pode representar o manifest principal; detalhes adicionais ficam em metadata.';

commit;
