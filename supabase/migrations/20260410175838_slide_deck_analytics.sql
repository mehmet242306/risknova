-- Slide deck izlenme analitik tabloları
create table if not exists public.slide_deck_sessions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.slide_decks(id) on delete cascade,
  organization_id uuid,
  viewer_id uuid references auth.users(id) on delete set null,
  viewer_name text,
  viewer_email text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_duration_seconds integer default 0,
  slides_viewed integer default 0,
  completed boolean not null default false,
  user_agent text,
  ip_address text
);

create index if not exists idx_slide_deck_sessions_deck on public.slide_deck_sessions(deck_id, started_at desc);
create index if not exists idx_slide_deck_sessions_viewer on public.slide_deck_sessions(viewer_id) where viewer_id is not null;

-- Slayt bazında süre kaydı
create table if not exists public.slide_view_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.slide_deck_sessions(id) on delete cascade,
  slide_id uuid references public.slides(id) on delete set null,
  slide_order integer,
  time_spent_seconds integer default 0,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_slide_view_events_session on public.slide_view_events(session_id);
create index if not exists idx_slide_view_events_slide on public.slide_view_events(slide_id);

-- RLS
alter table public.slide_deck_sessions enable row level security;
alter table public.slide_view_events enable row level security;

-- Deck sahibi kendi analitiğini görür
drop policy if exists "slide_deck_sessions_select" on public.slide_deck_sessions;
create policy "slide_deck_sessions_select" on public.slide_deck_sessions for select
  using (
    exists (
      select 1 from public.slide_decks d
      where d.id = slide_deck_sessions.deck_id
        and d.organization_id = public.current_user_org_id()
    )
  );

-- Herkes yeni session başlatabilir (public viewing)
drop policy if exists "slide_deck_sessions_insert" on public.slide_deck_sessions;
create policy "slide_deck_sessions_insert" on public.slide_deck_sessions for insert
  with check (true);

drop policy if exists "slide_deck_sessions_update" on public.slide_deck_sessions;
create policy "slide_deck_sessions_update" on public.slide_deck_sessions for update
  using (true);

drop policy if exists "slide_view_events_select" on public.slide_view_events;
create policy "slide_view_events_select" on public.slide_view_events for select
  using (
    exists (
      select 1 from public.slide_deck_sessions s
      join public.slide_decks d on d.id = s.deck_id
      where s.id = slide_view_events.session_id
        and d.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "slide_view_events_insert" on public.slide_view_events;
create policy "slide_view_events_insert" on public.slide_view_events for insert
  with check (true);;
