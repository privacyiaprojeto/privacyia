-- Privacy IA — Sprint 1: Contrato Canônico da Fábrica
-- Migração não destrutiva para ambientes que já aplicaram o SQL de produção guiada.
-- Não cria mídia, não enfileira jobs, não altera vendas e não remove registros antigos.

begin;

alter table public.media_generation_batch_items
  add column if not exists queue_job_id text,
  add column if not exists queue_job_name text,
  add column if not exists idempotency_key text,
  add column if not exists queued_at timestamptz,
  add column if not exists processing_started_at timestamptz;

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

comment on column public.media_generation_batch_items.queue_job_id is
  'ID determinístico do job BullMQ associado a este item físico.';

comment on column public.media_generation_batch_items.idempotency_key is
  'Chave canônica para impedir duplicação de execução do mesmo item físico.';

comment on column public.media_generation_batch_items.processing_started_at is
  'Momento em que o item físico foi reservado para processamento real.';

commit;
