create table if not exists public.library_contents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null,
  subcategory text not null,
  content_type text,
  file_url text,
  tags text[] not null default '{}'::text[],
  sector text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.company_library_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_identities(id) on delete cascade,
  content_id uuid not null references public.library_contents(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  notes text,
  constraint company_library_items_company_content_unique unique (company_id, content_id)
);

create index if not exists idx_library_contents_category
  on public.library_contents (category);

create index if not exists idx_library_contents_subcategory
  on public.library_contents (subcategory);

create index if not exists idx_library_contents_content_type
  on public.library_contents (content_type);

create index if not exists idx_library_contents_tags_gin
  on public.library_contents using gin (tags);

create index if not exists idx_library_contents_sector_gin
  on public.library_contents using gin (sector);

create index if not exists idx_company_library_items_company_id
  on public.company_library_items (company_id);

create index if not exists idx_company_library_items_content_id
  on public.company_library_items (content_id);

alter table public.library_contents enable row level security;
alter table public.company_library_items enable row level security;

drop policy if exists "library_contents_select_authenticated" on public.library_contents;
create policy "library_contents_select_authenticated"
on public.library_contents
for select
to authenticated
using (true);

drop policy if exists "company_library_items_select_own_org" on public.company_library_items;
create policy "company_library_items_select_own_org"
on public.company_library_items
for select
to authenticated
using (
  exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = company_library_items.company_id
      and cw.organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "company_library_items_insert_own_org" on public.company_library_items;
create policy "company_library_items_insert_own_org"
on public.company_library_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = company_library_items.company_id
      and cw.organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "company_library_items_update_own_org" on public.company_library_items;
create policy "company_library_items_update_own_org"
on public.company_library_items
for update
to authenticated
using (
  exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = company_library_items.company_id
      and cw.organization_id = public.current_user_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = company_library_items.company_id
      and cw.organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "company_library_items_delete_own_org" on public.company_library_items;
create policy "company_library_items_delete_own_org"
on public.company_library_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = company_library_items.company_id
      and cw.organization_id = public.current_user_organization_id()
  )
);
