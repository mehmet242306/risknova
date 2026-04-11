-- ============================================================
-- Migration: 20260411143000_tenant_foundation_phase1
-- ============================================================
-- Phase 1 for Section 1.1 + 1.4:
-- - Add company_workspace_id to child tables that can derive it
-- - Add standard audit columns (created_by, updated_by, updated_at)
-- - Backfill context from parent records
-- - Keep legacy organization/company_identity columns for compatibility
-- ============================================================

create or replace function public.apply_standard_audit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null and auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  end if;

  new.updated_at := now();

  if auth.uid() is not null then
    new.updated_by := auth.uid();
  elsif new.updated_by is null and tg_op = 'INSERT' then
    new.updated_by := new.created_by;
  end if;

  return new;
end;
$$;
create or replace function public.sync_incident_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incident record;
begin
  select i.organization_id, i.company_workspace_id
    into v_incident
    from public.incidents i
   where i.id = new.incident_id;

  if not found then
    raise exception 'Incident % not found for %', new.incident_id, tg_table_name;
  end if;

  if new.organization_id is null then
    new.organization_id := v_incident.organization_id;
  end if;

  if new.company_workspace_id is null then
    new.company_workspace_id := v_incident.company_workspace_id;
  end if;

  return new;
end;
$$;
create or replace function public.sync_risk_assessment_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment record;
begin
  select ra.organization_id, ra.company_workspace_id
    into v_assessment
    from public.risk_assessments ra
   where ra.id = new.assessment_id;

  if not found then
    raise exception 'Risk assessment % not found for %', new.assessment_id, tg_table_name;
  end if;

  if new.organization_id is null then
    new.organization_id := v_assessment.organization_id;
  end if;

  if new.company_workspace_id is null then
    new.company_workspace_id := v_assessment.company_workspace_id;
  end if;

  return new;
end;
$$;
create or replace function public.sync_company_training_attendee_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_training record;
begin
  select t.organization_id, t.company_workspace_id
    into v_training
    from public.company_trainings t
   where t.id = new.training_id;

  if not found then
    raise exception 'Company training % not found for %', new.training_id, tg_table_name;
  end if;

  if new.organization_id is null then
    new.organization_id := v_training.organization_id;
  end if;

  if new.company_workspace_id is null then
    new.company_workspace_id := v_training.company_workspace_id;
  end if;

  return new;
end;
$$;
create or replace function public.sync_personnel_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_personnel record;
begin
  select p.organization_id, p.company_identity_id, p.company_workspace_id
    into v_personnel
    from public.personnel p
   where p.id = new.personnel_id;

  if not found then
    raise exception 'Personnel % not found for %', new.personnel_id, tg_table_name;
  end if;

  if new.organization_id is null then
    new.organization_id := v_personnel.organization_id;
  end if;

  if new.company_identity_id is null then
    new.company_identity_id := v_personnel.company_identity_id;
  end if;

  if new.company_workspace_id is null then
    new.company_workspace_id := v_personnel.company_workspace_id;
  end if;

  return new;
end;
$$;
alter table public.incident_witnesses
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.incident_personnel
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.incident_dof
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.incident_ishikawa
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.risk_assessment_rows
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.risk_assessment_images
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.risk_assessment_findings
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.risk_assessment_items
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.company_training_attendees
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.personnel_special_policies
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.personnel_trainings
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.personnel_health_exams
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.personnel_ppe_records
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.personnel_documents
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
update public.incident_witnesses iw
   set organization_id = coalesce(iw.organization_id, i.organization_id),
       company_workspace_id = coalesce(iw.company_workspace_id, i.company_workspace_id),
       updated_by = coalesce(iw.updated_by, iw.created_by),
       updated_at = coalesce(iw.updated_at, iw.created_at, now())
  from public.incidents i
 where i.id = iw.incident_id;
update public.incident_personnel ip
   set organization_id = coalesce(ip.organization_id, i.organization_id),
       company_workspace_id = coalesce(ip.company_workspace_id, i.company_workspace_id),
       updated_by = coalesce(ip.updated_by, ip.created_by),
       updated_at = coalesce(ip.updated_at, ip.created_at, now())
  from public.incidents i
 where i.id = ip.incident_id;
update public.incident_dof d
   set company_workspace_id = coalesce(d.company_workspace_id, i.company_workspace_id),
       updated_by = coalesce(d.updated_by, d.created_by)
  from public.incidents i
 where i.id = d.incident_id;
update public.incident_ishikawa ish
   set company_workspace_id = coalesce(ish.company_workspace_id, i.company_workspace_id),
       updated_by = coalesce(ish.updated_by, ish.created_by)
  from public.incidents i
 where i.id = ish.incident_id;
update public.risk_assessment_rows r
   set company_workspace_id = coalesce(r.company_workspace_id, ra.company_workspace_id),
       updated_by = coalesce(r.updated_by, r.created_by)
  from public.risk_assessments ra
 where ra.id = r.assessment_id;
