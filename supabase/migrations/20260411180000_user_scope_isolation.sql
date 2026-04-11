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

create or replace function public.can_access_risk_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.risk_assessments ra
    where ra.id = p_assessment_id
      and (
        (ra.company_workspace_id is not null and public.can_access_company_workspace(ra.company_workspace_id))
        or (ra.company_workspace_id is null and ra.created_by_user_id = auth.uid())
      )
  )
$$;

create or replace function public.can_manage_risk_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.risk_assessments ra
    where ra.id = p_assessment_id
      and (
        (ra.company_workspace_id is not null and public.can_manage_company_workspace(ra.company_workspace_id))
        or (ra.company_workspace_id is null and ra.created_by_user_id = auth.uid())
      )
  )
$$;

create or replace function public.can_access_incident(p_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.incidents i
    where i.id = p_incident_id
      and (
        (i.company_workspace_id is not null and public.can_access_company_workspace(i.company_workspace_id))
        or (i.company_workspace_id is null and i.created_by = auth.uid())
      )
  )
$$;

create or replace function public.can_manage_incident(p_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.incidents i
    where i.id = p_incident_id
      and (
        (i.company_workspace_id is not null and public.can_manage_company_workspace(i.company_workspace_id))
        or (i.company_workspace_id is null and i.created_by = auth.uid())
      )
  )
$$;

drop policy if exists company_workspaces_select on public.company_workspaces;
create policy company_workspaces_select
on public.company_workspaces
for select
to authenticated
using (public.can_access_company_workspace(id));

drop policy if exists company_workspaces_update on public.company_workspaces;
create policy company_workspaces_update
on public.company_workspaces
for update
to authenticated
using (public.can_manage_company_workspace(id))
with check (public.can_manage_company_workspace(id));

drop policy if exists "risk_assessments_select_own_org" on public.risk_assessments;
drop policy if exists "risk_assessments_select_own_scope" on public.risk_assessments;
create policy "risk_assessments_select_own_scope"
on public.risk_assessments
for select
to authenticated
using (
  (company_workspace_id is not null and public.can_access_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by_user_id = auth.uid())
);

drop policy if exists "risk_assessments_insert_own_org" on public.risk_assessments;
drop policy if exists "risk_assessments_insert_own_scope" on public.risk_assessments;
create policy "risk_assessments_insert_own_scope"
on public.risk_assessments
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by_user_id = auth.uid()
  and (
    (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
    or company_workspace_id is null
  )
);

drop policy if exists "risk_assessments_update_own_org" on public.risk_assessments;
drop policy if exists "risk_assessments_update_own_scope" on public.risk_assessments;
create policy "risk_assessments_update_own_scope"
on public.risk_assessments
for update
to authenticated
using (
  (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by_user_id = auth.uid())
)
with check (
  organization_id = public.current_organization_id()
  and (
    (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
    or (company_workspace_id is null and created_by_user_id = auth.uid())
  )
);

drop policy if exists "risk_assessments_delete_own_org" on public.risk_assessments;
drop policy if exists "risk_assessments_delete_own_scope" on public.risk_assessments;
create policy "risk_assessments_delete_own_scope"
on public.risk_assessments
for delete
to authenticated
using (
  (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by_user_id = auth.uid())
);

drop policy if exists "Users can view their org rows" on public.risk_assessment_rows;
drop policy if exists "Users can view their scoped rows" on public.risk_assessment_rows;
create policy "Users can view their scoped rows"
on public.risk_assessment_rows
for select
using (public.can_access_risk_assessment(assessment_id));

drop policy if exists "Users can insert their org rows" on public.risk_assessment_rows;
drop policy if exists "Users can insert their scoped rows" on public.risk_assessment_rows;
create policy "Users can insert their scoped rows"
on public.risk_assessment_rows
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can update their org rows" on public.risk_assessment_rows;
drop policy if exists "Users can update their scoped rows" on public.risk_assessment_rows;
create policy "Users can update their scoped rows"
on public.risk_assessment_rows
for update
using (public.can_manage_risk_assessment(assessment_id))
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can delete their org rows" on public.risk_assessment_rows;
drop policy if exists "Users can delete their scoped rows" on public.risk_assessment_rows;
create policy "Users can delete their scoped rows"
on public.risk_assessment_rows
for delete
using (public.can_manage_risk_assessment(assessment_id));

drop policy if exists "Users can view their org images" on public.risk_assessment_images;
drop policy if exists "Users can view their scoped images" on public.risk_assessment_images;
create policy "Users can view their scoped images"
on public.risk_assessment_images
for select
using (public.can_access_risk_assessment(assessment_id));

drop policy if exists "Users can insert their org images" on public.risk_assessment_images;
drop policy if exists "Users can insert their scoped images" on public.risk_assessment_images;
create policy "Users can insert their scoped images"
on public.risk_assessment_images
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can update their org images" on public.risk_assessment_images;
drop policy if exists "Users can update their scoped images" on public.risk_assessment_images;
create policy "Users can update their scoped images"
on public.risk_assessment_images
for update
using (public.can_manage_risk_assessment(assessment_id))
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can delete their org images" on public.risk_assessment_images;
drop policy if exists "Users can delete their scoped images" on public.risk_assessment_images;
create policy "Users can delete their scoped images"
on public.risk_assessment_images
for delete
using (public.can_manage_risk_assessment(assessment_id));

drop policy if exists "Users can view their org findings" on public.risk_assessment_findings;
drop policy if exists "Users can view their scoped findings" on public.risk_assessment_findings;
create policy "Users can view their scoped findings"
on public.risk_assessment_findings
for select
using (public.can_access_risk_assessment(assessment_id));

drop policy if exists "Users can insert their org findings" on public.risk_assessment_findings;
drop policy if exists "Users can insert their scoped findings" on public.risk_assessment_findings;
create policy "Users can insert their scoped findings"
on public.risk_assessment_findings
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can update their org findings" on public.risk_assessment_findings;
drop policy if exists "Users can update their scoped findings" on public.risk_assessment_findings;
create policy "Users can update their scoped findings"
on public.risk_assessment_findings
for update
using (public.can_manage_risk_assessment(assessment_id))
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_risk_assessment(assessment_id)
);

