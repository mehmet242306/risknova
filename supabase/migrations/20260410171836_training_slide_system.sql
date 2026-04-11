-- ============================================================
-- Training Slide System
-- Slayt deck kütüphanesi, slaytlar, şablonlar ve soru bankası
-- ============================================================

-- ========== slide_decks ==========
create table if not exists public.slide_decks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  title text not null,
  description text,
  category text,
  cover_image_url text,
  theme text default 'modern',
  language text default 'tr',

  visibility text not null default 'private' check (visibility in ('private','organization','public_template')),
  is_template boolean not null default false,
  is_system_template boolean not null default false,

  slide_count integer not null default 0,
  estimated_duration_minutes integer,
  tags text[],

  source text default 'manual' check (source in ('manual','ai_generated','pptx_import','cloned_from_template')),
  source_deck_id uuid references public.slide_decks(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_slide_decks_org on public.slide_decks(organization_id) where deleted_at is null;
create index if not exists idx_slide_decks_created_by on public.slide_decks(created_by) where deleted_at is null;
create index if not exists idx_slide_decks_category on public.slide_decks(category) where deleted_at is null;
create index if not exists idx_slide_decks_system_template on public.slide_decks(is_system_template) where is_system_template = true;

-- ========== slides ==========
create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.slide_decks(id) on delete cascade,

  sort_order integer not null default 0,
  layout text not null default 'title_content' check (layout in (
    'title','title_content','two_column','image_full','image_text','bullet_list',
    'quote','section_header','video','table','cover','summary'
  )),

  content jsonb not null default '{}'::jsonb,

  background_color text,
  background_image_url text,

  speaker_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_slides_deck on public.slides(deck_id, sort_order);

-- ========== slide_deck_revisions ==========
create table if not exists public.slide_deck_revisions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.slide_decks(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  note text
);

create index if not exists idx_slide_deck_revisions_deck on public.slide_deck_revisions(deck_id, revision_number desc);

-- ========== question_bank ==========
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  question_text text not null,
  question_type text not null default 'multiple_choice' check (question_type in (
    'multiple_choice','true_false','short_answer','multi_select'
  )),
  options jsonb,
  correct_answer text,
  explanation text,

  category text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  tags text[],
  points integer default 1,

  language text default 'tr',
  is_active boolean not null default true,

  times_used integer not null default 0,
  correct_rate numeric(5,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_bank_org on public.question_bank(organization_id) where is_active = true;
create index if not exists idx_question_bank_category on public.question_bank(category);

-- ========== slide_media_assets ==========
create table if not exists public.slide_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,

  asset_type text not null check (asset_type in ('image','video','document','audio')),
  file_name text not null,
  storage_path text not null,
  public_url text,
  file_size_bytes bigint,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,

  tags text[],
  category text,

  created_at timestamptz not null default now()
);

create index if not exists idx_slide_media_assets_org on public.slide_media_assets(organization_id);
create index if not exists idx_slide_media_assets_type on public.slide_media_assets(asset_type);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_slide_decks_updated_at on public.slide_decks;
create trigger trg_slide_decks_updated_at before update on public.slide_decks
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_slides_updated_at on public.slides;
create trigger trg_slides_updated_at before update on public.slides
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_question_bank_updated_at on public.question_bank;
create trigger trg_question_bank_updated_at before update on public.question_bank
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- slide_count auto-update
-- ============================================================
create or replace function public.update_deck_slide_count()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.slide_decks
      set slide_count = (select count(*) from public.slides where deck_id = old.deck_id),
          updated_at = now()
      where id = old.deck_id;
    return old;
  else
    update public.slide_decks
      set slide_count = (select count(*) from public.slides where deck_id = new.deck_id),
          updated_at = now()
      where id = new.deck_id;
    return new;
  end if;
end;
$$ language plpgsql;

drop trigger if exists trg_slides_count on public.slides;
create trigger trg_slides_count
  after insert or delete on public.slides
  for each row execute function public.update_deck_slide_count();

-- ============================================================
-- RLS
-- ============================================================
alter table public.slide_decks enable row level security;
alter table public.slides enable row level security;
alter table public.slide_deck_revisions enable row level security;
alter table public.question_bank enable row level security;
alter table public.slide_media_assets enable row level security;

create or replace function public.current_user_org_id()
returns uuid language sql stable as $$
  select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1;
$$;

drop policy if exists "slide_decks_select" on public.slide_decks;
create policy "slide_decks_select" on public.slide_decks for select
  using (
    deleted_at is null and (
      is_system_template = true
      or organization_id = public.current_user_org_id()
      or visibility = 'public_template'
    )
  );

drop policy if exists "slide_decks_insert" on public.slide_decks;
create policy "slide_decks_insert" on public.slide_decks for insert
  with check (
    organization_id = public.current_user_org_id()
    and created_by = auth.uid()
  );

drop policy if exists "slide_decks_update" on public.slide_decks;
create policy "slide_decks_update" on public.slide_decks for update
  using (
    organization_id = public.current_user_org_id()
    and (created_by = auth.uid() or visibility = 'organization')
  );

drop policy if exists "slide_decks_delete" on public.slide_decks;
create policy "slide_decks_delete" on public.slide_decks for delete
  using (
    organization_id = public.current_user_org_id()
    and created_by = auth.uid()
  );

drop policy if exists "slides_select" on public.slides;
create policy "slides_select" on public.slides for select
  using (
    exists (
      select 1 from public.slide_decks d
      where d.id = slides.deck_id
        and d.deleted_at is null
        and (
          d.is_system_template = true
          or d.organization_id = public.current_user_org_id()
          or d.visibility = 'public_template'
        )
    )
  );

drop policy if exists "slides_insert" on public.slides;
create policy "slides_insert" on public.slides for insert
  with check (
    exists (
      select 1 from public.slide_decks d
      where d.id = slides.deck_id
        and d.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "slides_update" on public.slides;
create policy "slides_update" on public.slides for update
  using (
    exists (
      select 1 from public.slide_decks d
      where d.id = slides.deck_id
        and d.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "slides_delete" on public.slides;
create policy "slides_delete" on public.slides for delete
  using (
    exists (
      select 1 from public.slide_decks d
      where d.id = slides.deck_id
        and d.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "slide_deck_revisions_all" on public.slide_deck_revisions;
create policy "slide_deck_revisions_all" on public.slide_deck_revisions for all
  using (
    exists (
      select 1 from public.slide_decks d
      where d.id = slide_deck_revisions.deck_id
        and d.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "question_bank_select" on public.question_bank;
create policy "question_bank_select" on public.question_bank for select
  using (is_active and organization_id = public.current_user_org_id());

drop policy if exists "question_bank_mutate" on public.question_bank;
create policy "question_bank_mutate" on public.question_bank for all
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "slide_media_assets_all" on public.slide_media_assets;
create policy "slide_media_assets_all" on public.slide_media_assets for all
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

-- Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.slide_decks;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.slides;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.question_bank;
    exception when duplicate_object then null; end;
  end if;
end $$;;
