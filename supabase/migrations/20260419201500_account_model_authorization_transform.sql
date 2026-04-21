-- =============================================================================
-- Account model and authorization transformation
-- =============================================================================
-- Purpose:
-- - Keep existing organizations table as the account container.
-- - Introduce only 3 customer-facing account types: individual, osgb, enterprise.
-- - Keep platform admin separate from account_type because it is a global internal
--   authorization concern, not a commercial customer identity.
-- - Do not create extra customer-facing account types for public institutions,
--   consultants, physicians, or independent professionals. These remain under
--   the individual account type unless future product rules explicitly split them.
-- - Prefer archive over hard delete for company workspaces so risk/audit history
--   stays recoverable and active-plan limits can ignore archived records.
-- - Scope risk assessments to company_workspace_id for cleaner workspace isolation.
-- - Professional specialization is handled separately from account_type. For
--   example, Turkish occupational safety specialists stay within the same
--   customer-facing model while their A/B/C class is tracked through the
--   certification layer instead of creating extra account types.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

alter table public.organizations
  add column if not exists account_type text,
  add column if not exists status text not null default 'active',
  add column if not exists current_plan_id uuid;

update public.organizations
   set account_type = case
     when lower(coalesce(organization_type, '')) in ('osgb', 'osgb_manager') then 'osgb'
     when lower(coalesce(organization_type, '')) in ('enterprise', 'corporate', 'kurumsal') then 'enterprise'
     else 'individual'
   end
 where account_type is null;

alter table public.organizations
  alter column account_type set default 'individual';

alter table public.organizations
  alter column account_type set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'organizations_account_type_check'
       and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_account_type_check
      check (account_type in ('individual', 'osgb', 'enterprise'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'organizations_status_check'
       and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_status_check
      check (status in ('active', 'trialing', 'suspended', 'archived'));
  end if;
end $$;

create index if not exists idx_organizations_account_type
  on public.organizations(account_type);

create index if not exists idx_organizations_status
  on public.organizations(status);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'organization_memberships_role_check'
       and conrelid = 'public.organization_memberships'::regclass
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_role_check
      check (role in ('owner', 'admin', 'staff', 'viewer'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'organization_memberships_status_check'
       and conrelid = 'public.organization_memberships'::regclass
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_status_check
      check (status in ('active', 'invited', 'suspended', 'archived'));
  end if;
end $$;

create index if not exists idx_organization_memberships_org
  on public.organization_memberships(organization_id, status);

create index if not exists idx_organization_memberships_user
  on public.organization_memberships(user_id, status);

insert into public.organization_memberships (organization_id, user_id, role)
select
  up.organization_id,
  up.auth_user_id,
  case
    when exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_profile_id = up.id
         and r.code in ('super_admin', 'platform_admin', 'organization_admin')
    ) then 'admin'
    else 'owner'
  end
from public.user_profiles up
where up.auth_user_id is not null
on conflict (organization_id, user_id) do nothing;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id)
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'platform_admins_role_check'
       and conrelid = 'public.platform_admins'::regclass
  ) then
    alter table public.platform_admins
      add constraint platform_admins_role_check
      check (role in ('super_admin', 'support_admin', 'billing_admin', 'content_admin', 'readonly_admin', 'admin'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'platform_admins_status_check'
       and conrelid = 'public.platform_admins'::regclass
  ) then
    alter table public.platform_admins
      add constraint platform_admins_status_check
      check (status in ('active', 'disabled', 'invited'));
  end if;
end $$;

insert into public.platform_admins (user_id, role, status, created_by_user_id)
select
  up.auth_user_id,
  case
    when exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_profile_id = up.id
         and r.code = 'super_admin'
    ) then 'super_admin'
    when exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_profile_id = up.id
         and r.code = 'platform_admin'
    ) then 'support_admin'
    else 'admin'
  end,
  'active',
  up.auth_user_id
from public.user_profiles up
where up.auth_user_id is not null
  and (
    coalesce(up.is_super_admin, false) = true
    or exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_profile_id = up.id
         and r.code in ('super_admin', 'platform_admin')
    )
  )
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.platform_admins pa
     where pa.user_id = uid
       and pa.status = 'active'
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

