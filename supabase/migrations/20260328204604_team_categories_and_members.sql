
-- team_categories
create table if not exists public.team_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6B7280',
  icon text not null default '👤',
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_team_categories_updated_at
  before update on public.team_categories
  for each row execute function public.set_current_timestamp_updated_at();

alter table public.team_categories enable row level security;

create policy "team_categories_select" on public.team_categories
  for select using (
    is_default = true
    or organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_categories_insert" on public.team_categories
  for insert with check (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_categories_update" on public.team_categories
  for update using (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_categories_delete" on public.team_categories
  for delete using (
    is_default = false
    and (
      organization_id = current_organization_id()
      or organization_id in (
        select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
      )
    )
  );

-- Seed default categories
insert into public.team_categories (name, color, icon, is_default, sort_order) values
  ('İSG Uzmanı',              '#3B82F6', '🦺', true,  1),
  ('İşyeri Hekimi',           '#10B981', '🏥', true,  2),
  ('İşveren / Vekili',        '#6366F1', '👔', true,  3),
  ('Çalışan Temsilcisi',      '#F59E0B', '🗣️', true,  4),
  ('Destek Elemanı',          '#8B5CF6', '🔧', true,  5),
  ('Acil Durum Ekip Lideri',  '#EF4444', '🚨', true,  6),
  ('Yangın Söndürme Ekibi',   '#F97316', '🔥', true,  7),
  ('Tahliye Ekibi',           '#06B6D4', '🚪', true,  8),
  ('İlkyardım Ekibi',         '#EC4899', '🩺', true,  9),
  ('Bakım & Teknik',          '#84CC16', '⚙️', true, 10),
  ('Denetçi / Müfettiş',      '#A855F7', '📋', true, 11),
  ('Diğer',                   '#6B7280', '👤', true, 12);

-- team_members
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid not null references public.company_workspaces(id) on delete cascade,
  category_id uuid references public.team_categories(id) on delete set null,
  full_name text not null,
  title text,
  phone text,
  email text,
  cert_number text,
  cert_expiry date,
  notes text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_team_members_updated_at
  before update on public.team_members
  for each row execute function public.set_current_timestamp_updated_at();

create index team_members_workspace_idx on public.team_members(company_workspace_id);
create index team_members_category_idx on public.team_members(category_id);

alter table public.team_members enable row level security;

create policy "team_members_select" on public.team_members
  for select using (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_members_insert" on public.team_members
  for insert with check (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_members_update" on public.team_members
  for update using (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "team_members_delete" on public.team_members
  for delete using (
    organization_id = current_organization_id()
    or organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );
;