update public.risk_assessment_images img
   set company_workspace_id = coalesce(img.company_workspace_id, ra.company_workspace_id),
       updated_by = coalesce(img.updated_by, img.created_by),
       updated_at = coalesce(img.updated_at, img.created_at, now())
  from public.risk_assessments ra
 where ra.id = img.assessment_id;
update public.risk_assessment_findings f
   set company_workspace_id = coalesce(f.company_workspace_id, ra.company_workspace_id),
       updated_by = coalesce(f.updated_by, f.created_by)
  from public.risk_assessments ra
 where ra.id = f.assessment_id;
update public.risk_assessment_items i
   set company_workspace_id = coalesce(i.company_workspace_id, ra.company_workspace_id),
       updated_by = coalesce(i.updated_by, i.created_by)
  from public.risk_assessments ra
 where ra.id = i.assessment_id;
update public.company_training_attendees a
   set organization_id = coalesce(a.organization_id, t.organization_id),
       company_workspace_id = coalesce(a.company_workspace_id, t.company_workspace_id),
       updated_by = coalesce(a.updated_by, a.created_by),
       updated_at = coalesce(a.updated_at, a.created_at, now())
  from public.company_trainings t
 where t.id = a.training_id;
update public.personnel_special_policies spp
   set company_workspace_id = coalesce(spp.company_workspace_id, p.company_workspace_id),
       updated_by = coalesce(spp.updated_by, spp.created_by)
  from public.personnel p
 where p.id = spp.personnel_id;
update public.personnel_trainings pt
   set company_workspace_id = coalesce(pt.company_workspace_id, p.company_workspace_id),
       updated_by = coalesce(pt.updated_by, pt.created_by)
  from public.personnel p
 where p.id = pt.personnel_id;
update public.personnel_health_exams phe
   set company_workspace_id = coalesce(phe.company_workspace_id, p.company_workspace_id),
       updated_by = coalesce(phe.updated_by, phe.created_by)
  from public.personnel p
 where p.id = phe.personnel_id;
update public.personnel_ppe_records ppe
   set company_workspace_id = coalesce(ppe.company_workspace_id, p.company_workspace_id),
       updated_by = coalesce(ppe.updated_by, ppe.created_by)
  from public.personnel p
 where p.id = ppe.personnel_id;
update public.personnel_documents pd
   set company_workspace_id = coalesce(pd.company_workspace_id, p.company_workspace_id),
       updated_by = coalesce(pd.updated_by, pd.created_by)
  from public.personnel p
 where p.id = pd.personnel_id;