create or replace function public.is_account_owner_or_admin(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.organization_memberships om
     where om.organization_id = p_organization_id
       and om.user_id = p_user_id
       and om.status = 'active'
       and om.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_account_owner_or_admin(uuid, uuid) from public;
grant execute on function public.is_account_owner_or_admin(uuid, uuid) to authenticated, service_role;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null,
  max_active_workspaces integer,
  max_active_staff_seats integer,
  has_personnel_module boolean not null default false,
  has_task_tracking boolean not null default false,
  has_announcements boolean not null default false,
  has_advanced_reports boolean not null default false,
  contact_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'plans_account_type_check'
       and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_account_type_check
      check (account_type in ('individual', 'osgb', 'enterprise'));
  end if;
end $$;

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'organization_subscriptions_status_check'
       and conrelid = 'public.organization_subscriptions'::regclass
  ) then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_status_check
      check (status in ('active', 'trialing', 'expired', 'cancelled'));
  end if;
end $$;

create index if not exists idx_organization_subscriptions_org
  on public.organization_subscriptions(organization_id, status, starts_at desc);

insert into public.plans (
  code,
  name,
  account_type,
  max_active_workspaces,
  max_active_staff_seats,
  has_personnel_module,
  has_task_tracking,
  has_announcements,
  has_advanced_reports,
  contact_required
) values
  ('individual_free', 'Bireysel Ücretsiz', 'individual', 1, 1, false, false, false, false, false),
  ('individual_pro', 'Bireysel Pro', 'individual', 10, 1, false, true, false, true, false),
  ('osgb_starter', 'OSGB Starter', 'osgb', 5, 2, true, true, true, false, false),
  ('osgb_team', 'OSGB Team', 'osgb', 15, 5, true, true, true, true, false),
  ('enterprise', 'Enterprise', 'enterprise', null, null, true, true, true, true, true)
on conflict (code) do update
set
  name = excluded.name,
  account_type = excluded.account_type,
  max_active_workspaces = excluded.max_active_workspaces,
  max_active_staff_seats = excluded.max_active_staff_seats,
  has_personnel_module = excluded.has_personnel_module,
  has_task_tracking = excluded.has_task_tracking,
  has_announcements = excluded.has_announcements,
  has_advanced_reports = excluded.has_advanced_reports,
  contact_required = excluded.contact_required,
  is_active = true;

update public.organizations o
   set current_plan_id = p.id
  from public.plans p
 where o.current_plan_id is null
   and (
     (o.account_type = 'individual' and p.code = 'individual_free')
     or (o.account_type = 'osgb' and p.code = 'osgb_starter')
     or (o.account_type = 'enterprise' and p.code = 'enterprise')
   );

insert into public.organization_subscriptions (organization_id, plan_id, status)
select o.id, o.current_plan_id, 'active'
from public.organizations o
where o.current_plan_id is not null
  and not exists (
    select 1
      from public.organization_subscriptions s
     where s.organization_id = o.id
       and s.status in ('active', 'trialing')
  );

alter table public.organizations
  add constraint organizations_current_plan_id_fkey
  foreign key (current_plan_id) references public.plans(id);

