-- ============================================================
-- Migration 20260330_001: personnel schema bridge
-- ============================================================
-- Frontend and later migrations expect the canonical `personnel`
-- tables, but earlier workspace work introduced `company_personnel`.
-- This bridge creates the canonical schema and backfills existing rows
-- so a clean local database can replay the full migration chain.
-- ============================================================

create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  employee_code text,
  tc_identity_number text,
  first_name text not null,
  last_name text not null,
  birth_date date,
  gender text,
  nationality text default 'TR',
  blood_type text,
  marital_status text,
  phone text,
  email text,
  emergency_contact_name text,
  emergency_contact_phone text,
  address text,
  department text,
  position_title text,
  location text,
  hire_date date,
  termination_date date,
  employment_status text not null default 'active',
  employment_type text,
  shift_type text,
  education_level text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.personnel
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
comment on table public.personnel is
  'Canonical personnel records used by the app. Backfilled from legacy company_personnel rows.';
create index if not exists idx_personnel_company_identity_id
  on public.personnel (company_identity_id);
create index if not exists idx_personnel_company_workspace_id
  on public.personnel (company_workspace_id);
create index if not exists idx_personnel_organization_id
  on public.personnel (organization_id);
create index if not exists idx_personnel_active
  on public.personnel (company_identity_id, is_active)
  where is_active = true;
