-- Sprint 5.5 — Backend da Fábrica Guiada
-- HOTFIX 5.5.3: compatibilidade com bancos que já tinham prompt_dimensions/prompt_options com code/display_name/technical_snippet NOT NULL.
-- Objetivo: persistir títulos, itens, aplicação por avatar e modelos visíveis para cliente.
-- Seguro: não apaga dados e não executa DROP TABLE.

create extension if not exists pgcrypto;

create table if not exists public.prompt_dimensions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  display_name text,
  label text,
  description text,
  content_types text[] not null default '{}',
  visible_to_client boolean not null default true,
  admin_only boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prompt_dimensions add column if not exists code text;
alter table public.prompt_dimensions add column if not exists name text;
alter table public.prompt_dimensions add column if not exists display_name text;
alter table public.prompt_dimensions add column if not exists label text;
alter table public.prompt_dimensions add column if not exists description text;
alter table public.prompt_dimensions add column if not exists content_types text[] not null default '{}';
alter table public.prompt_dimensions add column if not exists visible_to_client boolean not null default true;
alter table public.prompt_dimensions add column if not exists admin_only boolean not null default false;
alter table public.prompt_dimensions add column if not exists is_active boolean not null default true;
alter table public.prompt_dimensions add column if not exists sort_order integer not null default 0;
alter table public.prompt_dimensions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.prompt_dimensions add column if not exists created_at timestamptz not null default now();
alter table public.prompt_dimensions add column if not exists updated_at timestamptz not null default now();

update public.prompt_dimensions
   set name = coalesce(name, display_name, label, code, 'Título sem nome'),
       display_name = coalesce(display_name, name, label, code, 'Título sem nome'),
       label = coalesce(label, display_name, name, code, 'Título sem nome')
 where name is null or display_name is null or label is null;

update public.prompt_dimensions
   set code = lower(regexp_replace(coalesce(code, name, display_name, label, 'titulo-' || substring(id::text from 1 for 8)), '[^a-zA-Z0-9]+', '-', 'g'))
 where code is null or btrim(code) = '';

alter table public.prompt_dimensions alter column name set not null;
alter table public.prompt_dimensions alter column display_name set not null;
alter table public.prompt_dimensions alter column code set not null;