create index if not exists idx_incident_witnesses_workspace_id on public.incident_witnesses(company_workspace_id);
create index if not exists idx_incident_witnesses_created_at on public.incident_witnesses(created_at desc);
create index if not exists idx_incident_personnel_workspace_id on public.incident_personnel(company_workspace_id);
create index if not exists idx_incident_personnel_created_at on public.incident_personnel(created_at desc);
create index if not exists idx_incident_dof_workspace_id on public.incident_dof(company_workspace_id);
create index if not exists idx_incident_ishikawa_workspace_id on public.incident_ishikawa(company_workspace_id);
create index if not exists idx_risk_assessment_rows_workspace_id on public.risk_assessment_rows(company_workspace_id);
create index if not exists idx_risk_assessment_images_workspace_id on public.risk_assessment_images(company_workspace_id);
create index if not exists idx_risk_assessment_findings_workspace_id on public.risk_assessment_findings(company_workspace_id);
create index if not exists idx_risk_assessment_items_workspace_id on public.risk_assessment_items(company_workspace_id);
create index if not exists idx_company_training_attendees_workspace_id on public.company_training_attendees(company_workspace_id);
create index if not exists idx_personnel_special_policies_workspace_id on public.personnel_special_policies(company_workspace_id);
create index if not exists idx_personnel_trainings_workspace_id on public.personnel_trainings(company_workspace_id);
create index if not exists idx_personnel_health_exams_workspace_id on public.personnel_health_exams(company_workspace_id);
create index if not exists idx_personnel_ppe_records_workspace_id on public.personnel_ppe_records(company_workspace_id);
create index if not exists idx_personnel_documents_workspace_id on public.personnel_documents(company_workspace_id);
drop trigger if exists trg_10_incident_witnesses_context on public.incident_witnesses;
create trigger trg_10_incident_witnesses_context
before insert or update on public.incident_witnesses
for each row execute function public.sync_incident_child_context();
drop trigger if exists trg_20_incident_witnesses_audit on public.incident_witnesses;
create trigger trg_20_incident_witnesses_audit
before insert or update on public.incident_witnesses
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_incident_personnel_context on public.incident_personnel;
create trigger trg_10_incident_personnel_context
before insert or update on public.incident_personnel
for each row execute function public.sync_incident_child_context();
drop trigger if exists trg_20_incident_personnel_audit on public.incident_personnel;
create trigger trg_20_incident_personnel_audit
before insert or update on public.incident_personnel
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_incident_dof_context on public.incident_dof;
create trigger trg_10_incident_dof_context
before insert or update on public.incident_dof
for each row execute function public.sync_incident_child_context();
drop trigger if exists trg_20_incident_dof_audit on public.incident_dof;
create trigger trg_20_incident_dof_audit
before insert or update on public.incident_dof
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_incident_ishikawa_context on public.incident_ishikawa;
create trigger trg_10_incident_ishikawa_context
before insert or update on public.incident_ishikawa
for each row execute function public.sync_incident_child_context();
drop trigger if exists trg_20_incident_ishikawa_audit on public.incident_ishikawa;
create trigger trg_20_incident_ishikawa_audit
before insert or update on public.incident_ishikawa
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_risk_assessment_rows_context on public.risk_assessment_rows;
create trigger trg_10_risk_assessment_rows_context
before insert or update on public.risk_assessment_rows
for each row execute function public.sync_risk_assessment_child_context();
drop trigger if exists trg_20_risk_assessment_rows_audit on public.risk_assessment_rows;
create trigger trg_20_risk_assessment_rows_audit
before insert or update on public.risk_assessment_rows
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_risk_assessment_images_context on public.risk_assessment_images;
create trigger trg_10_risk_assessment_images_context
before insert or update on public.risk_assessment_images
for each row execute function public.sync_risk_assessment_child_context();
drop trigger if exists trg_20_risk_assessment_images_audit on public.risk_assessment_images;
create trigger trg_20_risk_assessment_images_audit
before insert or update on public.risk_assessment_images
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_risk_assessment_findings_context on public.risk_assessment_findings;
create trigger trg_10_risk_assessment_findings_context
before insert or update on public.risk_assessment_findings
for each row execute function public.sync_risk_assessment_child_context();
drop trigger if exists trg_20_risk_assessment_findings_audit on public.risk_assessment_findings;
create trigger trg_20_risk_assessment_findings_audit
before insert or update on public.risk_assessment_findings
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_risk_assessment_items_context on public.risk_assessment_items;
create trigger trg_10_risk_assessment_items_context
before insert or update on public.risk_assessment_items
for each row execute function public.sync_risk_assessment_child_context();
drop trigger if exists trg_20_risk_assessment_items_audit on public.risk_assessment_items;
create trigger trg_20_risk_assessment_items_audit
before insert or update on public.risk_assessment_items
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_company_training_attendees_context on public.company_training_attendees;
create trigger trg_10_company_training_attendees_context
before insert or update on public.company_training_attendees
for each row execute function public.sync_company_training_attendee_context();
drop trigger if exists trg_20_company_training_attendees_audit on public.company_training_attendees;
create trigger trg_20_company_training_attendees_audit
before insert or update on public.company_training_attendees
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_personnel_special_policies_context on public.personnel_special_policies;
create trigger trg_10_personnel_special_policies_context
before insert or update on public.personnel_special_policies
for each row execute function public.sync_personnel_child_context();
drop trigger if exists trg_20_personnel_special_policies_audit on public.personnel_special_policies;
create trigger trg_20_personnel_special_policies_audit
before insert or update on public.personnel_special_policies
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_personnel_trainings_context on public.personnel_trainings;
create trigger trg_10_personnel_trainings_context
before insert or update on public.personnel_trainings
for each row execute function public.sync_personnel_child_context();
drop trigger if exists trg_20_personnel_trainings_audit on public.personnel_trainings;
create trigger trg_20_personnel_trainings_audit
before insert or update on public.personnel_trainings
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_personnel_health_exams_context on public.personnel_health_exams;
create trigger trg_10_personnel_health_exams_context
before insert or update on public.personnel_health_exams
for each row execute function public.sync_personnel_child_context();
drop trigger if exists trg_20_personnel_health_exams_audit on public.personnel_health_exams;
create trigger trg_20_personnel_health_exams_audit
before insert or update on public.personnel_health_exams
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_personnel_ppe_records_context on public.personnel_ppe_records;
create trigger trg_10_personnel_ppe_records_context
before insert or update on public.personnel_ppe_records
for each row execute function public.sync_personnel_child_context();
drop trigger if exists trg_20_personnel_ppe_records_audit on public.personnel_ppe_records;
create trigger trg_20_personnel_ppe_records_audit
before insert or update on public.personnel_ppe_records
for each row execute function public.apply_standard_audit_columns();
drop trigger if exists trg_10_personnel_documents_context on public.personnel_documents;
create trigger trg_10_personnel_documents_context
before insert or update on public.personnel_documents
for each row execute function public.sync_personnel_child_context();
drop trigger if exists trg_20_personnel_documents_audit on public.personnel_documents;
create trigger trg_20_personnel_documents_audit
before insert or update on public.personnel_documents
for each row execute function public.apply_standard_audit_columns();