create or replace function public.current_plan_limits(p_organization_id uuid)
returns table (
  plan_id uuid,
  plan_code text,
  max_active_workspaces integer,
  max_active_staff_seats integer,
  has_personnel_module boolean,
  has_task_tracking boolean,
  has_announcements boolean,
  has_advanced_reports boolean,
  contact_required boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.code,
    p.max_active_workspaces,
    p.max_active_staff_seats,
    p.has_personnel_module,
    p.has_task_tracking,
    p.has_announcements,
    p.has_advanced_reports,
    p.contact_required
  from public.organizations o
  join public.plans p on p.id = o.current_plan_id
  where o.id = p_organization_id
  limit 1
$$;

create or replace function public.active_company_workspace_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.company_workspaces cw
   where cw.organization_id = p_organization_id
     and coalesce(cw.status, case when coalesce(cw.is_archived, false) then 'archived' else 'active' end) = 'active'
$$;

create or replace function public.active_account_staff_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.organization_memberships om
   where om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role in ('admin', 'staff')
$$;

create or replace function public.has_active_workspace_capacity(p_organization_id uuid, p_ignore_workspace_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select cpl.max_active_workspaces
    into v_limit
    from public.current_plan_limits(p_organization_id) cpl;

  if v_limit is null then
    return true;
  end if;

  select count(*)::integer
    into v_count
    from public.company_workspaces cw
   where cw.organization_id = p_organization_id
     and coalesce(cw.status, case when coalesce(cw.is_archived, false) then 'archived' else 'active' end) = 'active'
     and (p_ignore_workspace_id is null or cw.id <> p_ignore_workspace_id);

  return v_count < v_limit;
end;
$$;

create or replace function public.has_active_staff_capacity(p_organization_id uuid, p_ignore_user_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select cpl.max_active_staff_seats
    into v_limit
    from public.current_plan_limits(p_organization_id) cpl;

  if v_limit is null then
    return true;
  end if;

  select count(*)::integer
    into v_count
    from public.organization_memberships om
   where om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role in ('admin', 'staff')
     and (p_ignore_user_id is null or om.user_id <> p_ignore_user_id);

  return v_count < v_limit;
end;
$$;

create or replace function public.create_company_identity_with_workspace(
  p_official_name text,
  p_sector text default null,
  p_nace_code text default null,
  p_hazard_class text default null,
  p_address text default null,
  p_city text default null,
  p_district text default null,
  p_tax_number text default null,
  p_display_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_company_identity_id uuid;
  v_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  v_org := public.current_user_organization_id();

  if v_org is null then
    raise exception 'Current user organization not found.';
  end if;

  if not public.has_active_workspace_capacity(v_org) then
    raise exception 'Active workspace limit reached for current plan.';
  end if;

  insert into public.company_identities (
    official_name,
    sector,
    nace_code,
    hazard_class,
    address,
    city,
    district,
    tax_number,
    owner_organization_id,
    created_by,
    updated_by
  )
  values (
    trim(p_official_name),
    nullif(trim(p_sector), ''),
    nullif(trim(p_nace_code), ''),
    nullif(trim(p_hazard_class), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_district), ''),
    nullif(trim(p_tax_number), ''),
    v_org,
    auth.uid(),
    auth.uid()
  )
  returning id into v_company_identity_id;

  insert into public.company_workspaces (
    organization_id,
    company_identity_id,
    display_name,
    notes,
    is_primary_workspace,
    is_archived,
    status,
    created_by,
    updated_by,
    created_by_user_id
  )
  values (
    v_org,
    v_company_identity_id,
    coalesce(nullif(trim(p_display_name), ''), trim(p_official_name)),
    nullif(trim(p_notes), ''),
    true,
    false,
    'active',
    auth.uid(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_workspace_id;

  insert into public.company_memberships (
    company_identity_id,
    company_workspace_id,
    organization_id,
    user_id,
    membership_role,
    employment_type,
    status,
    can_view_shared_operations,
    can_create_shared_operations,
    can_approve_join_requests,
    is_primary_contact,
    approved_by,
    approved_at,
    created_by,
    updated_by
  )
  values (
    v_company_identity_id,
    v_workspace_id,
    v_org,
    auth.uid(),
    'owner',
    'internal',
    'active',
    true,
    true,
    true,
    true,
    auth.uid(),
    now(),
    auth.uid(),
    auth.uid()
  )
  on conflict (company_identity_id, organization_id, user_id, membership_role)
  do update set
    company_workspace_id = excluded.company_workspace_id,
    status = 'active',
    can_view_shared_operations = true,
    can_create_shared_operations = true,
    can_approve_join_requests = true,
    is_primary_contact = true,
    approved_by = auth.uid(),
    approved_at = now(),
    updated_by = auth.uid(),
    updated_at = now();

  return v_workspace_id;
end;
$$;

create or replace function public.archive_company_identity(
  p_company_identity_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_company_invitations(p_company_identity_id) then
    raise exception 'not allowed to archive company identity';
  end if;

  update public.company_identities
     set is_archived = true,
         archived_at = now(),
         archived_by_user_id = auth.uid()
   where id = p_company_identity_id;

  update public.company_workspaces
     set is_archived = true,
         status = 'archived',
         archived_at = coalesce(archived_at, now()),
         archived_by_user_id = coalesce(archived_by_user_id, auth.uid())
   where company_identity_id = p_company_identity_id
     and is_archived = false;
end;
$$;

create or replace function public.restore_archived_company_identity(
  p_company_identity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  if not public.is_company_member(p_company_identity_id) then
    raise exception 'Not allowed to restore this company.';
  end if;

  select cw.organization_id, cw.id
    into v_org, v_workspace_id
    from public.company_workspaces cw
   where cw.company_identity_id = p_company_identity_id
   order by cw.created_at asc
   limit 1;

  if v_org is null then
    raise exception 'Company workspace not found.';
  end if;

  if not public.has_active_workspace_capacity(v_org, v_workspace_id) then
    raise exception 'Active workspace limit reached for current plan.';
  end if;

  update public.company_identities
     set is_archived = false,
         archived_at = null,
         archived_by_user_id = null,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_company_identity_id
     and is_archived = true;

  update public.company_workspaces
     set is_archived = false,
         status = 'active',
         archived_at = null,
         archived_by_user_id = null
   where company_identity_id = p_company_identity_id
     and is_archived = true;
end;
$$;

alter table public.company_workspaces
  add column if not exists status text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

update public.company_workspaces
   set status = case when coalesce(is_archived, false) then 'archived' else 'active' end
 where status is null;

update public.company_workspaces
   set archived_at = now()
 where archived_at is null
   and coalesce(is_archived, false) = true;

update public.company_workspaces
   set created_by_user_id = created_by
 where created_by_user_id is null
   and created_by is not null;

alter table public.company_workspaces
  alter column status set default 'active';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'company_workspaces_status_check'
       and conrelid = 'public.company_workspaces'::regclass
  ) then
    alter table public.company_workspaces
      add constraint company_workspaces_status_check
      check (status in ('active', 'archived'));
  end if;
end $$;

create index if not exists idx_company_workspaces_status
  on public.company_workspaces(organization_id, status);

create table if not exists public.workspace_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid not null references public.company_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  professional_role text not null,
  assignment_status text not null default 'active',
  can_view boolean not null default true,
  can_create_risk boolean not null default true,
  can_edit_risk boolean not null default true,
  can_approve boolean not null default false,
  can_sign boolean not null default false,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id),
  unique (company_workspace_id, user_id, professional_role)
);

comment on table public.workspace_assignments is
  'Assigns account members to firm workspaces. professional_role describes operational duty and is separate from customer-facing account_type.';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'workspace_assignments_professional_role_check'
       and conrelid = 'public.workspace_assignments'::regclass
  ) then
    alter table public.workspace_assignments
      add constraint workspace_assignments_professional_role_check
      check (
        professional_role in (
          'isg_uzmani',
          'isyeri_hekimi',
          'diger_saglik_personeli',
          'operasyon_sorumlusu',
          'viewer'
        )
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'workspace_assignments_status_check'
       and conrelid = 'public.workspace_assignments'::regclass
  ) then
    alter table public.workspace_assignments
      add constraint workspace_assignments_status_check
      check (assignment_status in ('active', 'ended', 'suspended'));
  end if;
end $$;

create index if not exists idx_workspace_assignments_workspace
  on public.workspace_assignments(company_workspace_id, assignment_status);

create index if not exists idx_workspace_assignments_user
  on public.workspace_assignments(user_id, assignment_status);

create table if not exists public.workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text,
  due_date date,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_task_assignments (
  task_id uuid not null references public.workspace_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists public.workspace_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  title text not null,
  body text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_activity_logs_org
  on public.workspace_activity_logs(organization_id, created_at desc);

create index if not exists idx_workspace_activity_logs_workspace
  on public.workspace_activity_logs(company_workspace_id, created_at desc);

create table if not exists public.enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text,
  email text,
  phone text,
  message text,
  estimated_employee_count integer,
  estimated_location_count integer,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'enterprise_leads_status_check'
       and conrelid = 'public.enterprise_leads'::regclass
  ) then
    alter table public.enterprise_leads
      add constraint enterprise_leads_status_check
      check (status in ('new', 'qualified', 'contacted', 'closed'));
  end if;
end $$;

alter table public.risk_assessments
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null;

create index if not exists idx_risk_assessments_company_workspace_id
  on public.risk_assessments(company_workspace_id);

create or replace function public.can_access_company_workspace(p_company_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(auth.uid())
    or exists (
      select 1
        from public.company_workspaces cw
       where cw.id = p_company_workspace_id
         and public.is_account_owner_or_admin(cw.organization_id)
    )
    or exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = p_company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_view = true
    )
    or exists (
      select 1
        from public.company_memberships cm
       where cm.company_workspace_id = p_company_workspace_id
         and cm.user_id = auth.uid()
         and cm.status = 'active'
         and cm.can_view_shared_operations = true
    );
$$;

create or replace function public.can_manage_company_workspace(p_company_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(auth.uid())
    or exists (
      select 1
        from public.company_workspaces cw
       where cw.id = p_company_workspace_id
         and public.is_account_owner_or_admin(cw.organization_id)
    )
    or exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = p_company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_edit_risk = true
    );
$$;

create or replace function public.log_workspace_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
  v_org_id uuid;
  v_workspace_id uuid;
begin
  if tg_table_name = 'company_workspaces' then
    v_workspace_id := coalesce(new.id, old.id);
    v_org_id := coalesce(new.organization_id, old.organization_id);

    if tg_op = 'INSERT' then
      v_event_type := 'workspace.created';
    elsif tg_op = 'UPDATE' and coalesce(old.status, case when old.is_archived then 'archived' else 'active' end) <> coalesce(new.status, case when new.is_archived then 'archived' else 'active' end) and new.status = 'archived' then
      v_event_type := 'workspace.archived';
    elsif tg_op = 'UPDATE' and coalesce(old.status, case when old.is_archived then 'archived' else 'active' end) <> coalesce(new.status, case when new.is_archived then 'archived' else 'active' end) and new.status = 'active' then
      v_event_type := 'workspace.restored';
    else
      return coalesce(new, old);
    end if;
  elsif tg_table_name = 'workspace_assignments' then
    v_workspace_id := coalesce(new.company_workspace_id, old.company_workspace_id);
    v_org_id := coalesce(new.organization_id, old.organization_id);
    if tg_op = 'INSERT' then
      v_event_type := 'workspace.assignment.created';
    elsif tg_op = 'DELETE' then
      v_event_type := 'workspace.assignment.deleted';
    else
      v_event_type := 'workspace.assignment.updated';
    end if;
  elsif tg_table_name = 'risk_assessments' then
    v_workspace_id := coalesce(new.company_workspace_id, old.company_workspace_id);
    v_org_id := coalesce(new.organization_id, old.organization_id);
    if tg_op = 'INSERT' then
      v_event_type := 'risk_assessment.created';
    else
      v_event_type := 'risk_assessment.updated';
    end if;
  else
    return coalesce(new, old);
  end if;

  insert into public.workspace_activity_logs (
    organization_id,
    company_workspace_id,
    actor_user_id,
    event_type,
    event_payload
  ) values (
    v_org_id,
    v_workspace_id,
    auth.uid(),
    v_event_type,
    jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'record_id', coalesce(new.id, old.id)
    )
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_company_workspaces_activity on public.company_workspaces;
create trigger trg_company_workspaces_activity
after insert or update on public.company_workspaces
for each row execute function public.log_workspace_activity();

drop trigger if exists trg_workspace_assignments_activity on public.workspace_assignments;
create trigger trg_workspace_assignments_activity
after insert or update or delete on public.workspace_assignments
for each row execute function public.log_workspace_activity();

drop trigger if exists trg_risk_assessments_activity on public.risk_assessments;
create trigger trg_risk_assessments_activity
after insert or update on public.risk_assessments
for each row execute function public.log_workspace_activity();

alter table public.organization_memberships enable row level security;
alter table public.company_workspaces enable row level security;
alter table public.company_identities enable row level security;
alter table public.workspace_assignments enable row level security;
alter table public.workspace_tasks enable row level security;
alter table public.workspace_task_assignments enable row level security;
alter table public.workspace_announcements enable row level security;
alter table public.workspace_activity_logs enable row level security;

drop policy if exists organization_memberships_select on public.organization_memberships;
create policy organization_memberships_select
on public.organization_memberships
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or user_id = auth.uid()
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists organization_memberships_insert on public.organization_memberships;
create policy organization_memberships_insert
on public.organization_memberships
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists company_workspaces_select_account_or_assignment on public.company_workspaces;
create policy company_workspaces_select_account_or_assignment
on public.company_workspaces
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or public.can_access_company_workspace(id)
);

drop policy if exists company_workspaces_insert_account_admin on public.company_workspaces;
create policy company_workspaces_insert_account_admin
on public.company_workspaces
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists company_workspaces_update_account_admin on public.company_workspaces;
create policy company_workspaces_update_account_admin
on public.company_workspaces
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists company_identities_select_account_or_assignment on public.company_identities;
create policy company_identities_select_account_or_assignment
on public.company_identities
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    owner_organization_id is not null
    and public.is_account_owner_or_admin(owner_organization_id)
  )
  or exists (
    select 1
      from public.company_workspaces cw
     where cw.company_identity_id = company_identities.id
       and public.can_access_company_workspace(cw.id)
  )
);

