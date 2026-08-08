-- Estúdio de Direção de Cena (V2V/I2V) + Repasse Triplo
-- Migração aditiva: não remove tabelas, não cria URL pública e não executa produção.

create extension if not exists pgcrypto;

create table if not exists public.base_scenes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- Apesar do nome legado solicitado, este campo armazena somente a chave privada do objeto no R2.
  -- Nunca grave URL pública ou URL assinada persistente aqui.
  video_url text not null,
  r2_bucket text not null,
  slots_count integer not null default 2 check (slots_count between 1 and 3),
  content_type text not null default 'video/mp4',
  byte_size bigint,
  upload_status text not null default 'uploading' check (upload_status in ('uploading','ready','failed')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (r2_bucket, video_url)
);

create index if not exists base_scenes_active_created_idx
  on public.base_scenes (is_active, created_at desc);

create table if not exists public.scene_directions (
  id uuid primary key default gen_random_uuid(),
  base_scene_id uuid references public.base_scenes(id) on delete restrict,
  production_mode text not null check (production_mode in ('v2v','i2v')),
  slots_count integer not null check (slots_count between 1 and 3),
  cast_slots jsonb not null default '[]'::jsonb,
  direction_prompt text not null,
  status text not null default 'planned' check (status in ('planned','queued','processing','qa_pending','completed','failed','cancelled')),
  queue_job_id text,
  output_r2_bucket text,
  output_r2_key text,
  output_asset_id uuid references public.media_asset_variants(id) on delete set null,
  error_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scene_directions_status_created_idx
  on public.scene_directions (status, created_at desc);
create index if not exists scene_directions_base_scene_idx
  on public.scene_directions (base_scene_id);

create table if not exists public.product_splits (
  id uuid primary key default gen_random_uuid(),
  -- No catálogo atual, um produto vendável é uma media_asset_variant.
  product_id uuid not null references public.media_asset_variants(id) on delete cascade,
  beneficiary_id uuid not null,
  beneficiary_type text not null check (beneficiary_type in ('actor','company')),
  beneficiary_name_snapshot text,
  split_percentage numeric(5,2) not null check (split_percentage >= 0 and split_percentage <= 100),
  display_on_storefront boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, beneficiary_type, beneficiary_id)
);

create index if not exists product_splits_product_idx
  on public.product_splits (product_id, sort_order);
create index if not exists product_splits_beneficiary_storefront_idx
  on public.product_splits (beneficiary_type, beneficiary_id, display_on_storefront);

create or replace function public.validate_product_split_limit()
returns trigger
language plpgsql
as $$
declare
  beneficiary_count integer;
  percentage_total numeric(7,2);
begin
  select count(*), coalesce(sum(split_percentage), 0)
    into beneficiary_count, percentage_total
  from public.product_splits
  where product_id = new.product_id
    and id <> coalesce(new.id, gen_random_uuid());

  beneficiary_count := beneficiary_count + 1;
  percentage_total := percentage_total + new.split_percentage;

  if beneficiary_count > 3 then
    raise exception 'Um produto pode ter no máximo 3 beneficiários.';
  end if;

  if percentage_total > 100 then
    raise exception 'A soma dos repasses não pode ultrapassar 100%%.';
  end if;

  return new;
end;
$$;

drop trigger if exists product_splits_limit_trigger on public.product_splits;
create trigger product_splits_limit_trigger
before insert or update on public.product_splits
for each row execute function public.validate_product_split_limit();

-- Substituição atômica do quadro de repasses. O backend chama esta RPC com service role.
create or replace function public.replace_product_splits(
  p_product_id uuid,
  p_splits jsonb,
  p_admin_profile_id uuid default null
)
returns setof public.product_splits
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  split_count integer;
  split_total numeric(7,2);
begin
  if not exists (select 1 from public.media_asset_variants where id = p_product_id) then
    raise exception 'Produto não encontrado.';
  end if;

  if jsonb_typeof(coalesce(p_splits, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de repasses inválida.';
  end if;

  split_count := jsonb_array_length(coalesce(p_splits, '[]'::jsonb));
  if split_count > 3 then
    raise exception 'Um produto pode ter no máximo 3 beneficiários.';
  end if;

  select coalesce(sum((value->>'splitPercentage')::numeric), 0)
    into split_total
  from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb));

  if split_total > 100 then
    raise exception 'A soma dos repasses não pode ultrapassar 100%%.';
  end if;

  delete from public.product_splits where product_id = p_product_id;

  for item in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    insert into public.product_splits (
      product_id,
      beneficiary_id,
      beneficiary_type,
      beneficiary_name_snapshot,
      split_percentage,
      display_on_storefront,
      sort_order,
      created_by_profile_id,
      updated_by_profile_id,
      metadata
    ) values (
      p_product_id,
      (item->>'beneficiaryId')::uuid,
      item->>'beneficiaryType',
      nullif(item->>'beneficiaryName', ''),
      (item->>'splitPercentage')::numeric,
      coalesce((item->>'displayOnStorefront')::boolean, true),
      coalesce((item->>'sortOrder')::integer, 0),
      p_admin_profile_id,
      p_admin_profile_id,
      jsonb_build_object('source', 'admin_scene_direction_splits')
    );
  end loop;

  return query
    select * from public.product_splits
    where product_id = p_product_id
    order by sort_order, created_at;
end;
$$;

alter table public.base_scenes enable row level security;
alter table public.scene_directions enable row level security;
alter table public.product_splits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'base_scenes' and policyname = 'admin_all_base_scenes'
  ) then
    create policy admin_all_base_scenes on public.base_scenes
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scene_directions' and policyname = 'admin_all_scene_directions'
  ) then
    create policy admin_all_scene_directions on public.scene_directions
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_splits' and policyname = 'admin_all_product_splits'
  ) then
    create policy admin_all_product_splits on public.product_splits
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;
end $$;

revoke all on function public.replace_product_splits(uuid, jsonb, uuid) from public;
grant execute on function public.replace_product_splits(uuid, jsonb, uuid) to service_role;

comment on column public.base_scenes.video_url is
  'Chave privada do objeto no Cloudflare R2. Não contém URL pública nem URL assinada persistente.';
comment on table public.product_splits is
  'Até 3 beneficiários por produto; o percentual restante pertence à plataforma.';
