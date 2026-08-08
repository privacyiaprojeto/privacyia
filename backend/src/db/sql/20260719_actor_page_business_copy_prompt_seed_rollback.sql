-- Rollback somente dos itens criados por este hotfix.
delete from public.prompt_dictionaries
where metadata ->> 'source' = 'stage_2_2a_actor_page_seed';