drop policy if exists organization_memberships_update on public.organization_memberships;
create policy organization_memberships_update
on public.organization_memberships
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_assignments_select on public.workspace_assignments;
create policy workspace_assignments_select
on public.workspace_assignments
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or user_id = auth.uid()
);

drop policy if exists workspace_assignments_insert on public.workspace_assignments;
create policy workspace_assignments_insert
on public.workspace_assignments
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_assignments_update on public.workspace_assignments;
create policy workspace_assignments_update
on public.workspace_assignments
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_tasks_select on public.workspace_tasks;
create policy workspace_tasks_select
on public.workspace_tasks
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and public.can_access_company_workspace(company_workspace_id)
  )
);

drop policy if exists workspace_tasks_insert on public.workspace_tasks;
create policy workspace_tasks_insert
on public.workspace_tasks
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_tasks_update on public.workspace_tasks;
create policy workspace_tasks_update
on public.workspace_tasks
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_task_assignments_select on public.workspace_task_assignments;
create policy workspace_task_assignments_select
on public.workspace_task_assignments
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
      from public.workspace_tasks wt
     where wt.id = workspace_task_assignments.task_id
       and (
         public.is_platform_admin(auth.uid())
         or public.is_account_owner_or_admin(wt.organization_id)
         or (wt.company_workspace_id is not null and public.can_access_company_workspace(wt.company_workspace_id))
       )
  )
);

