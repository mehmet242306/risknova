-- ============================================================
-- Migration: 20260411152000_tenant_foundation_phase2
-- ============================================================
-- Phase 2 for Section 1.1 + 1.4:
-- - Secure scan/digital twin tables with workspace-based RLS
-- - Add canonical company_workspace_id + audit columns
-- - Extend updated_by coverage on core business tables
-- ============================================================

create or replace function public.sync_scan_session_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace record;
begin
  if new.company_workspace_id is null and new.company_id is not null then
    new.company_workspace_id := new.company_id;
  end if;

  if new.company_id is null and new.company_workspace_id is not null then
    new.company_id := new.company_workspace_id;
  end if;

  if new.company_workspace_id is not null then
    select cw.organization_id
      into v_workspace
      from public.company_workspaces cw
     where cw.id = new.company_workspace_id;

    if found and new.organization_id is null then
      new.organization_id := v_workspace.organization_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_scan_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select s.company_id, s.company_workspace_id, s.organization_id, s.user_id
    into v_session
    from public.scan_sessions s
   where s.id = new.session_id;

  if not found then
    raise exception 'Scan session % not found for %', new.session_id, tg_table_name;
  end if;

  if new.company_workspace_id is null then
    new.company_workspace_id := coalesce(v_session.company_workspace_id, v_session.company_id);
  end if;

  if new.organization_id is null then
    new.organization_id := v_session.organization_id;
  end if;

  if tg_table_name in ('scan_detections', 'digital_twin_points', 'digital_twin_models') then
    if new.company_id is null then
      new.company_id := coalesce(v_session.company_id, v_session.company_workspace_id);
    end if;
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := coalesce(auth.uid(), v_session.user_id);
  end if;

  return new;
end;
$$;

create or replace function public.can_access_company_workspace(p_company_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_workspace_id = p_company_workspace_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.can_view_shared_operations = true
  )
$$;

create or replace function public.can_manage_company_workspace(p_company_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_workspace_id = p_company_workspace_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and (
        cm.can_create_shared_operations = true
        or cm.can_approve_join_requests = true
        or cm.membership_role = 'owner'
      )
  )
$$;

alter table public.scan_sessions
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.scan_detections
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.scan_frames
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.digital_twin_points
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.digital_twin_models
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.company_trainings
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.company_periodic_controls
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.document_templates
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.editor_documents
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.isg_tasks
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.question_bank
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.slide_decks
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.scan_sessions s
   set company_workspace_id = coalesce(s.company_workspace_id, s.company_id),
       organization_id = coalesce(s.organization_id, cw.organization_id),
       updated_at = coalesce(s.updated_at, s.created_at, now()),
       created_by = coalesce(s.created_by, s.user_id),
       updated_by = coalesce(s.updated_by, s.user_id, s.created_by)
  from public.company_workspaces cw
 where cw.id = coalesce(s.company_workspace_id, s.company_id);

update public.scan_detections d
   set company_workspace_id = coalesce(d.company_workspace_id, s.company_workspace_id, s.company_id, d.company_id),
       company_id = coalesce(d.company_id, s.company_id, s.company_workspace_id),
       organization_id = coalesce(d.organization_id, s.organization_id),
       created_at = coalesce(d.created_at, now()),
       updated_at = coalesce(d.updated_at, d.created_at, now()),
       created_by = coalesce(d.created_by, s.created_by, s.user_id),
       updated_by = coalesce(d.updated_by, s.created_by, s.user_id)
  from public.scan_sessions s
 where s.id = d.session_id;

update public.scan_frames f
   set company_workspace_id = coalesce(f.company_workspace_id, s.company_workspace_id, s.company_id),
       organization_id = coalesce(f.organization_id, s.organization_id),
       created_at = coalesce(f.created_at, now()),
       updated_at = coalesce(f.updated_at, f.created_at, now()),
       created_by = coalesce(f.created_by, s.created_by, s.user_id),
       updated_by = coalesce(f.updated_by, s.created_by, s.user_id)
  from public.scan_sessions s
 where s.id = f.session_id;

update public.digital_twin_points p
   set company_workspace_id = coalesce(p.company_workspace_id, s.company_workspace_id, s.company_id, p.company_id),
       company_id = coalesce(p.company_id, s.company_id, s.company_workspace_id),
       organization_id = coalesce(p.organization_id, s.organization_id),
       created_at = coalesce(p.created_at, now()),
       updated_at = coalesce(p.updated_at, p.created_at, now()),
       created_by = coalesce(p.created_by, s.created_by, s.user_id),
       updated_by = coalesce(p.updated_by, s.created_by, s.user_id)
  from public.scan_sessions s
 where s.id = p.session_id;

