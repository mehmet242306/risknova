-- =============================================
-- Root Cause Analysis — tum yontemler tek tabloda
-- =============================================

-- Ana analiz tablosu
create table if not exists root_cause_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  incident_id uuid references incidents(id) on delete set null,
  incident_title text not null,
  method text not null check (method in (
    'ishikawa', 'five_why', 'fault_tree', 'scat', 'bow_tie', 'mort'
  )),
  data jsonb not null default '{}'::jsonb,
  is_free_mode boolean default false,
  is_edited boolean default false,
  shared_with_company boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rca_org on root_cause_analyses(organization_id);
create index if not exists idx_rca_incident on root_cause_analyses(incident_id);
create index if not exists idx_rca_method on root_cause_analyses(method);
create index if not exists idx_rca_created on root_cause_analyses(created_at desc);

create trigger set_rca_updated_at before update on root_cause_analyses
  for each row execute function set_current_timestamp_updated_at();

alter table root_cause_analyses enable row level security;

create policy "rca_select" on root_cause_analyses
  for select using (organization_id = current_organization_id());
create policy "rca_insert" on root_cause_analyses
  for insert with check (organization_id = current_organization_id());
create policy "rca_update" on root_cause_analyses
  for update using (organization_id = current_organization_id());
create policy "rca_delete" on root_cause_analyses
  for delete using (organization_id = current_organization_id());

-- Versiyon gecmisi
create table if not exists root_cause_versions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references root_cause_analyses(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  version_number int not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_rcv_analysis on root_cause_versions(analysis_id);

alter table root_cause_versions enable row level security;

create policy "rcv_select" on root_cause_versions
  for select using (organization_id = current_organization_id());
create policy "rcv_insert" on root_cause_versions
  for insert with check (organization_id = current_organization_id());
create policy "rcv_delete" on root_cause_versions
  for delete using (organization_id = current_organization_id());
