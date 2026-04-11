-- ============================================================
-- Migration: 20260411165000_governance_hardening_phase3
-- ============================================================
-- Section 1 hardening phase 3:
-- - Complete standard audit columns on remaining tables
-- - Extend audit_logs to the target governance schema
-- - Add automatic DB audit triggers on critical tables
-- - Add deleted_at foundation + soft-delete/restore RPCs
-- - Add deleted-record listing and searchable audit RPCs
-- ============================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'audit_logs',
    'company_committee_meetings',
    'company_invitation_permissions',
    'company_invitations',
    'company_join_requests',
    'company_member_module_permissions',
    'editor_document_versions',
    'isg_task_categories',
    'isg_task_completions',
    'organizations',
    'risk_assessments',
    'roles',
    'slide_deck_revisions',
    'slide_media_assets',
    'slides',
    'user_preferences',
    'user_profiles',
    'user_roles',
    'vision_analysis_logs'
  ]
  loop
    execute format(
      'alter table public.%I
         add column if not exists created_by uuid references auth.users(id) on delete set null,
         add column if not exists updated_by uuid references auth.users(id) on delete set null,
         add column if not exists updated_at timestamptz not null default now()',
      v_table
    );
  end loop;
end $$;

alter table public.user_roles
  add column if not exists created_at timestamptz not null default now();

alter table public.risk_assessments
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.audit_logs
  add column if not exists tenant_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists action text,
  add column if not exists old_values jsonb not null default '{}'::jsonb,
  add column if not exists new_values jsonb not null default '{}'::jsonb;

update public.audit_logs
   set user_id = coalesce(audit_logs.user_id, up.auth_user_id),
       action = coalesce(audit_logs.action, audit_logs.action_type),
       old_values = coalesce(audit_logs.old_values, '{}'::jsonb),
       new_values = case
         when coalesce(audit_logs.new_values, '{}'::jsonb) = '{}'::jsonb then coalesce(audit_logs.metadata_json, '{}'::jsonb)
         else audit_logs.new_values
       end,
       created_by = coalesce(audit_logs.created_by, up.auth_user_id),
       updated_by = coalesce(audit_logs.updated_by, up.auth_user_id)
  from public.user_profiles up
 where up.id = audit_logs.actor_user_profile_id;

update public.audit_logs
   set updated_at = coalesce(audit_logs.updated_at, audit_logs.created_at, now());

update public.company_committee_meetings
   set updated_by = coalesce(updated_by, created_by);

update public.company_invitation_permissions p
   set created_by = coalesce(p.created_by, i.inviter_user_id),
       updated_by = coalesce(p.updated_by, i.inviter_user_id),
       updated_at = coalesce(p.updated_at, p.created_at, now())
  from public.company_invitations i
 where i.id = p.invitation_id;

update public.company_invitations
   set created_by = coalesce(created_by, inviter_user_id),
       updated_by = coalesce(updated_by, revoked_by_user_id, declined_by_user_id, accepted_by_user_id, inviter_user_id),
       updated_at = coalesce(updated_at, accepted_at, declined_at, revoked_at, created_at, now());

update public.company_join_requests
   set created_by = coalesce(created_by, requesting_user_id),
       updated_by = coalesce(updated_by, approved_by_user_id, requesting_user_id),
       updated_at = coalesce(updated_at, approved_at, created_at, now());

update public.company_member_module_permissions
   set created_by = coalesce(created_by, granted_by_user_id),
       updated_by = coalesce(updated_by, granted_by_user_id),
       updated_at = coalesce(updated_at, created_at, now());

update public.editor_document_versions
   set created_by = coalesce(
         created_by,
         (select up.auth_user_id from public.user_profiles up where up.id = public.editor_document_versions.changed_by)
       ),
       updated_by = coalesce(
         updated_by,
         (select up.auth_user_id from public.user_profiles up where up.id = public.editor_document_versions.changed_by)
       ),
       updated_at = coalesce(updated_at, created_at, now());

update public.isg_task_categories
   set updated_at = coalesce(updated_at, created_at, now());

update public.isg_task_completions
   set created_by = coalesce(created_by, completed_by),
       updated_by = coalesce(updated_by, completed_by),
       updated_at = coalesce(updated_at, completed_at, created_at, now());

update public.organizations
   set updated_at = coalesce(updated_at, created_at, now());

update public.risk_assessments
   set created_by = coalesce(created_by, created_by_user_id),
       updated_by = coalesce(updated_by, updated_by_user_id, created_by_user_id),
       updated_at = coalesce(updated_at, created_at, now());

