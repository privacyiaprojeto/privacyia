-- Fase 1 — Single Source of Truth / Central de Inteligência
-- Migração aditiva: cria catálogos globais, classifica cenas base e preserva todo histórico existente.

create extension if not exists pgcrypto;

create table if not exists public.prompt_dictionaries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_dictionaries_category_format_check
    check (category ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint prompt_dictionaries_label_length_check
    check (char_length(btrim(label)) between 1 and 160)
);

create unique index if not exists prompt_dictionaries_category_label_unique_idx
  on public.prompt_dictionaries (category, lower(btrim(label)));
create index if not exists prompt_dictionaries_category_active_idx
  on public.prompt_dictionaries (category, is_active, label);

create table if not exists public.audio_storylines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  script text not null,
  voice_tone text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_storylines_title_length_check
    check (char_length(btrim(title)) between 2 and 160),
  constraint audio_storylines_script_length_check
    check (char_length(btrim(script)) between 5 and 12000),
  constraint audio_storylines_voice_tone_length_check
    check (char_length(btrim(voice_tone)) between 2 and 120)
);

create index if not exists audio_storylines_active_created_idx
  on public.audio_storylines (is_active, created_at desc);

alter table public.base_scenes
  add column if not exists scene_type text;

-- Mantém cenas legadas sem classificação (NULL) e exige catálogo controlado nas novas gravações via API.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'base_scenes_scene_type_check'
      and conrelid = 'public.base_scenes'::regclass
  ) then
    alter table public.base_scenes drop constraint base_scenes_scene_type_check;
  end if;

  alter table public.base_scenes
    add constraint base_scenes_scene_type_check
    check (
      scene_type is null
      or scene_type in (
        'scene_solo_f',
        'scene_solo_m',
        'scene_duo_mf',
        'scene_duo_ff',
        'scene_duo_mm',
        'scene_trio'
      )
    );
end $$;

create index if not exists base_scenes_scene_type_active_idx
  on public.base_scenes (scene_type, is_active, created_at desc);

-- Amplia o catálogo técnico do Cofre Biométrico sem expor system_tag no Painel da Atriz.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'mapping_requirements_system_tag_check'
      and conrelid = 'public.mapping_requirements'::regclass
  ) then
    alter table public.mapping_requirements drop constraint mapping_requirements_system_tag_check;
  end if;

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

alter table public.prompt_dictionaries enable row level security;
alter table public.audio_storylines enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_dictionaries'
      and policyname = 'admin_all_prompt_dictionaries'
  ) then
    create policy admin_all_prompt_dictionaries on public.prompt_dictionaries
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audio_storylines'
      and policyname = 'admin_all_audio_storylines'
  ) then
    create policy admin_all_audio_storylines on public.audio_storylines
      for all
      using (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'))
      with check (auth.jwt() ->> 'role' in ('adm','admin','dono','owner','superadmin','super_admin'));
  end if;
end $$;

comment on table public.prompt_dictionaries is
  'Fonte única de verdade para variáveis globais de prompt administradas pela Central de Inteligência.';
comment on table public.audio_storylines is
  'Roteiros reutilizáveis e tons de voz para produtos TTS, separados da operação e da publicação.';
comment on column public.base_scenes.scene_type is
  'Classificação técnica da composição da cena V2V. Cenas legadas podem permanecer NULL até classificação manual.';
