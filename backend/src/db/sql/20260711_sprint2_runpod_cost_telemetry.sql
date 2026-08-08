-- Privacy IA — Sprint 2: Motor de Custo Real e Telemetria RunPod
-- Migração não destrutiva. Não cria jobs, não altera preços comerciais e não recalcula vendas antigas.
-- Cada media_generation_batch_item acumula o custo real das tentativas ligadas à sua variação física.

begin;

alter table public.media_generation_batch_items
  add column if not exists provider_name text,
  add column if not exists provider_job_id text,
  add column if not exists provider_endpoint_id text,
  add column if not exists provider_worker_id text,
  add column if not exists provider_status text,
  add column if not exists provider_gpu_type text,
  add column if not exists execution_time_ms bigint,
  add column if not exists delay_time_ms bigint,
  add column if not exists actual_cost_usd numeric(18, 8),
  add column if not exists cost_rate_usd_per_second numeric(18, 10),
  add column if not exists cost_source text,
  add column if not exists cost_status text,
  add column if not exists telemetry jsonb not null default '{"version":1,"provider":"runpod","attempts":[],"totals":{}}'::jsonb,
  add column if not exists telemetry_recorded_at timestamptz;

create index if not exists media_generation_batch_items_provider_job_id_idx
  on public.media_generation_batch_items (provider_job_id)
  where provider_job_id is not null;

create index if not exists media_generation_batch_items_cost_status_idx
  on public.media_generation_batch_items (cost_status)
  where cost_status is not null;

create index if not exists media_generation_batch_items_telemetry_recorded_at_idx
  on public.media_generation_batch_items (telemetry_recorded_at desc)
  where telemetry_recorded_at is not null;

comment on column public.media_generation_batch_items.provider_job_id is
  'Último ID de job informado pelo provedor. O histórico completo permanece em telemetry.attempts.';

comment on column public.media_generation_batch_items.execution_time_ms is
  'Tempo de execução acumulado das tentativas RunPod deste item físico, em milissegundos.';

comment on column public.media_generation_batch_items.delay_time_ms is
  'Tempo de fila/delay acumulado informado pelo RunPod, em milissegundos.';

comment on column public.media_generation_batch_items.actual_cost_usd is
  'Custo real acumulado em USD. Usa custo reportado pelo provedor ou executionTime x tarifa configurada.';

comment on column public.media_generation_batch_items.cost_rate_usd_per_second is
  'Tarifa por segundo aplicada à tentativa mais recente quando o provedor não devolve custo direto.';

comment on column public.media_generation_batch_items.telemetry is
  'Envelope imutável por tentativa: IDs, tempos, custo, status, origem da tarifa e tentativa BullMQ.';

create or replace function public.enforce_factory_item_cost_telemetry_immutability()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.actual_cost_usd, 0) < coalesce(old.actual_cost_usd, 0) then
    raise exception 'actual_cost_usd não pode ser reduzido para um item canônico da fábrica';
  end if;

  if not (
    coalesce(new.telemetry -> 'attempts', '[]'::jsonb)
    @> coalesce(old.telemetry -> 'attempts', '[]'::jsonb)
  ) then
    raise exception 'tentativas de telemetria já registradas não podem ser removidas ou reescritas';
  end if;

  return new;
end;
$$;

drop trigger if exists media_generation_batch_items_cost_telemetry_immutable
  on public.media_generation_batch_items;

create trigger media_generation_batch_items_cost_telemetry_immutable
before update of actual_cost_usd, telemetry
on public.media_generation_batch_items
for each row
execute function public.enforce_factory_item_cost_telemetry_immutability();

commit;
