-- Privacy IA — ROLLBACK MANUAL — Stage 2.2A LoRA Gatekeeper
-- Execute somente após remover/desativar o código do patch e confirmar que não existem adapters/runs necessários.
-- Esta migration NÃO é executada automaticamente pelo APPLY_PATCH.ps1.

drop table if exists public.actor_identity_adapters;
drop table if exists public.actor_identity_training_runs;