create table if not exists public.prompt_options (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  dimension_id uuid references public.prompt_dimensions(id) on delete cascade,
  name text not null,
  display_name text,
  label text,
  description text,
  content_types text[] not null default '{}',
  technical_snippet text,
  negative_prompt text,
  visible_to_client boolean not null default true,
  admin_only boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prompt_options add column if not exists code text;
alter table public.prompt_options add column if not exists dimension_id uuid references public.prompt_dimensions(id) on delete cascade;
alter table public.prompt_options add column if not exists name text;
alter table public.prompt_options add column if not exists display_name text;
alter table public.prompt_options add column if not exists label text;
alter table public.prompt_options add column if not exists description text;
alter table public.prompt_options add column if not exists content_types text[] not null default '{}';
alter table public.prompt_options add column if not exists technical_snippet text;
alter table public.prompt_options add column if not exists negative_prompt text;

-- Bancos antigos já tinham technical_snippet obrigatório. Garanta valor e default antes dos inserts seed.
update public.prompt_options
   set technical_snippet = coalesce(technical_snippet, name, display_name, label, code, '')
 where technical_snippet is null;

alter table public.prompt_options alter column technical_snippet set default '';
alter table public.prompt_options alter column technical_snippet set not null;
alter table public.prompt_options add column if not exists visible_to_client boolean not null default true;
alter table public.prompt_options add column if not exists admin_only boolean not null default false;
alter table public.prompt_options add column if not exists is_active boolean not null default true;
alter table public.prompt_options add column if not exists sort_order integer not null default 0;
alter table public.prompt_options add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.prompt_options add column if not exists created_at timestamptz not null default now();
alter table public.prompt_options add column if not exists updated_at timestamptz not null default now();

update public.prompt_options
   set name = coalesce(name, display_name, label, code, 'Item sem nome'),
       display_name = coalesce(display_name, name, label, code, 'Item sem nome'),
       label = coalesce(label, display_name, name, code, 'Item sem nome')
 where name is null or display_name is null or label is null;

update public.prompt_options
   set code = lower(regexp_replace(coalesce(code, name, display_name, label, 'item-' || substring(id::text from 1 for 8)), '[^a-zA-Z0-9]+', '-', 'g'))
 where code is null or btrim(code) = '';

alter table public.prompt_options alter column name set not null;
alter table public.prompt_options alter column display_name set not null;
alter table public.prompt_options alter column code set not null;

create table if not exists public.companion_creation_options (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  dimension_id uuid references public.prompt_dimensions(id) on delete cascade,
  option_id uuid references public.prompt_options(id) on delete cascade,
  content_type text,
  is_enabled boolean not null default true,
  visible_to_client boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companion_creation_options_unique_idx
  on public.companion_creation_options (
    companion_id,
    coalesce(dimension_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(option_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(content_type, '')
  );

create index if not exists prompt_dimensions_content_types_idx on public.prompt_dimensions using gin (content_types);
create index if not exists prompt_options_dimension_id_idx on public.prompt_options (dimension_id);
create index if not exists prompt_options_content_types_idx on public.prompt_options using gin (content_types);
create index if not exists companion_creation_options_companion_id_idx on public.companion_creation_options (companion_id);
create index if not exists companion_creation_options_option_id_idx on public.companion_creation_options (option_id);

alter table public.media_combinations add column if not exists companion_id uuid references public.companions(id) on delete set null;
alter table public.media_combinations add column if not exists visible_to_client boolean not null default false;
alter table public.media_combinations add column if not exists admin_only boolean not null default true;
alter table public.media_combinations add column if not exists guided_selections jsonb not null default '[]'::jsonb;
alter table public.media_combinations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.media_combinations add column if not exists is_active boolean not null default true;
alter table public.media_combinations add column if not exists updated_at timestamptz not null default now();

create index if not exists media_combinations_companion_id_idx on public.media_combinations (companion_id);
create index if not exists media_combinations_visible_to_client_idx on public.media_combinations (visible_to_client);
create index if not exists media_combinations_guided_selections_idx on public.media_combinations using gin (guided_selections);

alter table public.prompt_dimensions enable row level security;
alter table public.prompt_options enable row level security;
alter table public.companion_creation_options enable row level security;

-- Admin total via service role/JWT com role adm; clientes não leem estes cadastros diretamente.
drop policy if exists admin_all_prompt_dimensions on public.prompt_dimensions;
create policy admin_all_prompt_dimensions on public.prompt_dimensions
  for all using (auth.jwt() ->> 'role' = 'adm')
  with check (auth.jwt() ->> 'role' = 'adm');

drop policy if exists admin_all_prompt_options on public.prompt_options;
create policy admin_all_prompt_options on public.prompt_options
  for all using (auth.jwt() ->> 'role' = 'adm')
  with check (auth.jwt() ->> 'role' = 'adm');

drop policy if exists admin_all_companion_creation_options on public.companion_creation_options;
create policy admin_all_companion_creation_options on public.companion_creation_options
  for all using (auth.jwt() ->> 'role' = 'adm')
  with check (auth.jwt() ->> 'role' = 'adm');

-- Seed mínimo e idempotente para o Admin não começar em tela vazia.
insert into public.prompt_dimensions (code, name, display_name, label, description, content_types, visible_to_client, admin_only, sort_order, metadata)
select 'local', 'Local', 'Local', 'Local', 'Onde a cena visual acontece. Usado em imagem, vídeo e live action.', array['image','video','short_video','live_action'], true, false, 10, '{"seed":"sprint_5_5"}'::jsonb
where not exists (select 1 from public.prompt_dimensions where lower(coalesce(code, name)) = 'local');

insert into public.prompt_dimensions (code, name, display_name, label, description, content_types, visible_to_client, admin_only, sort_order, metadata)
select 'estilo-visual', 'Estilo visual', 'Estilo visual', 'Estilo visual', 'Aparência geral da mídia visual.', array['image','video','short_video','live_action'], true, false, 20, '{"seed":"sprint_5_5"}'::jsonb
where not exists (select 1 from public.prompt_dimensions where lower(coalesce(code, name)) in ('estilo-visual', 'estilo visual'));

insert into public.prompt_dimensions (code, name, display_name, label, description, content_types, visible_to_client, admin_only, sort_order, metadata)
select 'humor', 'Humor', 'Humor', 'Humor', 'Clima da performance, voz ou vídeo.', array['audio','live_audio','video','short_video','live_action'], true, false, 30, '{"seed":"sprint_5_5"}'::jsonb
where not exists (select 1 from public.prompt_dimensions where lower(coalesce(code, name)) = 'humor');

insert into public.prompt_dimensions (code, name, display_name, label, description, content_types, visible_to_client, admin_only, sort_order, metadata)
select 'timbre-da-voz', 'Timbre da voz', 'Timbre da voz', 'Timbre da voz', 'Direção de voz para áudio e áudio live.', array['audio','live_audio'], false, true, 40, '{"seed":"sprint_5_5"}'::jsonb
where not exists (select 1 from public.prompt_dimensions where lower(coalesce(code, name)) in ('timbre-da-voz', 'timbre da voz'));

with local_dim as (select id from public.prompt_dimensions where lower(coalesce(code, name)) in ('local') limit 1)
insert into public.prompt_options (code, dimension_id, name, display_name, label, description, content_types, technical_snippet, visible_to_client, admin_only, sort_order, metadata)
select item.code, local_dim.id, item.name, item.name, item.name, item.description, array['image','video','short_video','live_action'], item.technical_snippet, true, false, item.sort_order, '{"seed":"sprint_5_5"}'::jsonb
from local_dim
cross join (values
  ('local-praia', 'Praia', 'Ambiente visual externo.', 'praia', 10),
  ('local-sofa', 'Sofá', 'Ambiente visual interno.', 'sofá', 20),
  ('local-estudio', 'Estúdio', 'Ambiente de produção interna.', 'estúdio', 30)
) as item(code, name, description, technical_snippet, sort_order)
where not exists (
  select 1 from public.prompt_options p where p.dimension_id = local_dim.id and lower(coalesce(p.code, p.name)) in (lower(item.code), lower(item.name))
);

with humor_dim as (select id from public.prompt_dimensions where lower(coalesce(code, name)) = 'humor' limit 1)
insert into public.prompt_options (code, dimension_id, name, display_name, label, description, content_types, technical_snippet, visible_to_client, admin_only, sort_order, metadata)
select item.code, humor_dim.id, item.name, item.name, item.name, item.description, array['audio','live_audio','video','short_video','live_action'], item.technical_snippet, true, false, item.sort_order, '{"seed":"sprint_5_5"}'::jsonb
from humor_dim
cross join (values
  ('humor-carinhoso', 'Carinhoso', 'Clima acolhedor.', 'tom carinhoso', 10),
  ('humor-animado', 'Animado', 'Clima alegre.', 'tom animado', 20),
  ('humor-calmo', 'Calmo', 'Clima tranquilo.', 'tom calmo', 30)
) as item(code, name, description, technical_snippet, sort_order)
where not exists (
  select 1 from public.prompt_options p where p.dimension_id = humor_dim.id and lower(coalesce(p.code, p.name)) in (lower(item.code), lower(item.name))
);