update public.roles
   set updated_at = coalesce(updated_at, created_at, now());

update public.slide_deck_revisions
   set updated_by = coalesce(updated_by, created_by),
       updated_at = coalesce(updated_at, created_at, now());

update public.slide_media_assets
   set created_by = coalesce(created_by, uploaded_by),
       updated_by = coalesce(updated_by, uploaded_by),
       updated_at = coalesce(updated_at, created_at, now());

update public.slides
   set updated_at = coalesce(updated_at, created_at, now());

update public.user_preferences
   set created_by = coalesce(created_by, user_id),
       updated_by = coalesce(updated_by, user_id),
       updated_at = coalesce(updated_at, created_at, now());

update public.user_profiles
   set created_by = coalesce(created_by, auth_user_id),
       updated_by = coalesce(updated_by, auth_user_id),
       updated_at = coalesce(updated_at, created_at, now());

update public.user_roles
   set created_at = coalesce(created_at, assigned_at, now()),
       created_by = coalesce(created_by, assigned_by),
       updated_by = coalesce(updated_by, assigned_by),
       updated_at = coalesce(updated_at, assigned_at, created_at, now());

update public.vision_analysis_logs
   set created_by = coalesce(created_by, user_id),
       updated_by = coalesce(updated_by, user_id),
       updated_at = coalesce(updated_at, created_at, now());

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'audit_logs',
    'company_committee_meetings',
    'company_invitation_permissions',
    'company_invitations',
    'company_join_requests',
    'company_member_module_permissions',
    'editor_document_versions',
    'isg_task_categories',
    'isg_task_completions',
    'organizations',
    'risk_assessments',
    'roles',
    'slide_deck_revisions',
    'slide_media_assets',
    'slides',
    'user_preferences',
    'user_profiles',
    'user_roles',
    'vision_analysis_logs'
  ]
  loop
    execute format(
      'drop trigger if exists trg_40_%I_audit on public.%I;
       create trigger trg_40_%I_audit
       before insert or update on public.%I
       for each row execute function public.apply_standard_audit_columns()',
      v_table, v_table, v_table, v_table
    );
  end loop;
end $$;

do $$
declare
  v_table text;
begin
  for v_table in
    select tablename
      from pg_tables
     where schemaname = 'public'
  loop
    execute format(
      'alter table public.%I add column if not exists deleted_at timestamptz',
      v_table
    );
  end loop;
end $$;

create or replace function public.resolve_audit_tenant_id(
  p_old jsonb,
  p_new jsonb
)
returns uuid
language plpgsql
stable
as $$
declare
  v_value text;
begin
  v_value := nullif(coalesce(
    p_new ->> 'company_workspace_id',
    p_old ->> 'company_workspace_id',
    p_new ->> 'tenant_id',
    p_old ->> 'tenant_id'
  ), '');

  if v_value is not null then
    return v_value::uuid;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.resolve_audit_user_id(
  p_old jsonb,
  p_new jsonb
)
returns uuid
language plpgsql
stable
as $$
declare
  v_value text;
begin
  v_value := nullif(coalesce(
    p_new ->> 'updated_by',
    p_new ->> 'created_by',
    p_new ->> 'updated_by_user_id',
    p_new ->> 'created_by_user_id',
    p_new ->> 'user_id',
    p_new ->> 'auth_user_id',
    p_old ->> 'updated_by',
    p_old ->> 'created_by',
    p_old ->> 'updated_by_user_id',
    p_old ->> 'created_by_user_id',
    p_old ->> 'user_id',
    p_old ->> 'auth_user_id',
    auth.uid()::text
  ), '');

  if v_value is not null then
    return v_value::uuid;
  end if;

  return null;
exception when others then
  return auth.uid();
end;
$$;

create or replace function public.resolve_audit_org_id(
  p_old jsonb,
  p_new jsonb
)
returns uuid
language plpgsql
stable
as $$
declare
  v_value text;
begin
  v_value := nullif(coalesce(
    p_new ->> 'organization_id',
    p_old ->> 'organization_id',
    public.current_organization_id()::text
  ), '');

  if v_value is not null then
    return v_value::uuid;
  end if;

  return null;
exception when others then
  return public.current_organization_id();
