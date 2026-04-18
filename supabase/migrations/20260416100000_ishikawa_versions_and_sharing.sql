-- =============================================
-- Ishikawa versiyon geçmişi + firma paylaşım
-- =============================================

-- 1) Versiyon geçmişi tablosu
create table if not exists ishikawa_versions (
  id uuid primary key default gen_random_uuid(),
  ishikawa_id uuid not null references incident_ishikawa(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  version_number int not null,
  problem_statement text,
  man_causes text[] default '{}',
  machine_causes text[] default '{}',
  method_causes text[] default '{}',
  material_causes text[] default '{}',
  environment_causes text[] default '{}',
  measurement_causes text[] default '{}',
  root_cause_conclusion text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_ishikawa_versions_ishikawa on ishikawa_versions(ishikawa_id);
create index if not exists idx_ishikawa_versions_org on ishikawa_versions(organization_id);

alter table ishikawa_versions enable row level security;

create policy "ishikawa_versions_select" on ishikawa_versions
  for select using (organization_id = current_organization_id());
create policy "ishikawa_versions_insert" on ishikawa_versions
  for insert with check (organization_id = current_organization_id());
create policy "ishikawa_versions_delete" on ishikawa_versions
  for delete using (organization_id = current_organization_id());

-- 2) incident_ishikawa'ya paylaşım sütunları ekle
alter table incident_ishikawa
  add column if not exists shared_with_company boolean default false;
