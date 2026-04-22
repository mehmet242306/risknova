-- =============================================================================
-- list_company_workspace_activity RPC
-- =============================================================================
-- Surfaces per-workspace activity on the firma (company workspace) detail page.
-- Merges two event sources:
--   1) workspace_activity_logs — trigger-fed, company_workspace_id native
--   2) audit_logs — joined via child-entity company_workspace_id for the
--      ~7 most common business tables (risk, incidents, documents, trainings,
--      committee meetings, periodic controls, isg_tasks).
-- Authorization gate: can_access_company_workspace().
-- =============================================================================

create or replace function public.list_company_workspace_activity(
  p_company_workspace_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  source text,
  action_code text,
  entity_type text,
  entity_id text,
  actor_name text,
  actor_email text,
  payload jsonb,
  severity text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_access_company_workspace(p_company_workspace_id) then
    return;
  end if;

  return query
    with scope_ids as (
      select ra.id::text as scoped_id, 'risk_assessments'::text as scoped_entity
        from public.risk_assessments ra where ra.company_workspace_id = p_company_workspace_id
      union all select ed.id::text, 'editor_documents'
        from public.editor_documents ed where ed.company_workspace_id = p_company_workspace_id
      union all select inc.id::text, 'incidents'
        from public.incidents inc where inc.company_workspace_id = p_company_workspace_id
      union all select ct.id::text, 'company_trainings'
        from public.company_trainings ct where ct.company_workspace_id = p_company_workspace_id
      union all select ccm.id::text, 'company_committee_meetings'
        from public.company_committee_meetings ccm where ccm.company_workspace_id = p_company_workspace_id
      union all select cpc.id::text, 'company_periodic_controls'
        from public.company_periodic_controls cpc where cpc.company_workspace_id = p_company_workspace_id
      union all select tsk.id::text, 'isg_tasks'
        from public.isg_tasks tsk where tsk.company_workspace_id = p_company_workspace_id
    ),
    merged as (
      select
        wal.id,
        'workspace_activity_logs'::text as source,
        wal.event_type as action_code,
        coalesce(wal.event_payload->>'table', 'workspace')::text as entity_type,
        (wal.event_payload->>'record_id')::text as entity_id,
        up.full_name as actor_name,
        up.email as actor_email,
        wal.event_payload as payload,
        'info'::text as severity,
        wal.created_at
      from public.workspace_activity_logs wal
      left join public.user_profiles up on up.auth_user_id = wal.actor_user_id
      where wal.company_workspace_id = p_company_workspace_id

      union all

      select
        al.id,
        'audit_logs'::text as source,
        al.action as action_code,
        al.entity_type,
        al.entity_id,
        up.full_name as actor_name,
        up.email as actor_email,
        coalesce(nullif(al.new_values, '{}'::jsonb), al.metadata_json) as payload,
        al.severity,
        al.created_at
      from public.audit_logs al
      left join public.user_profiles up on up.id = al.actor_user_profile_id
      where al.entity_id is not null
        and exists (
          select 1 from scope_ids si
          where si.scoped_entity = al.entity_type
            and si.scoped_id = al.entity_id
        )
    )
    select m.id, m.source, m.action_code, m.entity_type, m.entity_id,
           m.actor_name, m.actor_email, m.payload, m.severity, m.created_at
    from merged m
    order by m.created_at desc
    limit p_limit;
end;
$$;

revoke all on function public.list_company_workspace_activity(uuid, integer) from public;
grant execute on function public.list_company_workspace_activity(uuid, integer)
  to authenticated, service_role;