end;
$$;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := coalesce(to_jsonb(old), '{}'::jsonb);
  v_new jsonb := coalesce(to_jsonb(new), '{}'::jsonb);
  v_org_id uuid;
  v_tenant_id uuid;
  v_user_id uuid;
  v_entity_id text;
  v_action text;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return coalesce(new, old);
  end if;

  v_org_id := public.resolve_audit_org_id(v_old, v_new);
  v_tenant_id := public.resolve_audit_tenant_id(v_old, v_new);
  v_user_id := public.resolve_audit_user_id(v_old, v_new);
  v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');
  v_action := lower(format('%s.%s', tg_table_name, tg_op));

  insert into public.audit_logs (
    organization_id,
    tenant_id,
    actor_user_profile_id,
    user_id,
    action_type,
    action,
    entity_type,
    entity_id,
    severity,
    metadata_json,
    old_values,
    new_values,
    ip_address,
    user_agent,
    created_by,
    updated_by
  )
  values (
    coalesce(v_org_id, public.current_organization_id()),
    v_tenant_id,
    (
      select up.id
        from public.user_profiles up
       where up.auth_user_id = v_user_id
       limit 1
    ),
    v_user_id,
    v_action,
    v_action,
    tg_table_name,
    v_entity_id,
    case when tg_op = 'DELETE' then 'warning' else 'info' end,
    jsonb_build_object('source', 'db_trigger', 'operation', tg_op, 'table', tg_table_name),
    case when tg_op = 'INSERT' then '{}'::jsonb else v_old end,
    case when tg_op = 'DELETE' then '{}'::jsonb else v_new end,
    null,
    null,
    v_user_id,
    v_user_id
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_90_risk_assessments_audit_log on public.risk_assessments;
create trigger trg_90_risk_assessments_audit_log
after insert or update or delete on public.risk_assessments
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_user_profiles_audit_log on public.user_profiles;
create trigger trg_90_user_profiles_audit_log
after insert or update or delete on public.user_profiles
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_company_trainings_audit_log on public.company_trainings;
create trigger trg_90_company_trainings_audit_log
after insert or update or delete on public.company_trainings
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_company_periodic_controls_audit_log on public.company_periodic_controls;
create trigger trg_90_company_periodic_controls_audit_log
after insert or update or delete on public.company_periodic_controls
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_editor_documents_audit_log on public.editor_documents;
create trigger trg_90_editor_documents_audit_log
after insert or update or delete on public.editor_documents
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_incidents_audit_log on public.incidents;
create trigger trg_90_incidents_audit_log
after insert or update or delete on public.incidents
for each row execute function public.capture_audit_log();

drop trigger if exists trg_90_slide_decks_audit_log on public.slide_decks;
create trigger trg_90_slide_decks_audit_log
after insert or update or delete on public.slide_decks
for each row execute function public.capture_audit_log();

create or replace function public.soft_delete_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_updated_by boolean;
  v_sql text;
begin
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = tg_table_name
       and column_name = 'updated_by'
  )
  into v_has_updated_by;

  v_sql := format(
    'update public.%I set deleted_at = now()%s where id = $1 and deleted_at is null',
    tg_table_name,
    case when v_has_updated_by then ', updated_by = auth.uid()' else '' end
  );

  execute v_sql using old.id;
  return null;
end;
$$;

drop trigger if exists trg_95_risk_assessments_soft_delete on public.risk_assessments;
create trigger trg_95_risk_assessments_soft_delete
before delete on public.risk_assessments
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_user_profiles_soft_delete on public.user_profiles;
create trigger trg_95_user_profiles_soft_delete
before delete on public.user_profiles
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_company_trainings_soft_delete on public.company_trainings;
create trigger trg_95_company_trainings_soft_delete
before delete on public.company_trainings
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_company_periodic_controls_soft_delete on public.company_periodic_controls;
create trigger trg_95_company_periodic_controls_soft_delete
before delete on public.company_periodic_controls
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_editor_documents_soft_delete on public.editor_documents;
create trigger trg_95_editor_documents_soft_delete
before delete on public.editor_documents
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_incidents_soft_delete on public.incidents;
create trigger trg_95_incidents_soft_delete
before delete on public.incidents
for each row execute function public.soft_delete_row();

drop trigger if exists trg_95_slide_decks_soft_delete on public.slide_decks;
create trigger trg_95_slide_decks_soft_delete
before delete on public.slide_decks
for each row execute function public.soft_delete_row();

