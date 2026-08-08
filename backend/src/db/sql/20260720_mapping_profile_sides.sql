-- Privacy IA — Stage 2.2D1 Hotfix
-- Separa o antigo requisito genérico de perfil em lado esquerdo e lado direito.
-- Compatibilidade: preserva materiais antigos, não remove arquivos e não altera actor_kyc_assets.

begin;

-- Amplia o catálogo interno de tags sem expor tags técnicas ao Painel Ator.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'mapping_requirements_system_tag_check'
      and conrelid = 'public.mapping_requirements'::regclass
  ) then
    alter table public.mapping_requirements
      drop constraint mapping_requirements_system_tag_check;
  end if;

  alter table public.mapping_requirements
    add constraint mapping_requirements_system_tag_check
    check (
      system_tag is null
      or system_tag in (
        'face_front',
        'face_profile',
        'face_profile_left',
        'face_profile_right',
        'body_front',
        'body_back',
        'nsfw_front',
        'nsfw_back',
        'nsfw_closeup_front',
        'nsfw_closeup_back',
        'voice_natural',
        'voice_whisper',
        'voice_affectionate',
        'nsfw_voice_moan',
        'video_expression',
        'video_walk'
      )
    );
end $$;

-- O requisito antigo permanece no histórico, mas deixa de ser oferecido em novos envios.
-- Qualquer arquivo já ligado a ele continua preservado no banco e no R2.
update public.mapping_requirements
set
  title = 'Foto de Perfil (legado — lado não identificado)',
  description = 'Material histórico anterior à separação entre lado esquerdo e lado direito.',
  is_required = false,
  is_active = false,
  updated_at = now()
where system_tag = 'face_profile'
  and is_active = true;

-- Cria ou normaliza o requisito de perfil esquerdo.
insert into public.mapping_requirements (
  title,
  description,
  media_type,
  system_tag,
  is_required,
  is_active,
  created_at,
  updated_at
)
select
  'Foto de Perfil — Lado Esquerdo',
  'Fotografe o lado esquerdo do rosto, com boa iluminação e sem filtros que alterem a identidade.',
  'image',
  'face_profile_left',
  true,
  true,
  coalesce((select min(created_at) from public.mapping_requirements where system_tag = 'face_profile'), now()),
  now()
where not exists (
  select 1 from public.mapping_requirements where system_tag = 'face_profile_left'
);

update public.mapping_requirements
set
  title = 'Foto de Perfil — Lado Esquerdo',
  description = 'Fotografe o lado esquerdo do rosto, com boa iluminação e sem filtros que alterem a identidade.',
  media_type = 'image',
  is_required = true,
  is_active = true,
  updated_at = now()
where system_tag = 'face_profile_left';

-- Cria ou normaliza o requisito de perfil direito.
insert into public.mapping_requirements (
  title,
  description,
  media_type,
  system_tag,
  is_required,
  is_active,
  created_at,
  updated_at
)
select
  'Foto de Perfil — Lado Direito',
  'Fotografe o lado direito do rosto, com boa iluminação e sem filtros que alterem a identidade.',
  'image',
  'face_profile_right',
  true,
  true,
  coalesce((select min(created_at) + interval '1 millisecond' from public.mapping_requirements where system_tag = 'face_profile'), now()),
  now()
where not exists (
  select 1 from public.mapping_requirements where system_tag = 'face_profile_right'
);

update public.mapping_requirements
set
  title = 'Foto de Perfil — Lado Direito',
  description = 'Fotografe o lado direito do rosto, com boa iluminação e sem filtros que alterem a identidade.',
  media_type = 'image',
  is_required = true,
  is_active = true,
  updated_at = now()
where system_tag = 'face_profile_right';

-- Fail-closed: deve existir exatamente um requisito ativo para cada lado.
do $$
begin
  if (
    select count(*)
    from public.mapping_requirements
    where system_tag = 'face_profile_left'
      and is_active = true
      and is_required = true
      and media_type = 'image'
  ) <> 1 then
    raise exception 'ABORTADO: requisito ativo de perfil esquerdo não ficou único e obrigatório.';
  end if;

  if (
    select count(*)
    from public.mapping_requirements
    where system_tag = 'face_profile_right'
      and is_active = true
      and is_required = true
      and media_type = 'image'
  ) <> 1 then
    raise exception 'ABORTADO: requisito ativo de perfil direito não ficou único e obrigatório.';
  end if;

  if exists (
    select 1
    from public.mapping_requirements
    where system_tag = 'face_profile'
      and is_active = true
  ) then
    raise exception 'ABORTADO: requisito genérico de perfil continua ativo.';
  end if;
end $$;

commit;

select
  system_tag,
  title,
  media_type,
  is_required,
  is_active
from public.mapping_requirements
where system_tag in ('face_profile', 'face_profile_left', 'face_profile_right')
order by system_tag;
