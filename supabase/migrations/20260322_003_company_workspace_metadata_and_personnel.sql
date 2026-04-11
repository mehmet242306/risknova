-- ============================================================
-- Migration 003: company_workspace metadata + company_personnel
-- ============================================================
-- Adds a metadata JSONB column to company_workspaces for
-- operational data (employee counts, risk scores, locations,
-- departments, etc.) and creates a company_personnel table
-- for real personnel persistence.
-- ============================================================

-- 1. Add metadata JSONB column to company_workspaces
alter table public.company_workspaces
  add column if not exists metadata jsonb not null default '{}'::jsonb;
comment on column public.company_workspaces.metadata is
  'Operational data: employeeCount, locations, departments, risk scores, training counts, shift model, contact info, etc.';
-- 2. Add a restore function for archived companies
create or replace function public.restore_archived_company_identity(
  p_company_identity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  -- Only members/approvers can restore
  if not public.is_company_member(p_company_identity_id) then
    raise exception 'Not allowed to restore this company.';
  end if;

  update public.company_identities
     set is_archived = false,
         archived_at = null,
         archived_by_user_id = null,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_company_identity_id
     and is_archived = true;

  update public.company_workspaces
     set is_archived = false
   where company_identity_id = p_company_identity_id
     and is_archived = true;
end;
$$;
grant execute on function public.restore_archived_company_identity(uuid) to authenticated;
-- 3. Create company_personnel table
create table if not exists public.company_personnel (
  id uuid primary key default gen_random_uuid(),

  -- Linkage
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,

  -- Employee identity
  employee_id text,                          -- internal employee number / sicil no
  first_name text not null,
  last_name text not null,
  national_id text,                          -- TC Kimlik No / Passport
  nationality text default 'TC',

  -- Organization
  department text,
  position text,                             -- title / unvan
  location text,                             -- work area / lokasyon
  employment_type text default 'Tam Zamanlı',-- Tam Zamanlı, Yarı Zamanlı, Stajyer, Taşeron
  start_date date,
  shift_pattern text,                        -- Gündüz, 3 Vardiya, etc.
  manager text,                              -- supervisor name

  -- Contact
  phone text,
  email text,
  emergency_contact text,

  -- ISG / OHS fields
  training_status text,                      -- Tamamlandı, Eksik, Planlandı
  periodic_exam_status text,                 -- Güncel, Gecikmiş, Planlandı
  ppe_requirement text,                      -- KKD gereksinimleri
  high_risk_duty boolean not null default false,

  -- Special monitoring
  special_monitoring text,                   -- pregnant, disabled, foreign_national, minor, chronic_illness, night_shift
  special_monitoring_categories text[] default '{}',  -- array for multiple categories

  -- Notes
  notes text,

  -- Audit
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_personnel is
  'Personnel records for companies. Each row represents one employee linked to a company identity.';
-- Indexes
create index if not exists idx_company_personnel_company_identity_id
  on public.company_personnel (company_identity_id);
create index if not exists idx_company_personnel_company_workspace_id
  on public.company_personnel (company_workspace_id);
create index if not exists idx_company_personnel_department
  on public.company_personnel (department);
create index if not exists idx_company_personnel_location
  on public.company_personnel (location);
create index if not exists idx_company_personnel_special_monitoring
  on public.company_personnel (special_monitoring)
  where special_monitoring is not null and special_monitoring <> '';
create index if not exists idx_company_personnel_high_risk
  on public.company_personnel (high_risk_duty)
  where high_risk_duty = true;
create index if not exists idx_company_personnel_active
  on public.company_personnel (company_identity_id, is_active)
  where is_active = true;
-- Updated_at trigger
drop trigger if exists trg_company_personnel_updated_at on public.company_personnel;
create trigger trg_company_personnel_updated_at
before update on public.company_personnel
for each row
execute function public.touch_updated_at();
-- 4. RLS for company_personnel
alter table public.company_personnel enable row level security;
-- SELECT: company members can read their company's personnel
drop policy if exists company_personnel_select on public.company_personnel;
create policy company_personnel_select
on public.company_personnel
for select
to authenticated
using (
  public.is_company_member(company_identity_id)
);
-- INSERT: company members can add personnel
drop policy if exists company_personnel_insert on public.company_personnel;
create policy company_personnel_insert
on public.company_personnel
for insert
to authenticated
with check (
  public.is_company_member(company_identity_id)
);
-- UPDATE: company members can update personnel
drop policy if exists company_personnel_update on public.company_personnel;
create policy company_personnel_update
on public.company_personnel
for update
to authenticated
using (
  public.is_company_member(company_identity_id)
)
with check (
  public.is_company_member(company_identity_id)
);
-- DELETE: company approvers can delete personnel
drop policy if exists company_personnel_delete on public.company_personnel;
create policy company_personnel_delete
on public.company_personnel
for delete
to authenticated
using (
  public.is_company_approver(company_identity_id)
);
-- 5. Grant table permissions
grant select, insert, update, delete on public.company_personnel to authenticated;