drop policy if exists workspace_task_assignments_insert on public.workspace_task_assignments;
create policy workspace_task_assignments_insert
on public.workspace_task_assignments
for insert
to authenticated
with check (
  exists (
    select 1
      from public.workspace_tasks wt
     where wt.id = workspace_task_assignments.task_id
       and (
         public.is_platform_admin(auth.uid())
         or public.is_account_owner_or_admin(wt.organization_id)
       )
  )
);

drop policy if exists workspace_announcements_select on public.workspace_announcements;
create policy workspace_announcements_select
on public.workspace_announcements
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and public.can_access_company_workspace(company_workspace_id)
  )
);

drop policy if exists workspace_announcements_insert on public.workspace_announcements;
create policy workspace_announcements_insert
on public.workspace_announcements
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

drop policy if exists workspace_activity_logs_select on public.workspace_activity_logs;
create policy workspace_activity_logs_select
on public.workspace_activity_logs
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and public.can_access_company_workspace(company_workspace_id)
  )
);

drop policy if exists risk_assessments_select_own_org on public.risk_assessments;
create policy risk_assessments_select_own_org
on public.risk_assessments
for select
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = risk_assessments.company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_view = true
    )
  )
  or (
    company_workspace_id is null
    and organization_id = public.current_organization_id()
  )
);

drop policy if exists risk_assessments_insert_own_org on public.risk_assessments;
create policy risk_assessments_insert_own_org
on public.risk_assessments
for insert
to authenticated
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = risk_assessments.company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_create_risk = true
    )
  )
);

drop policy if exists risk_assessments_update_own_org on public.risk_assessments;
create policy risk_assessments_update_own_org
on public.risk_assessments
for update
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = risk_assessments.company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_edit_risk = true
    )
  )
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
  or (
    company_workspace_id is not null
    and exists (
      select 1
        from public.workspace_assignments wa
       where wa.company_workspace_id = risk_assessments.company_workspace_id
         and wa.user_id = auth.uid()
         and wa.assignment_status = 'active'
         and wa.can_edit_risk = true
    )
  )
);

drop policy if exists risk_assessments_delete_own_org on public.risk_assessments;
create policy risk_assessments_delete_own_org
on public.risk_assessments
for delete
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_account_owner_or_admin(organization_id)
);

commit;