update public.digital_twin_models m
   set company_workspace_id = coalesce(m.company_workspace_id, s.company_workspace_id, s.company_id, m.company_id),
       company_id = coalesce(m.company_id, s.company_id, s.company_workspace_id),
       organization_id = coalesce(m.organization_id, s.organization_id),
       created_by = coalesce(m.created_by, s.created_by, s.user_id),
       updated_by = coalesce(m.updated_by, s.updated_by, s.created_by, s.user_id)
  from public.scan_sessions s
 where s.id = m.session_id;

update public.company_trainings
   set updated_by = coalesce(updated_by, created_by);

update public.company_periodic_controls
   set updated_by = coalesce(updated_by, created_by);

update public.document_templates
   set updated_by = coalesce(updated_by, created_by);

update public.editor_documents
   set created_by = coalesce(
         created_by,
         (select up.auth_user_id from public.user_profiles up where up.id = public.editor_documents.prepared_by)
       ),
       updated_by = coalesce(
         updated_by,
         (select up.auth_user_id from public.user_profiles up where up.id = public.editor_documents.approved_by),
         (select up.auth_user_id from public.user_profiles up where up.id = public.editor_documents.prepared_by)
       );

update public.isg_tasks
   set updated_by = coalesce(updated_by, created_by);

update public.question_bank
   set updated_by = coalesce(updated_by, created_by);

update public.slide_decks
   set updated_by = coalesce(updated_by, created_by);

create index if not exists idx_scan_sessions_workspace_id on public.scan_sessions(company_workspace_id);
create index if not exists idx_scan_sessions_org_id on public.scan_sessions(organization_id);
create index if not exists idx_scan_sessions_created_at on public.scan_sessions(created_at desc);
create index if not exists idx_scan_detections_workspace_id on public.scan_detections(company_workspace_id);
create index if not exists idx_scan_detections_org_id on public.scan_detections(organization_id);
create index if not exists idx_scan_detections_created_at on public.scan_detections(created_at desc);
create index if not exists idx_scan_frames_workspace_id on public.scan_frames(company_workspace_id);
create index if not exists idx_scan_frames_org_id on public.scan_frames(organization_id);
create index if not exists idx_scan_frames_created_at on public.scan_frames(created_at desc);
create index if not exists idx_digital_twin_points_workspace_id on public.digital_twin_points(company_workspace_id);
create index if not exists idx_digital_twin_points_org_id on public.digital_twin_points(organization_id);
create index if not exists idx_digital_twin_points_created_at on public.digital_twin_points(created_at desc);
create index if not exists idx_digital_twin_models_workspace_id on public.digital_twin_models(company_workspace_id);
create index if not exists idx_digital_twin_models_org_id on public.digital_twin_models(organization_id);
create index if not exists idx_digital_twin_models_created_at on public.digital_twin_models(created_at desc);
create index if not exists idx_company_trainings_status on public.company_trainings(status);
create index if not exists idx_company_periodic_controls_status on public.company_periodic_controls(status);
create index if not exists idx_document_templates_created_at on public.document_templates(created_at desc);
create index if not exists idx_question_bank_created_at on public.question_bank(created_at desc);

drop trigger if exists trg_10_scan_sessions_context on public.scan_sessions;
create trigger trg_10_scan_sessions_context
before insert or update on public.scan_sessions
for each row execute function public.sync_scan_session_context();

drop trigger if exists trg_20_scan_sessions_audit on public.scan_sessions;
create trigger trg_20_scan_sessions_audit
before insert or update on public.scan_sessions
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_10_scan_detections_context on public.scan_detections;
create trigger trg_10_scan_detections_context
before insert or update on public.scan_detections
for each row execute function public.sync_scan_child_context();

drop trigger if exists trg_20_scan_detections_audit on public.scan_detections;
create trigger trg_20_scan_detections_audit
before insert or update on public.scan_detections
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_10_scan_frames_context on public.scan_frames;
create trigger trg_10_scan_frames_context
before insert or update on public.scan_frames
for each row execute function public.sync_scan_child_context();

