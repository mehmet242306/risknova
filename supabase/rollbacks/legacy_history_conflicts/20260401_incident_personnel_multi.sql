-- ================================================================
-- Migration 006: Çoklu personel ilişki tablosu
-- Bir kazada birden fazla kişi etkilenmiş olabilir (yaralı/ölümlü)
-- ================================================================

create table if not exists incident_personnel (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  personnel_id uuid references personnel(id) on delete set null,
  personnel_name text,
  personnel_tc text,
  personnel_department text,
  personnel_position text,

  outcome text not null default 'injured' check (outcome in ('injured', 'deceased', 'unharmed', 'unknown')),

  injury_type text,
  injury_body_part text,
  injury_cause_event text,
  injury_cause_tool text,
  work_disability boolean default false,
  disability_status text,
  days_lost integer default 0,

  medical_intervention boolean default false,
  medical_person text,
  medical_location text,
  medical_city text,
  medical_district text,
  medical_date date,
  medical_time time,

  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inc_personnel_incident on incident_personnel(incident_id);
create index if not exists idx_inc_personnel_person on incident_personnel(personnel_id);
alter table incident_personnel enable row level security;
drop policy if exists "inc_personnel_select" on incident_personnel;
drop policy if exists "inc_personnel_insert" on incident_personnel;
drop policy if exists "inc_personnel_update" on incident_personnel;
drop policy if exists "inc_personnel_delete" on incident_personnel;
create policy "inc_personnel_select" on incident_personnel for select
  using (exists (select 1 from incidents where incidents.id = incident_personnel.incident_id and incidents.organization_id = current_organization_id()));
create policy "inc_personnel_insert" on incident_personnel for insert
  with check (exists (select 1 from incidents where incidents.id = incident_personnel.incident_id and incidents.organization_id = current_organization_id()));
create policy "inc_personnel_update" on incident_personnel for update
  using (exists (select 1 from incidents where incidents.id = incident_personnel.incident_id and incidents.organization_id = current_organization_id()));
create policy "inc_personnel_delete" on incident_personnel for delete
  using (exists (select 1 from incidents where incidents.id = incident_personnel.incident_id and incidents.organization_id = current_organization_id()));