drop trigger if exists trg_personnel_updated_at on public.personnel;
create trigger trg_personnel_updated_at
before update on public.personnel
for each row
execute function public.set_current_timestamp_updated_at();
insert into public.personnel (
  id,
  organization_id,
  company_identity_id,
  company_workspace_id,
  employee_code,
  tc_identity_number,
  first_name,
  last_name,
  nationality,
  phone,
  email,
  emergency_contact_name,
  department,
  position_title,
  location,
  hire_date,
  employment_status,
  employment_type,
  shift_type,
  notes,
  is_active,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  cp.id,
  coalesce(cw.organization_id, ci.owner_organization_id),
  cp.company_identity_id,
  cp.company_workspace_id,
  cp.employee_id,
  cp.national_id,
  cp.first_name,
  cp.last_name,
  nullif(cp.nationality, ''),
  cp.phone,
  cp.email,
  cp.emergency_contact,
  cp.department,
  cp.position,
  cp.location,
  cp.start_date,
  case
    when cp.is_active then 'active'
    else 'inactive'
  end,
  cp.employment_type,
  cp.shift_pattern,
  cp.notes,
  cp.is_active,
  cp.created_by,
  cp.updated_by,
  cp.created_at,
  cp.updated_at
from public.company_personnel cp
left join public.company_workspaces cw
  on cw.id = cp.company_workspace_id
left join public.company_identities ci
  on ci.id = cp.company_identity_id
where coalesce(cw.organization_id, ci.owner_organization_id) is not null
on conflict (id) do nothing;
alter table public.personnel enable row level security;
drop policy if exists personnel_select on public.personnel;
create policy personnel_select
on public.personnel
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_insert on public.personnel;
create policy personnel_insert
on public.personnel
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_update on public.personnel;
create policy personnel_update
on public.personnel
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_delete on public.personnel;
create policy personnel_delete
on public.personnel
for delete
to authenticated
using (public.is_company_approver(company_identity_id));
grant select, insert, update, delete on public.personnel to authenticated;
create table if not exists public.personnel_special_policies (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  policy_type text not null,
  start_date date,
  end_date date,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personnel_special_policies_personnel_id
  on public.personnel_special_policies (personnel_id);
create index if not exists idx_personnel_special_policies_company_identity_id
  on public.personnel_special_policies (company_identity_id);
drop trigger if exists trg_personnel_special_policies_updated_at on public.personnel_special_policies;
create trigger trg_personnel_special_policies_updated_at
before update on public.personnel_special_policies
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.personnel_special_policies enable row level security;
drop policy if exists personnel_special_policies_select on public.personnel_special_policies;
create policy personnel_special_policies_select
on public.personnel_special_policies
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_special_policies_insert on public.personnel_special_policies;
create policy personnel_special_policies_insert
on public.personnel_special_policies
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_special_policies_update on public.personnel_special_policies;
create policy personnel_special_policies_update
on public.personnel_special_policies
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_special_policies_delete on public.personnel_special_policies;
create policy personnel_special_policies_delete
on public.personnel_special_policies
for delete
to authenticated
using (public.is_company_member(company_identity_id));
grant select, insert, update, delete on public.personnel_special_policies to authenticated;
create table if not exists public.personnel_trainings (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  training_name text not null,
  training_date date,
  duration text,
  trainer_name text,
  status text not null default 'completed',
  certificate_no text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personnel_trainings_personnel_id
  on public.personnel_trainings (personnel_id);
create index if not exists idx_personnel_trainings_company_identity_id
  on public.personnel_trainings (company_identity_id);
drop trigger if exists trg_personnel_trainings_updated_at on public.personnel_trainings;
create trigger trg_personnel_trainings_updated_at
before update on public.personnel_trainings
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.personnel_trainings enable row level security;
drop policy if exists personnel_trainings_select on public.personnel_trainings;
create policy personnel_trainings_select
on public.personnel_trainings
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_trainings_insert on public.personnel_trainings;
create policy personnel_trainings_insert
on public.personnel_trainings
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_trainings_update on public.personnel_trainings;
create policy personnel_trainings_update
on public.personnel_trainings
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_trainings_delete on public.personnel_trainings;
create policy personnel_trainings_delete
on public.personnel_trainings
for delete
to authenticated
using (public.is_company_member(company_identity_id));
grant select, insert, update, delete on public.personnel_trainings to authenticated;
create table if not exists public.personnel_health_exams (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  exam_type text not null,
  exam_date date,
  next_exam_date date,
  result text not null default 'uygun',
  physician_name text,
  physician_institution text,
  doctor_name text generated always as (coalesce(physician_name, '')) stored,
  report_number text,
  restrictions text,
  recommended_actions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personnel_health_exams_personnel_id
  on public.personnel_health_exams (personnel_id);
create index if not exists idx_personnel_health_exams_company_identity_id
  on public.personnel_health_exams (company_identity_id);
drop trigger if exists trg_personnel_health_exams_updated_at on public.personnel_health_exams;
create trigger trg_personnel_health_exams_updated_at
before update on public.personnel_health_exams
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.personnel_health_exams enable row level security;
drop policy if exists personnel_health_exams_select on public.personnel_health_exams;
create policy personnel_health_exams_select
on public.personnel_health_exams
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_health_exams_insert on public.personnel_health_exams;
create policy personnel_health_exams_insert
on public.personnel_health_exams
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_health_exams_update on public.personnel_health_exams;
create policy personnel_health_exams_update
on public.personnel_health_exams
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_health_exams_delete on public.personnel_health_exams;
create policy personnel_health_exams_delete
on public.personnel_health_exams
for delete
to authenticated
using (public.is_company_member(company_identity_id));
grant select, insert, update, delete on public.personnel_health_exams to authenticated;
create table if not exists public.personnel_ppe_records (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  ppe_name text not null,
  issue_date date,
  expiry_date date,
  status text not null default 'active',
  size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personnel_ppe_records_personnel_id
  on public.personnel_ppe_records (personnel_id);
create index if not exists idx_personnel_ppe_records_company_identity_id
  on public.personnel_ppe_records (company_identity_id);
drop trigger if exists trg_personnel_ppe_records_updated_at on public.personnel_ppe_records;
create trigger trg_personnel_ppe_records_updated_at
before update on public.personnel_ppe_records
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.personnel_ppe_records enable row level security;
drop policy if exists personnel_ppe_records_select on public.personnel_ppe_records;
create policy personnel_ppe_records_select
on public.personnel_ppe_records
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_ppe_records_insert on public.personnel_ppe_records;
create policy personnel_ppe_records_insert
on public.personnel_ppe_records
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_ppe_records_update on public.personnel_ppe_records;
create policy personnel_ppe_records_update
on public.personnel_ppe_records
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_ppe_records_delete on public.personnel_ppe_records;
create policy personnel_ppe_records_delete
on public.personnel_ppe_records
for delete
to authenticated
using (public.is_company_member(company_identity_id));
grant select, insert, update, delete on public.personnel_ppe_records to authenticated;
create table if not exists public.personnel_documents (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  document_name text not null,
  document_type text,
  file_url text,
  expiry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personnel_documents_personnel_id
  on public.personnel_documents (personnel_id);
create index if not exists idx_personnel_documents_company_identity_id
  on public.personnel_documents (company_identity_id);
drop trigger if exists trg_personnel_documents_updated_at on public.personnel_documents;
create trigger trg_personnel_documents_updated_at
before update on public.personnel_documents
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.personnel_documents enable row level security;
drop policy if exists personnel_documents_select on public.personnel_documents;
create policy personnel_documents_select
on public.personnel_documents
for select
to authenticated
using (public.is_company_member(company_identity_id));
drop policy if exists personnel_documents_insert on public.personnel_documents;
create policy personnel_documents_insert
on public.personnel_documents
for insert
to authenticated
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_documents_update on public.personnel_documents;
create policy personnel_documents_update
on public.personnel_documents
for update
to authenticated
using (public.is_company_member(company_identity_id))
with check (public.is_company_member(company_identity_id));
drop policy if exists personnel_documents_delete on public.personnel_documents;
create policy personnel_documents_delete
on public.personnel_documents
for delete
to authenticated
using (public.is_company_member(company_identity_id));
grant select, insert, update, delete on public.personnel_documents to authenticated;