drop policy if exists "Users can delete their org findings" on public.risk_assessment_findings;
drop policy if exists "Users can delete their scoped findings" on public.risk_assessment_findings;
create policy "Users can delete their scoped findings"
on public.risk_assessment_findings
for delete
using (public.can_manage_risk_assessment(assessment_id));

drop policy if exists "incidents_select" on public.incidents;
create policy "incidents_select"
on public.incidents
for select
using (
  (company_workspace_id is not null and public.can_access_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by = auth.uid())
);

drop policy if exists "incidents_insert" on public.incidents;
create policy "incidents_insert"
on public.incidents
for insert
with check (
  organization_id = public.current_organization_id()
  and (
    (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
    or (company_workspace_id is null and created_by = auth.uid())
  )
);

drop policy if exists "incidents_update" on public.incidents;
create policy "incidents_update"
on public.incidents
for update
using (
  (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by = auth.uid())
)
with check (
  organization_id = public.current_organization_id()
  and (
    (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
    or (company_workspace_id is null and created_by = auth.uid())
  )
);

drop policy if exists "incidents_delete" on public.incidents;
create policy "incidents_delete"
on public.incidents
for delete
using (
  (company_workspace_id is not null and public.can_manage_company_workspace(company_workspace_id))
  or (company_workspace_id is null and created_by = auth.uid())
);

drop policy if exists "witnesses_select" on public.incident_witnesses;
create policy "witnesses_select"
on public.incident_witnesses
for select
using (public.can_access_incident(incident_id));

drop policy if exists "witnesses_insert" on public.incident_witnesses;
create policy "witnesses_insert"
on public.incident_witnesses
for insert
with check (public.can_manage_incident(incident_id));

drop policy if exists "witnesses_update" on public.incident_witnesses;
create policy "witnesses_update"
on public.incident_witnesses
for update
using (public.can_manage_incident(incident_id))
with check (public.can_manage_incident(incident_id));

drop policy if exists "witnesses_delete" on public.incident_witnesses;
create policy "witnesses_delete"
on public.incident_witnesses
for delete
using (public.can_manage_incident(incident_id));

drop policy if exists "dof_select" on public.incident_dof;
create policy "dof_select"
on public.incident_dof
for select
using (public.can_access_incident(incident_id));

drop policy if exists "dof_insert" on public.incident_dof;
create policy "dof_insert"
on public.incident_dof
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_incident(incident_id)
);

drop policy if exists "dof_update" on public.incident_dof;
create policy "dof_update"
on public.incident_dof
for update
using (public.can_manage_incident(incident_id))
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_incident(incident_id)
);

