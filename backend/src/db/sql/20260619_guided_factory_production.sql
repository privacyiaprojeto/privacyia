-- Sprint 5.6 — Produção Real por Combinações
-- Seguro: não apaga dados, não executa DROP e apenas garante colunas úteis para lote guiado.

create extension if not exists pgcrypto;

alter table public.media_generation_batches add column if not exists companion_id uuid references public.companions(id) on delete set null;
alter table public.media_generation_batches add column if not exists atriz_id uuid;
alter table public.media_generation_batches add column if not exists actress_id uuid;
alter table public.media_generation_batches add column if not exists profile_id uuid;
alter table public.media_generation_batches add column if not exists user_id uuid;
alter table public.media_generation_batches add column if not exists name text;
alter table public.media_generation_batches add column if not exists title text;
alter table public.media_generation_batches add column if not exists label text;
alter table public.media_generation_batches add column if not exists status text not null default 'queued';
alter table public.media_generation_batches add column if not exists source text;
alter table public.media_generation_batches add column if not exists job_origin text;
alter table public.media_generation_batches add column if not exists media_type text;
alter table public.media_generation_batches add column if not exists content_type text;
alter table public.media_generation_batches add column if not exists total_items integer not null default 0;
alter table public.media_generation_batches add column if not exists total_count integer not null default 0;
alter table public.media_generation_batches add column if not exists queued_items integer not null default 0;
alter table public.media_generation_batches add column if not exists processing_items integer not null default 0;
alter table public.media_generation_batches add column if not exists qa_pending_items integer not null default 0;
alter table public.media_generation_batches add column if not exists completed_items integer not null default 0;
alter table public.media_generation_batches add column if not exists failed_items integer not null default 0;
alter table public.media_generation_batches add column if not exists generated_count integer not null default 0;
alter table public.media_generation_batches add column if not exists approved_count integer not null default 0;
alter table public.media_generation_batches add column if not exists rejected_count integer not null default 0;
alter table public.media_generation_batches add column if not exists requested_variants integer not null default 1;
alter table public.media_generation_batches add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.media_generation_batches add column if not exists started_at timestamptz;
alter table public.media_generation_batches add column if not exists completed_at timestamptz;
alter table public.media_generation_batches add column if not exists created_at timestamptz not null default now();
alter table public.media_generation_batches add column if not exists updated_at timestamptz not null default now();

alter table public.media_generation_batch_items add column if not exists batch_id uuid references public.media_generation_batches(id) on delete cascade;
alter table public.media_generation_batch_items add column if not exists companion_id uuid references public.companions(id) on delete set null;
alter table public.media_generation_batch_items add column if not exists atriz_id uuid;
alter table public.media_generation_batch_items add column if not exists actress_id uuid;
alter table public.media_generation_batch_items add column if not exists profile_id uuid;
alter table public.media_generation_batch_items add column if not exists user_id uuid;
alter table public.media_generation_batch_items add column if not exists combination_id uuid references public.media_combinations(id) on delete set null;
alter table public.media_generation_batch_items add column if not exists media_combination_id uuid references public.media_combinations(id) on delete set null;
alter table public.media_generation_batch_items add column if not exists status text not null default 'queued';
alter table public.media_generation_batch_items add column if not exists source text;
alter table public.media_generation_batch_items add column if not exists job_origin text;
alter table public.media_generation_batch_items add column if not exists media_type text;
alter table public.media_generation_batch_items add column if not exists content_type text;
alter table public.media_generation_batch_items add column if not exists item_index integer;
alter table public.media_generation_batch_items add column if not exists variant_number integer;
alter table public.media_generation_batch_items add column if not exists requested_variants integer not null default 1;
alter table public.media_generation_batch_items add column if not exists generated_variants integer not null default 0;
alter table public.media_generation_batch_items add column if not exists approved_variants integer not null default 0;
alter table public.media_generation_batch_items add column if not exists rejected_variants integer not null default 0;
alter table public.media_generation_batch_items add column if not exists prompt text;
alter table public.media_generation_batch_items add column if not exists prompt_text text;
alter table public.media_generation_batch_items add column if not exists prompt_final text;
alter table public.media_generation_batch_items add column if not exists negative_prompt text;
alter table public.media_generation_batch_items add column if not exists generation_params jsonb not null default '{}'::jsonb;
alter table public.media_generation_batch_items add column if not exists generation_payload jsonb not null default '{}'::jsonb;
alter table public.media_generation_batch_items add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.media_generation_batch_items add column if not exists queue_job_id text;
alter table public.media_generation_batch_items add column if not exists queue_job_name text;
alter table public.media_generation_batch_items add column if not exists idempotency_key text;
alter table public.media_generation_batch_items add column if not exists queued_at timestamptz;
alter table public.media_generation_batch_items add column if not exists processing_started_at timestamptz;
alter table public.media_generation_batch_items add column if not exists completed_at timestamptz;
alter table public.media_generation_batch_items add column if not exists created_at timestamptz not null default now();
alter table public.media_generation_batch_items add column if not exists updated_at timestamptz not null default now();

create index if not exists media_generation_batches_companion_id_idx on public.media_generation_batches (companion_id);
create index if not exists media_generation_batches_status_idx on public.media_generation_batches (status);
create index if not exists media_generation_batches_job_origin_idx on public.media_generation_batches (job_origin);
create index if not exists media_generation_batch_items_batch_id_idx on public.media_generation_batch_items (batch_id);
create index if not exists media_generation_batch_items_status_idx on public.media_generation_batch_items (status);
create index if not exists media_generation_batch_items_combination_id_idx on public.media_generation_batch_items (combination_id);

-- Sprint 1 — Contrato Canônico da Fábrica.
-- Cada item físico possui identidade/idempotência próprias e associação direta com o job BullMQ.
create index if not exists media_generation_batch_items_batch_status_idx
  on public.media_generation_batch_items (batch_id, status);

create index if not exists media_generation_batch_items_physical_variant_idx
  on public.media_generation_batch_items (batch_id, combination_id, variant_number);

create unique index if not exists media_generation_batch_items_queue_job_id_uidx
  on public.media_generation_batch_items (queue_job_id)
  where queue_job_id is not null;

create unique index if not exists media_generation_batch_items_idempotency_key_uidx
  on public.media_generation_batch_items (idempotency_key)
  where idempotency_key is not null;
