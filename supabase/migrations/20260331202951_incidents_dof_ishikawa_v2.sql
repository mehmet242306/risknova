-- Sequence for incident codes
create sequence if not exists incident_code_seq start with 1 increment by 1;

-- Sequence for DÖF codes
create sequence if not exists dof_code_seq start with 1 increment by 1;

-- incidents
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  company_workspace_id uuid references company_workspaces(id) on delete set null,
  personnel_id uuid references personnel(id) on delete set null,

  incident_code text not null unique default ('RN-INC-' || lpad(nextval('incident_code_seq')::text, 6, '0')),
  incident_type text not null check (incident_type in ('work_accident', 'near_miss', 'occupational_disease')),
  status text not null default 'draft' check (status in ('draft', 'reported', 'investigating', 'dof_open', 'closed')),
  severity_level text check (severity_level in ('low', 'medium', 'high', 'critical')),

  incident_date date, incident_time time, incident_location text, incident_department text,
  incident_environment text, shift_start_time time, shift_end_time time, work_start_time time,
  general_activity text, specific_activity text, tool_used text, description text,

  injury_type text, injury_body_part text, injury_cause_event text, injury_cause_tool text,
  work_disability boolean default false, disability_status text, days_lost integer default 0,

  medical_intervention boolean default false, medical_person text, medical_location text,
  medical_city text, medical_district text, medical_date date, medical_time time,

  reported_by text, report_date date, report_time time,
  employee_count_male integer, employee_count_female integer, employee_count_total integer,

  accident_cause_description text, accident_cause text, accident_cause_tool text,
  accident_city text, accident_district text,

  disease_work_environment text, disease_detection_method text, disease_agent text,
  disease_agent_duration text, disability_level text, disease_diagnosis text, disease_diagnosis_date date,

  ai_summary jsonb, dof_required boolean default false, ishikawa_required boolean default false,

  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists idx_incidents_org on incidents(organization_id);
create index if not exists idx_incidents_company on incidents(company_workspace_id);
create index if not exists idx_incidents_type on incidents(incident_type);
create index if not exists idx_incidents_status on incidents(status);
create index if not exists idx_incidents_date on incidents(incident_date desc);

create trigger set_incidents_updated_at before update on incidents
  for each row execute function set_current_timestamp_updated_at();

-- incident_witnesses
create table if not exists incident_witnesses (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  tc_identity text, full_name text not null, email text, phone text, address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_witnesses_incident on incident_witnesses(incident_id);

-- incident_dof
create table if not exists incident_dof (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  dof_code text not null unique default ('RN-DOF-' || lpad(nextval('dof_code_seq')::text, 6, '0')),
  root_cause text, root_cause_analysis text,
  corrective_actions jsonb default '[]'::jsonb, preventive_actions jsonb default '[]'::jsonb,
  assigned_to text, deadline date, completion_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'verified')),
  ai_suggestions jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_dof_incident on incident_dof(incident_id);
create index if not exists idx_dof_org on incident_dof(organization_id);
create index if not exists idx_dof_status on incident_dof(status);
create trigger set_dof_updated_at before update on incident_dof
  for each row execute function set_current_timestamp_updated_at();

-- incident_ishikawa
create table if not exists incident_ishikawa (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  problem_statement text,
  man_causes text[] default '{}', machine_causes text[] default '{}',
  method_causes text[] default '{}', material_causes text[] default '{}',
  environment_causes text[] default '{}', measurement_causes text[] default '{}',
  root_cause_conclusion text, ai_suggestions jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_ishikawa_incident on incident_ishikawa(incident_id);
create trigger set_ishikawa_updated_at before update on incident_ishikawa
  for each row execute function set_current_timestamp_updated_at();

-- RLS
alter table incidents enable row level security;
alter table incident_witnesses enable row level security;
alter table incident_dof enable row level security;
alter table incident_ishikawa enable row level security;

create policy "incidents_select" on incidents for select using (organization_id = current_organization_id());
create policy "incidents_insert" on incidents for insert with check (organization_id = current_organization_id());
create policy "incidents_update" on incidents for update using (organization_id = current_organization_id());
create policy "incidents_delete" on incidents for delete using (organization_id = current_organization_id());

create policy "witnesses_select" on incident_witnesses for select using (exists (select 1 from incidents where incidents.id = incident_witnesses.incident_id and incidents.organization_id = current_organization_id()));
create policy "witnesses_insert" on incident_witnesses for insert with check (exists (select 1 from incidents where incidents.id = incident_witnesses.incident_id and incidents.organization_id = current_organization_id()));
create policy "witnesses_update" on incident_witnesses for update using (exists (select 1 from incidents where incidents.id = incident_witnesses.incident_id and incidents.organization_id = current_organization_id()));
create policy "witnesses_delete" on incident_witnesses for delete using (exists (select 1 from incidents where incidents.id = incident_witnesses.incident_id and incidents.organization_id = current_organization_id()));

create policy "dof_select" on incident_dof for select using (organization_id = current_organization_id());
create policy "dof_insert" on incident_dof for insert with check (organization_id = current_organization_id());
create policy "dof_update" on incident_dof for update using (organization_id = current_organization_id());
create policy "dof_delete" on incident_dof for delete using (organization_id = current_organization_id());

create policy "ishikawa_select" on incident_ishikawa for select using (organization_id = current_organization_id());
create policy "ishikawa_insert" on incident_ishikawa for insert with check (organization_id = current_organization_id());
create policy "ishikawa_update" on incident_ishikawa for update using (organization_id = current_organization_id());
create policy "ishikawa_delete" on incident_ishikawa for delete using (organization_id = current_organization_id());;
