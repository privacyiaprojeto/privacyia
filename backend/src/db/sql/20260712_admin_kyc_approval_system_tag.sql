-- Admin KYC Approval Desk + System Tag
-- Migração aditiva: preserva requisitos e materiais existentes.

alter table public.mapping_requirements
  add column if not exists system_tag text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mapping_requirements_system_tag_check'
      and conrelid = 'public.mapping_requirements'::regclass
  ) then
    alter table public.mapping_requirements
      add constraint mapping_requirements_system_tag_check
      check (
        system_tag is null
        or system_tag in (
          'face_front',
          'face_profile',
          'body_front',
          'body_back',
          'nsfw_front',
          'nsfw_back',
          'voice_natural',
          'voice_whisper',
          'voice_affectionate',
          'nsfw_voice_moan',
          'video_expression',
          'video_walk'
        )
      );
  end if;
end $$;

create index if not exists mapping_requirements_system_tag_idx
  on public.mapping_requirements (system_tag)
  where system_tag is not null;

comment on column public.mapping_requirements.system_tag is
  'Tag interna escolhida pelo Admin para integração técnica futura. Nunca deve ser exibida no Painel da Atriz.';

-- RLS controla linhas, não colunas. Remove o privilégio amplo e libera aos usuários
-- autenticados apenas os campos públicos do requisito. O backend Admin usa service_role.
revoke select on public.mapping_requirements from authenticated;
grant select (
  id,
  title,
  description,
  media_type,
  is_required,
  is_active,
  created_at,
  updated_at
) on public.mapping_requirements to authenticated;
