-- Sprint 5.7 — Página do Avatar e Publicação para Cliente
-- Seguro: não apaga dados, não executa DROP e apenas garante colunas/índices de publicação.

create extension if not exists pgcrypto;

alter table public.media_combinations add column if not exists companion_id uuid references public.companions(id) on delete set null;
alter table public.media_combinations add column if not exists visible_to_client boolean not null default false;
alter table public.media_combinations add column if not exists admin_only boolean not null default true;
alter table public.media_combinations add column if not exists is_active boolean not null default true;
alter table public.media_combinations add column if not exists price_credits integer not null default 0;
alter table public.media_combinations add column if not exists guided_selections jsonb not null default '[]'::jsonb;
alter table public.media_combinations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.media_combinations add column if not exists updated_at timestamptz not null default now();

create index if not exists media_combinations_companion_visibility_idx
  on public.media_combinations (companion_id, visible_to_client, is_active);

create index if not exists media_combinations_guided_publication_idx
  on public.media_combinations using gin (guided_selections);

alter table public.companion_creation_options add column if not exists visible_to_client boolean not null default false;
alter table public.companion_creation_options add column if not exists is_enabled boolean not null default true;
alter table public.companion_creation_options add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.companion_creation_options add column if not exists updated_at timestamptz not null default now();

create index if not exists companion_creation_options_client_visibility_idx
  on public.companion_creation_options (companion_id, visible_to_client, is_enabled);
