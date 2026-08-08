-- Hotfix de operação — Página do Ator e Biblioteca de criação
-- Migração idempotente e aditiva. Não altera itens existentes e não inicia produção.

insert into public.prompt_dictionaries (category, label, is_active, metadata)
values
  ('scenario', 'Estúdio elegante', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('scenario', 'Sala moderna', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('scenario', 'Jardim iluminado', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('scenario', 'Praia ao pôr do sol', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('scenario', 'Quarto aconchegante', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),

  ('clothing', 'Roupa casual', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('clothing', 'Vestido elegante', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('clothing', 'Roupa esportiva', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('clothing', 'Camisa social', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('clothing', 'Look de verão', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),

  ('action', 'Olhando para a câmera', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('action', 'Caminhando', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('action', 'Sentada e relaxando', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('action', 'Ajustando o cabelo', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('action', 'Sorrindo suavemente', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),

  ('pose', 'Em pé', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('pose', 'Sentada', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('pose', 'Retrato de meio corpo', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('pose', 'Corpo inteiro', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('pose', 'Retrato aproximado', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),

  ('mood', 'Confiante', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('mood', 'Alegre', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('mood', 'Serena', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('mood', 'Misteriosa', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('mood', 'Descontraída', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),

  ('lighting', 'Luz natural suave', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('lighting', 'Luz de estúdio', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('lighting', 'Luz dourada', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('lighting', 'Ambiente noturno', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb),
  ('lighting', 'Contraluz suave', true, '{"source":"stage_2_2a_actor_page_seed"}'::jsonb)
on conflict do nothing;