drop policy if exists "dof_delete" on public.incident_dof;
create policy "dof_delete"
on public.incident_dof
for delete
using (public.can_manage_incident(incident_id));

drop policy if exists "ishikawa_select" on public.incident_ishikawa;
create policy "ishikawa_select"
on public.incident_ishikawa
for select
using (public.can_access_incident(incident_id));

drop policy if exists "ishikawa_insert" on public.incident_ishikawa;
create policy "ishikawa_insert"
on public.incident_ishikawa
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_incident(incident_id)
);

drop policy if exists "ishikawa_update" on public.incident_ishikawa;
create policy "ishikawa_update"
on public.incident_ishikawa
for update
using (public.can_manage_incident(incident_id))
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_incident(incident_id)
);

drop policy if exists "ishikawa_delete" on public.incident_ishikawa;
create policy "ishikawa_delete"
on public.incident_ishikawa
for delete
using (public.can_manage_incident(incident_id));

drop policy if exists "org_access" on public.company_trainings;
drop policy if exists "company_trainings_member_scope" on public.company_trainings;
create policy "company_trainings_member_scope"
on public.company_trainings
for all
using (public.can_access_company_workspace(company_workspace_id))
with check (public.can_manage_company_workspace(company_workspace_id));

drop policy if exists "org_access" on public.company_training_attendees;
drop policy if exists "company_training_attendees_member_scope" on public.company_training_attendees;
create policy "company_training_attendees_member_scope"
on public.company_training_attendees
for all
using (
  exists (
    select 1
    from public.company_trainings t
    where t.id = training_id
      and public.can_access_company_workspace(t.company_workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.company_trainings t
    where t.id = training_id
      and public.can_manage_company_workspace(t.company_workspace_id)
  )
);

drop policy if exists "org_access" on public.company_periodic_controls;
drop policy if exists "company_periodic_controls_member_scope" on public.company_periodic_controls;
create policy "company_periodic_controls_member_scope"
on public.company_periodic_controls
for all
using (public.can_access_company_workspace(company_workspace_id))
with check (public.can_manage_company_workspace(company_workspace_id));

do $$
begin
  if to_regclass('public.company_committee_meetings') is not null then
    execute 'drop policy if exists "org_access" on public.company_committee_meetings';
    execute 'drop policy if exists "company_committee_meetings_member_scope" on public.company_committee_meetings';
    execute '
      create policy "company_committee_meetings_member_scope"
      on public.company_committee_meetings
      for all
      using (public.can_access_company_workspace(company_workspace_id))
      with check (public.can_manage_company_workspace(company_workspace_id))
    ';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'alter table public.notifications enable row level security';
    execute '
      insert into public.notifications (
        organization_id,
        user_id,
        title,
        message,
        type,
        level,
        link,
        actor_name,
        is_read,
        created_at
      )
      select
        n.organization_id,
        up.auth_user_id,
        n.title,
        n.message,
        n.type,
        n.level,
        n.link,
        n.actor_name,
        n.is_read,
        n.created_at
      from public.notifications n
      join public.user_profiles up
        on up.organization_id = n.organization_id
       and up.auth_user_id is not null
       and up.is_active = true
      where n.user_id is null
        and not exists (
          select 1
          from public.notifications existing
          where existing.organization_id = n.organization_id
            and existing.user_id = up.auth_user_id
            and existing.title is not distinct from n.title
            and existing.message is not distinct from n.message
            and existing.created_at is not distinct from n.created_at
        )
    ';
    execute 'drop policy if exists notifications_select_self on public.notifications';
    execute '
      create policy notifications_select_self
      on public.notifications
      for select
      to authenticated
      using (user_id = auth.uid())
    ';
    execute 'drop policy if exists notifications_insert_self on public.notifications';
    execute '
      create policy notifications_insert_self
      on public.notifications
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and organization_id = public.current_organization_id()
      )
    ';
    execute 'drop policy if exists notifications_update_self on public.notifications';
    execute '
      create policy notifications_update_self
      on public.notifications
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid())
    ';
    execute 'drop policy if exists notifications_delete_self on public.notifications';
    execute '
      create policy notifications_delete_self
      on public.notifications
      for delete
      to authenticated
      using (user_id = auth.uid())
    ';
    execute 'delete from public.notifications where user_id is null';
  end if;
end;
$$;
