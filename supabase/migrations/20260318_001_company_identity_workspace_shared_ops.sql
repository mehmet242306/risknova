create extension if not exists pgcrypto;
create extension if not exists citext;
create sequence if not exists public.company_code_seq
  start with 1000
  increment by 1;
create sequence if not exists public.company_join_request_seq
  start with 1000
  increment by 1;
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.organization_id
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
  order by up.created_at desc nulls last
  limit 1
$$;
create or replace function public.generate_company_code()
returns text
language plpgsql
as $$
declare
  v_next bigint;
begin
  v_next := nextval('public.company_code_seq');
  return 'RN-CMP-' || lpad(v_next::text, 6, '0');
end;
$$;
create or replace function public.generate_company_join_request_code()
returns text
language plpgsql
as $$
declare
  v_next bigint;
begin
  v_next := nextval('public.company_join_request_seq');
  return 'RN-JR-' || lpad(v_next::text, 6, '0');
end;
$$;
create table if not exists public.company_identities (
  id uuid primary key default gen_random_uuid(),
  company_code text not null unique default public.generate_company_code(),
  official_name text not null,
  tax_number text,
  mersis_number text,
  sector text,
  nace_code text,
  hazard_class text,
  address text,
  city text,
  district text,
  approval_mode text not null default 'single_approver'
    check (approval_mode in ('single_approver', 'dual_approver', 'osgb_managed')),
  is_active boolean not null default true,
  owner_organization_id uuid references public.organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.company_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  display_name text not null,
  notes text,
  is_primary_workspace boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_identity_id)
);
create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null
    check (
      membership_role in (
        'owner',
        'ohs_specialist',
        'workplace_physician',
        'other_health_personnel',
        'employee_representative',
        'support_staff',
        'employer_representative',
        'viewer'
      )
    ),
  employment_type text not null default 'direct'
    check (employment_type in ('direct', 'osgb', 'external', 'internal')),
  status text not null default 'active'
    check (status in ('active', 'pending', 'inactive', 'rejected')),
  can_view_shared_operations boolean not null default true,
  can_create_shared_operations boolean not null default true,
  can_approve_join_requests boolean not null default false,
  is_primary_contact boolean not null default false,
  start_date date,
  end_date date,
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_identity_id, organization_id, user_id, membership_role)
);
create table if not exists public.company_join_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default public.generate_company_join_request_code(),
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  requesting_organization_id uuid not null references public.organizations(id) on delete cascade,
  requesting_user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null
    check (
      requested_role in (
        'owner',
        'ohs_specialist',
        'workplace_physician',
        'other_health_personnel',
        'employee_representative',
        'support_staff',
        'employer_representative',
        'viewer'
      )
    ),
  requested_employment_type text not null default 'direct'
    check (requested_employment_type in ('direct', 'osgb', 'external', 'internal')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  decision_note text,
  approved_by_membership_id uuid references public.company_memberships(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_company_identities_company_code
  on public.company_identities (company_code);
create index if not exists idx_company_workspaces_company_identity_id
  on public.company_workspaces (company_identity_id);
create index if not exists idx_company_workspaces_organization_id
  on public.company_workspaces (organization_id);
create index if not exists idx_company_memberships_company_identity_id
  on public.company_memberships (company_identity_id);
create index if not exists idx_company_memberships_user_id
  on public.company_memberships (user_id);
create index if not exists idx_company_memberships_workspace_id
  on public.company_memberships (company_workspace_id);
create index if not exists idx_company_join_requests_company_identity_id
  on public.company_join_requests (company_identity_id);
create index if not exists idx_company_join_requests_requesting_user_id
  on public.company_join_requests (requesting_user_id);
create unique index if not exists uq_company_join_requests_pending
  on public.company_join_requests (
    company_identity_id,
    requesting_organization_id,
    requesting_user_id
  )
  where status = 'pending';
drop trigger if exists trg_company_identities_updated_at on public.company_identities;
create trigger trg_company_identities_updated_at
before update on public.company_identities
for each row
execute function public.touch_updated_at();
drop trigger if exists trg_company_workspaces_updated_at on public.company_workspaces;
create trigger trg_company_workspaces_updated_at
before update on public.company_workspaces
for each row
execute function public.touch_updated_at();
drop trigger if exists trg_company_memberships_updated_at on public.company_memberships;
create trigger trg_company_memberships_updated_at
before update on public.company_memberships
for each row
execute function public.touch_updated_at();
drop trigger if exists trg_company_join_requests_updated_at on public.company_join_requests;
create trigger trg_company_join_requests_updated_at
before update on public.company_join_requests
for each row
execute function public.touch_updated_at();
create or replace function public.is_company_member(p_company_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_identity_id = p_company_identity_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  )
$$;
create or replace function public.is_company_approver(p_company_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_identity_id = p_company_identity_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.can_approve_join_requests = true
  )
$$;
create or replace function public.find_company_by_code(p_company_code text)
returns table (
  company_identity_id uuid,
  company_code text,
  official_name text,
  sector text,
  nace_code text,
  hazard_class text,
  city text,
  district text,
  already_linked boolean,
  pending_request_exists boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  v_org := public.current_user_organization_id();

  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  if v_org is null then
    raise exception 'Current user organization not found.';
  end if;

  return query
  select
    ci.id,
    ci.company_code,
    ci.official_name,
    ci.sector,
    ci.nace_code,
    ci.hazard_class,
    ci.city,
    ci.district,
    exists (
      select 1
      from public.company_workspaces cw
      where cw.company_identity_id = ci.id
        and cw.organization_id = v_org
    ) as already_linked,
    exists (
      select 1
      from public.company_join_requests jr
      where jr.company_identity_id = ci.id
        and jr.requesting_organization_id = v_org
        and jr.requesting_user_id = auth.uid()
        and jr.status = 'pending'
    ) as pending_request_exists
  from public.company_identities ci
  where lower(ci.company_code) = lower(trim(p_company_code))
    and ci.is_active = true;
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

  if trim(coalesce(p_official_name, '')) = '' then
    raise exception 'Official company name is required.';
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
    created_by,
    updated_by
  )
  values (
    v_org,
    v_company_identity_id,
    coalesce(nullif(trim(p_display_name), ''), trim(p_official_name)),
    nullif(trim(p_notes), ''),
    true,
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
  do update
  set
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
create or replace function public.request_company_join_by_code(
  p_company_code text,
  p_requested_role text,
  p_requested_employment_type text default 'direct',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_company_identity_id uuid;
  v_join_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  v_org := public.current_user_organization_id();

  if v_org is null then
    raise exception 'Current user organization not found.';
  end if;

  if p_requested_role not in (
    'owner',
    'ohs_specialist',
    'workplace_physician',
    'other_health_personnel',
    'employee_representative',
    'support_staff',
    'employer_representative',
    'viewer'
  ) then
    raise exception 'Invalid requested role.';
  end if;

  if p_requested_employment_type not in ('direct', 'osgb', 'external', 'internal') then
    raise exception 'Invalid requested employment type.';
  end if;

  select ci.id
  into v_company_identity_id
  from public.company_identities ci
  where lower(ci.company_code) = lower(trim(p_company_code))
    and ci.is_active = true
  limit 1;

  if v_company_identity_id is null then
    raise exception 'Company not found for this code.';
  end if;

  if exists (
    select 1
    from public.company_workspaces cw
    where cw.company_identity_id = v_company_identity_id
      and cw.organization_id = v_org
  ) then
    raise exception 'This company is already linked to your workspace.';
  end if;

  if exists (
    select 1
    from public.company_join_requests jr
    where jr.company_identity_id = v_company_identity_id
      and jr.requesting_organization_id = v_org
      and jr.requesting_user_id = auth.uid()
      and jr.status = 'pending'
  ) then
    raise exception 'There is already a pending join request for this company.';
  end if;

  insert into public.company_join_requests (
    company_identity_id,
    requesting_organization_id,
    requesting_user_id,
    requested_role,
    requested_employment_type,
    note,
    status
  )
  values (
    v_company_identity_id,
    v_org,
    auth.uid(),
    p_requested_role,
    p_requested_employment_type,
    nullif(trim(p_note), ''),
    'pending'
  )
  returning id into v_join_request_id;

  return v_join_request_id;
end;
$$;
create or replace function public.approve_company_join_request(
  p_join_request_id uuid,
  p_decision_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.company_join_requests%rowtype;
  v_workspace_id uuid;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  select *
  into v_request
  from public.company_join_requests
  where id = p_join_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending join request not found.';
  end if;

  if not public.is_company_approver(v_request.company_identity_id) then
    raise exception 'You are not allowed to approve this request.';
  end if;

  select cw.id
  into v_workspace_id
  from public.company_workspaces cw
  where cw.organization_id = v_request.requesting_organization_id
    and cw.company_identity_id = v_request.company_identity_id
  limit 1;

  if v_workspace_id is null then
    select ci.official_name
    into v_display_name
    from public.company_identities ci
    where ci.id = v_request.company_identity_id;

    insert into public.company_workspaces (
      organization_id,
      company_identity_id,
      display_name,
      is_primary_workspace,
      created_by,
      updated_by
    )
    values (
      v_request.requesting_organization_id,
      v_request.company_identity_id,
      coalesce(v_display_name, 'Yeni Firma'),
      false,
      auth.uid(),
      auth.uid()
    )
    returning id into v_workspace_id;
  end if;

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
    v_request.company_identity_id,
    v_workspace_id,
    v_request.requesting_organization_id,
    v_request.requesting_user_id,
    v_request.requested_role,
    v_request.requested_employment_type,
    'active',
    true,
    true,
    false,
    false,
    auth.uid(),
    now(),
    auth.uid(),
    auth.uid()
  )
  on conflict (company_identity_id, organization_id, user_id, membership_role)
  do update
  set
    company_workspace_id = excluded.company_workspace_id,
    status = 'active',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_by = auth.uid(),
    updated_at = now();

  update public.company_join_requests
  set
    status = 'approved',
    decision_note = nullif(trim(p_decision_note), ''),
    approved_by_user_id = auth.uid(),
    approved_at = now(),
    updated_at = now()
  where id = p_join_request_id;

  return v_workspace_id;
end;
$$;
create or replace function public.reject_company_join_request(
  p_join_request_id uuid,
  p_decision_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_identity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  select jr.company_identity_id
  into v_company_identity_id
  from public.company_join_requests jr
  where jr.id = p_join_request_id
    and jr.status = 'pending'
  for update;

  if v_company_identity_id is null then
    raise exception 'Pending join request not found.';
  end if;

  if not public.is_company_approver(v_company_identity_id) then
    raise exception 'You are not allowed to reject this request.';
  end if;

  update public.company_join_requests
  set
    status = 'rejected',
    decision_note = nullif(trim(p_decision_note), ''),
    approved_by_user_id = auth.uid(),
    approved_at = now(),
    updated_at = now()
  where id = p_join_request_id;

  return p_join_request_id;
end;
$$;
alter table public.company_identities enable row level security;
alter table public.company_workspaces enable row level security;
alter table public.company_memberships enable row level security;
alter table public.company_join_requests enable row level security;
drop policy if exists company_identities_select on public.company_identities;
create policy company_identities_select
on public.company_identities
for select
to authenticated
using (
  public.is_company_member(id)
  or exists (
    select 1
    from public.company_join_requests jr
    where jr.company_identity_id = company_identities.id
      and jr.requesting_user_id = auth.uid()
  )
);
drop policy if exists company_identities_update on public.company_identities;
create policy company_identities_update
on public.company_identities
for update
to authenticated
using (public.is_company_approver(id))
with check (public.is_company_approver(id));
drop policy if exists company_workspaces_select on public.company_workspaces;
create policy company_workspaces_select
on public.company_workspaces
for select
to authenticated
using (
  organization_id = public.current_user_organization_id()
  or public.is_company_member(company_identity_id)
);
drop policy if exists company_workspaces_update on public.company_workspaces;
create policy company_workspaces_update
on public.company_workspaces
for update
to authenticated
using (organization_id = public.current_user_organization_id())
with check (organization_id = public.current_user_organization_id());
drop policy if exists company_memberships_select on public.company_memberships;
create policy company_memberships_select
on public.company_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_company_member(company_identity_id)
);
drop policy if exists company_memberships_update on public.company_memberships;
create policy company_memberships_update
on public.company_memberships
for update
to authenticated
using (public.is_company_approver(company_identity_id))
with check (public.is_company_approver(company_identity_id));
drop policy if exists company_join_requests_select on public.company_join_requests;
create policy company_join_requests_select
on public.company_join_requests
for select
to authenticated
using (
  requesting_user_id = auth.uid()
  or public.is_company_approver(company_identity_id)
);
drop policy if exists company_join_requests_insert on public.company_join_requests;
create policy company_join_requests_insert
on public.company_join_requests
for insert
to authenticated
with check (
  requesting_user_id = auth.uid()
  and requesting_organization_id = public.current_user_organization_id()
  and status = 'pending'
);
drop policy if exists company_join_requests_update on public.company_join_requests;
create policy company_join_requests_update
on public.company_join_requests
for update
to authenticated
using (
  requesting_user_id = auth.uid()
  or public.is_company_approver(company_identity_id)
)
with check (
  requesting_user_id = auth.uid()
  or public.is_company_approver(company_identity_id)
);
grant execute on function public.find_company_by_code(text) to authenticated;
grant execute on function public.create_company_identity_with_workspace(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.request_company_join_by_code(
  text, text, text, text
) to authenticated;
grant execute on function public.approve_company_join_request(uuid, text) to authenticated;
grant execute on function public.reject_company_join_request(uuid, text) to authenticated;
