-- =============================================================================
-- Locations and Departments — physical site and organizational unit taxonomies
-- =============================================================================
-- Purpose:
-- - `locations` models physical sites (yerleşke, şube, bina, saha).
-- - `departments` models organizational units within an account, with optional
--   hierarchy (parent_department_id) for deep structures like
--   "Üretim → Montaj → Bant 1".
-- - Both are org-scoped (NOT NULL organization_id).
-- - company_workspace_id is nullable: an OSGB's head office may exist without
--   being tied to a specific customer workspace.
-- - FKs added to personnel, risk_assessments, incidents (all nullable — no
--   forced backfill).
-- - RLS via is_account_owner_or_admin() OR can_access_company_workspace(),
--   aligned with 20260419201500_account_model_authorization_transform.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  district text,
  is_primary boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id)
);

create index if not exists idx_locations_org
  on public.locations(organization_id);
create index if not exists idx_locations_workspace
  on public.locations(company_workspace_id) where company_workspace_id is not null;
create index if not exists idx_locations_active
  on public.locations(organization_id, is_archived);

alter table public.locations enable row level security;

-- ---------------------------------------------------------------------------
-- departments (hierarchical)
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  parent_department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id)
);

create index if not exists idx_departments_org
  on public.departments(organization_id);
create index if not exists idx_departments_workspace
  on public.departments(company_workspace_id) where company_workspace_id is not null;
create index if not exists idx_departments_parent
  on public.departments(parent_department_id) where parent_department_id is not null;
create index if not exists idx_departments_active
  on public.departments(organization_id, is_archived);

alter table public.departments enable row level security;

-- ---------------------------------------------------------------------------
-- Cross references on existing tables (nullable; no backfill)
-- ---------------------------------------------------------------------------
alter table public.personnel
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_personnel_location
  on public.personnel(location_id) where location_id is not null;
create index if not exists idx_personnel_department
  on public.personnel(department_id) where department_id is not null;

alter table public.risk_assessments
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists idx_risk_assessments_location
  on public.risk_assessments(location_id) where location_id is not null;

alter table public.incidents
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_incidents_location
  on public.incidents(location_id) where location_id is not null;
create index if not exists idx_incidents_department
  on public.incidents(department_id) where department_id is not null;

-- ---------------------------------------------------------------------------
-- RLS policies: account owner/admin full control, workspace access can read
-- ---------------------------------------------------------------------------
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (company_workspace_id is not null and public.can_access_company_workspace(company_workspace_id))
);

drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (company_workspace_id is not null and public.can_access_company_workspace(company_workspace_id))
);

drop policy if exists departments_insert on public.departments;
create policy departments_insert on public.departments for insert to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists departments_update on public.departments;
create policy departments_update on public.departments for update to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists departments_delete on public.departments;
create policy departments_delete on public.departments for delete to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (only if the generic helper exists)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'touch_updated_at_generic'
  ) then
    execute 'drop trigger if exists trg_locations_touch_updated_at on public.locations';
    execute 'create trigger trg_locations_touch_updated_at before update on public.locations for each row execute function public.touch_updated_at_generic()';
    execute 'drop trigger if exists trg_departments_touch_updated_at on public.departments';
    execute 'create trigger trg_departments_touch_updated_at before update on public.departments for each row execute function public.touch_updated_at_generic()';
  elsif exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'touch_updated_at'
  ) then
    execute 'drop trigger if exists trg_locations_touch_updated_at on public.locations';
    execute 'create trigger trg_locations_touch_updated_at before update on public.locations for each row execute function public.touch_updated_at()';
    execute 'drop trigger if exists trg_departments_touch_updated_at on public.departments';
    execute 'create trigger trg_departments_touch_updated_at before update on public.departments for each row execute function public.touch_updated_at()';
  end if;
end $$;

commit;