drop trigger if exists trg_20_scan_frames_audit on public.scan_frames;
create trigger trg_20_scan_frames_audit
before insert or update on public.scan_frames
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_10_digital_twin_points_context on public.digital_twin_points;
create trigger trg_10_digital_twin_points_context
before insert or update on public.digital_twin_points
for each row execute function public.sync_scan_child_context();

drop trigger if exists trg_20_digital_twin_points_audit on public.digital_twin_points;
create trigger trg_20_digital_twin_points_audit
before insert or update on public.digital_twin_points
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_10_digital_twin_models_context on public.digital_twin_models;
create trigger trg_10_digital_twin_models_context
before insert or update on public.digital_twin_models
for each row execute function public.sync_scan_child_context();

drop trigger if exists trg_20_digital_twin_models_audit on public.digital_twin_models;
create trigger trg_20_digital_twin_models_audit
before insert or update on public.digital_twin_models
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_company_trainings_audit on public.company_trainings;
create trigger trg_20_company_trainings_audit
before insert or update on public.company_trainings
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_company_periodic_controls_audit on public.company_periodic_controls;
create trigger trg_20_company_periodic_controls_audit
before insert or update on public.company_periodic_controls
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_document_templates_audit on public.document_templates;
create trigger trg_20_document_templates_audit
before insert or update on public.document_templates
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_editor_documents_audit on public.editor_documents;
create trigger trg_20_editor_documents_audit
before insert or update on public.editor_documents
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_isg_tasks_audit on public.isg_tasks;
create trigger trg_20_isg_tasks_audit
before insert or update on public.isg_tasks
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_question_bank_audit on public.question_bank;
create trigger trg_20_question_bank_audit
before insert or update on public.question_bank
for each row execute function public.apply_standard_audit_columns();

drop trigger if exists trg_20_slide_decks_audit on public.slide_decks;
create trigger trg_20_slide_decks_audit
before insert or update on public.slide_decks
for each row execute function public.apply_standard_audit_columns();

drop policy if exists scan_sessions_policy on public.scan_sessions;
create policy scan_sessions_select_workspace
on public.scan_sessions
for select
to authenticated
using (
  company_workspace_id is not null
  and public.can_access_company_workspace(company_workspace_id)
);

create policy scan_sessions_insert_workspace
on public.scan_sessions
for insert
to authenticated
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_sessions_update_workspace
on public.scan_sessions
for update
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
)
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_sessions_delete_workspace
on public.scan_sessions
for delete
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

drop policy if exists scan_detections_policy on public.scan_detections;
create policy scan_detections_select_workspace
on public.scan_detections
for select
to authenticated
using (
  company_workspace_id is not null
  and public.can_access_company_workspace(company_workspace_id)
);

create policy scan_detections_insert_workspace
on public.scan_detections
for insert
to authenticated
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_detections_update_workspace
on public.scan_detections
for update
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
)
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_detections_delete_workspace
on public.scan_detections
for delete
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

drop policy if exists scan_frames_policy on public.scan_frames;
create policy scan_frames_select_workspace
on public.scan_frames
for select
to authenticated
using (
  company_workspace_id is not null
  and public.can_access_company_workspace(company_workspace_id)
);

create policy scan_frames_insert_workspace
on public.scan_frames
for insert
to authenticated
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_frames_update_workspace
on public.scan_frames
for update
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
)
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy scan_frames_delete_workspace
on public.scan_frames
for delete
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

drop policy if exists digital_twin_points_policy on public.digital_twin_points;
create policy digital_twin_points_select_workspace
on public.digital_twin_points
for select
to authenticated
using (
  company_workspace_id is not null
  and public.can_access_company_workspace(company_workspace_id)
);

create policy digital_twin_points_insert_workspace
on public.digital_twin_points
for insert
to authenticated
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy digital_twin_points_update_workspace
on public.digital_twin_points
for update
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
)
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy digital_twin_points_delete_workspace
on public.digital_twin_points
for delete
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

drop policy if exists digital_twin_models_policy on public.digital_twin_models;
create policy digital_twin_models_select_workspace
on public.digital_twin_models
for select
to authenticated
using (
  company_workspace_id is not null
  and public.can_access_company_workspace(company_workspace_id)
);

create policy digital_twin_models_insert_workspace
on public.digital_twin_models
for insert
to authenticated
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy digital_twin_models_update_workspace
on public.digital_twin_models
for update
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
)
with check (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);

create policy digital_twin_models_delete_workspace
on public.digital_twin_models
for delete
to authenticated
using (
  company_workspace_id is not null
  and public.can_manage_company_workspace(company_workspace_id)
);
