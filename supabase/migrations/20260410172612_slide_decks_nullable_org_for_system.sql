-- System template'ler organization_id'sine bağlı olmamalı
alter table public.slide_decks alter column organization_id drop not null;
alter table public.slide_decks alter column created_by drop not null;

-- Constraint: ya organization_id var ya da system_template
alter table public.slide_decks drop constraint if exists slide_decks_org_or_system;
alter table public.slide_decks add constraint slide_decks_org_or_system
  check (organization_id is not null or is_system_template = true);

-- RLS politikalarını güncelle
drop policy if exists "slide_decks_select" on public.slide_decks;
create policy "slide_decks_select" on public.slide_decks for select
  using (
    deleted_at is null and (
      is_system_template = true
      or organization_id = public.current_user_org_id()
      or visibility = 'public_template'
    )
  );;