drop policy if exists risk_assessments_hide_deleted_select on public.risk_assessments;
create policy risk_assessments_hide_deleted_select
on public.risk_assessments
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists incidents_hide_deleted_select on public.incidents;
create policy incidents_hide_deleted_select
on public.incidents
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists company_trainings_hide_deleted_select on public.company_trainings;
create policy company_trainings_hide_deleted_select
on public.company_trainings
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists company_periodic_controls_hide_deleted_select on public.company_periodic_controls;
create policy company_periodic_controls_hide_deleted_select
on public.company_periodic_controls
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists editor_documents_hide_deleted_select on public.editor_documents;
create policy editor_documents_hide_deleted_select
on public.editor_documents
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists slide_decks_hide_deleted_select on public.slide_decks;
create policy slide_decks_hide_deleted_select
on public.slide_decks
as restrictive
for select
to authenticated
using (deleted_at is null);

drop policy if exists user_profiles_hide_deleted_select on public.user_profiles;
create policy user_profiles_hide_deleted_select
on public.user_profiles
as restrictive
for select
to authenticated
using (deleted_at is null);

create index if not exists idx_audit_logs_tenant_id on public.audit_logs(tenant_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_entity_type on public.audit_logs(entity_type);
create index if not exists idx_audit_logs_entity_id on public.audit_logs(entity_id);
create index if not exists idx_audit_logs_created_at_desc on public.audit_logs(created_at desc);

create index if not exists idx_risk_assessments_deleted_at on public.risk_assessments(deleted_at);
create index if not exists idx_incidents_deleted_at on public.incidents(deleted_at);
create index if not exists idx_company_trainings_deleted_at on public.company_trainings(deleted_at);
create index if not exists idx_company_periodic_controls_deleted_at on public.company_periodic_controls(deleted_at);
create index if not exists idx_editor_documents_deleted_at on public.editor_documents(deleted_at);
create index if not exists idx_slide_decks_deleted_at on public.slide_decks(deleted_at);
create index if not exists idx_user_profiles_deleted_at on public.user_profiles(deleted_at);

create index if not exists idx_company_committee_meetings_status on public.company_committee_meetings(status);
create index if not exists idx_company_committee_meetings_created_at on public.company_committee_meetings(created_at desc);
create index if not exists idx_risk_assessments_status on public.risk_assessments(status);
create index if not exists idx_user_profiles_created_at on public.user_profiles(created_at desc);
create index if not exists idx_vision_analysis_logs_created_at on public.vision_analysis_logs(created_at desc);
create index if not exists idx_vision_analysis_logs_status on public.vision_analysis_logs(status);

create or replace function public.search_audit_logs(
  p_query text default null,
  p_entity_type text default null,
  p_severity text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  created_at timestamptz,
  action text,
  entity_type text,
  entity_id text,
  severity text,
  tenant_id uuid,
  organization_id uuid,
  user_id uuid,
  actor_name text,
  actor_email text,
  metadata_json jsonb,
  old_values jsonb,
  new_values jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
begin
  return query
  select
    al.id,
    al.created_at,
    coalesce(al.action, al.action_type) as action,
    al.entity_type,
    al.entity_id,
    al.severity,
    al.tenant_id,
    al.organization_id,
    al.user_id,
    coalesce(actor_auth.full_name, actor_legacy.full_name) as actor_name,
    coalesce(actor_auth.email, actor_legacy.email) as actor_email,
    al.metadata_json,
    al.old_values,
    al.new_values
  from public.audit_logs al
  left join public.user_profiles actor_auth
    on actor_auth.auth_user_id = al.user_id
  left join public.user_profiles actor_legacy
    on actor_legacy.id = al.actor_user_profile_id
  where
    (
      public.is_super_admin()
      or al.organization_id = public.current_organization_id()
    )
    and (
      p_entity_type is null
      or al.entity_type = p_entity_type
    )
    and (
      p_severity is null
      or al.severity = p_severity
    )
    and (
      p_query is null
      or coalesce(al.action, al.action_type) ilike '%' || p_query || '%'
      or al.entity_type ilike '%' || p_query || '%'
      or coalesce(al.entity_id, '') ilike '%' || p_query || '%'
      or coalesce(actor_auth.full_name, actor_legacy.full_name, '') ilike '%' || p_query || '%'
      or coalesce(actor_auth.email, actor_legacy.email, '') ilike '%' || p_query || '%'
    )
  order by al.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.search_audit_logs(text, text, text, integer) to authenticated;

create or replace function public.list_deleted_records(
  p_query text default null,
  p_limit integer default 100
)
returns table (
  source_table text,
  record_id uuid,
  label text,
  organization_id uuid,
  tenant_id uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
begin
  return query
  with deleted_rows as (
    select
      'risk_assessments'::text as source_table,
      ra.id as record_id,
      ra.title as label,
      ra.organization_id,
      ra.company_workspace_id as tenant_id,
      ra.deleted_at,
      ra.updated_by as deleted_by,
      ra.status
    from public.risk_assessments ra
    where ra.deleted_at is not null
      and (
        public.is_super_admin()
        or (ra.company_workspace_id is not null and public.can_access_company_workspace(ra.company_workspace_id))
        or ra.organization_id = public.current_organization_id()
      )
    union all
    select
      'incidents',
      i.id,
      coalesce(i.incident_code, i.incident_type, 'Incident'),
      i.organization_id,
      i.company_workspace_id,
      i.deleted_at,
      i.updated_by,
      i.status
    from public.incidents i
    where i.deleted_at is not null
      and (
        public.is_super_admin()
        or (i.company_workspace_id is not null and public.can_access_company_workspace(i.company_workspace_id))
        or i.organization_id = public.current_organization_id()
      )
    union all
    select
      'company_trainings',
      t.id,
      t.title,
      t.organization_id,
      t.company_workspace_id,
      t.deleted_at,
      t.updated_by,
      t.status
    from public.company_trainings t
    where t.deleted_at is not null
      and (
        public.is_super_admin()
        or (t.company_workspace_id is not null and public.can_access_company_workspace(t.company_workspace_id))
        or t.organization_id = public.current_organization_id()
      )
    union all
    select
      'company_periodic_controls',
      c.id,
      c.title,
      c.organization_id,
      c.company_workspace_id,
      c.deleted_at,
      c.updated_by,
      c.status
    from public.company_periodic_controls c
    where c.deleted_at is not null
      and (
        public.is_super_admin()
        or (c.company_workspace_id is not null and public.can_access_company_workspace(c.company_workspace_id))
        or c.organization_id = public.current_organization_id()
      )
    union all
    select
      'editor_documents',
      d.id,
      d.title,
      d.organization_id,
      d.company_workspace_id,
      d.deleted_at,
      d.updated_by,
      d.status
    from public.editor_documents d
    where d.deleted_at is not null
      and (
        public.is_super_admin()
        or (d.company_workspace_id is not null and public.can_access_company_workspace(d.company_workspace_id))
        or d.organization_id = public.current_organization_id()
      )
    union all
    select
      'slide_decks',
      sd.id,
      sd.title,
      sd.organization_id,
      null::uuid,
      sd.deleted_at,
      sd.updated_by,
      sd.status
    from public.slide_decks sd
    where sd.deleted_at is not null
      and (
        public.is_super_admin()
        or sd.organization_id = public.current_organization_id()
      )
    union all
    select
      'user_profiles',
      up.id,
      coalesce(up.full_name, up.email, 'User profile'),
      up.organization_id,
      null::uuid,
      up.deleted_at,
      up.updated_by,
      case when up.is_active then 'active' else 'inactive' end
    from public.user_profiles up
    where up.deleted_at is not null
      and (
        public.is_super_admin()
        or up.organization_id = public.current_organization_id()
      )
  )
  select
    dr.source_table,
    dr.record_id,
    dr.label,
    dr.organization_id,
    dr.tenant_id,
    dr.deleted_at,
    dr.deleted_by,
    dr.status
  from deleted_rows dr
  where
    p_query is null
    or dr.source_table ilike '%' || p_query || '%'
    or coalesce(dr.label, '') ilike '%' || p_query || '%'
    or coalesce(dr.status, '') ilike '%' || p_query || '%'
  order by dr.deleted_at desc
  limit v_limit;
end;
$$;

grant execute on function public.list_deleted_records(text, integer) to authenticated;

create or replace function public.restore_deleted_record(
  p_table_name text,
  p_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored boolean := false;
  v_row_count integer := 0;
begin
  if p_table_name = 'risk_assessments' then
    update public.risk_assessments
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'incidents' then
    update public.incidents
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'company_trainings' then
    update public.company_trainings
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'company_periodic_controls' then
    update public.company_periodic_controls
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'editor_documents' then
    update public.editor_documents
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'slide_decks' then
    update public.slide_decks
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  elsif p_table_name = 'user_profiles' then
    update public.user_profiles
       set deleted_at = null,
           updated_by = auth.uid()
     where id = p_record_id
       and deleted_at is not null
       and (
         public.is_super_admin()
         or organization_id = public.current_organization_id()
       );
    get diagnostics v_row_count = row_count;
    v_restored := v_row_count > 0;
  else
    raise exception 'Unsupported restore target: %', p_table_name;
  end if;

  return v_restored;
end;
$$;

grant execute on function public.restore_deleted_record(text, uuid) to authenticated;
