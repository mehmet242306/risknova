create extension if not exists citext;
create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  inviter_user_id uuid not null references auth.users(id) on delete restrict,
  invitee_email citext not null,
  invitee_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  message text,
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  declined_by_user_id uuid references auth.users(id) on delete set null,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.company_invitation_permissions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.company_invitations(id) on delete cascade,
  module_key text not null,
  permission_level text not null check (permission_level in ('none', 'read', 'write')),
  created_at timestamptz not null default now(),
  unique (invitation_id, module_key)
);
create table if not exists public.company_member_module_permissions (
  id uuid primary key default gen_random_uuid(),
  company_membership_id uuid not null references public.company_memberships(id) on delete cascade,
  company_identity_id uuid not null references public.company_identities(id) on delete cascade,
  module_key text not null,
  permission_level text not null check (permission_level in ('none', 'read', 'write')),
  granted_by_user_id uuid references auth.users(id) on delete set null,
  granted_via_invitation_id uuid references public.company_invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_membership_id, module_key)
);
alter table public.company_identities
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delete_requested_at timestamptz,
  add column if not exists delete_requested_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null;
alter table public.company_workspaces
  add column if not exists is_archived boolean not null default false;
create index if not exists idx_company_invitations_company_identity_id
  on public.company_invitations (company_identity_id);
create index if not exists idx_company_invitations_invitee_email
  on public.company_invitations (invitee_email);
create index if not exists idx_company_invitations_invitee_user_id
  on public.company_invitations (invitee_user_id);
create unique index if not exists uq_company_invitations_pending_per_email
  on public.company_invitations (company_identity_id, invitee_email)
  where status = 'pending';
create index if not exists idx_company_invitation_permissions_invitation_id
  on public.company_invitation_permissions (invitation_id);
create index if not exists idx_company_member_module_permissions_membership
  on public.company_member_module_permissions (company_membership_id);
create unique index if not exists uq_company_memberships_active_company_user
  on public.company_memberships (company_identity_id, user_id)
  where status in ('active', 'approved');
create or replace function public.touch_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_company_invitations_updated_at on public.company_invitations;
create trigger trg_company_invitations_updated_at
before update on public.company_invitations
for each row
execute function public.touch_updated_at_generic();
drop trigger if exists trg_company_member_module_permissions_updated_at on public.company_member_module_permissions;
create trigger trg_company_member_module_permissions_updated_at
before update on public.company_member_module_permissions
for each row
execute function public.touch_updated_at_generic();
create or replace function public.normalize_email(p_email text)
returns citext
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '')::citext
$$;
create or replace function public.current_user_email()
returns citext
language sql
stable
security definer
set search_path = public
as $$
  select nullif(lower(trim(coalesce(up.email, ''))), '')::citext
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
  order by up.created_at desc nulls last
  limit 1
$$;
create or replace function public.can_manage_company_invitations(p_company_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_approver(p_company_identity_id)
$$;
create or replace function public.validate_company_member_module_permission_identity()
returns trigger
language plpgsql
as $$
declare
  membership_company_id uuid;
begin
  select cm.company_identity_id
    into membership_company_id
  from public.company_memberships cm
  where cm.id = new.company_membership_id
  limit 1;

  if membership_company_id is null then
    raise exception 'company_membership not found for id %', new.company_membership_id;
  end if;

  if membership_company_id <> new.company_identity_id then
    raise exception 'company_identity_id mismatch with membership company_identity_id';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_validate_company_member_module_permission_identity
  on public.company_member_module_permissions;
create trigger trg_validate_company_member_module_permission_identity
before insert or update on public.company_member_module_permissions
for each row
execute function public.validate_company_member_module_permission_identity();
create or replace function public.guard_company_invitation_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'new invitations must start with pending status';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status in ('accepted', 'declined', 'revoked', 'expired') then
    raise exception 'terminal invitation status cannot transition';
  end if;

  if old.status = 'pending' and new.status not in ('accepted', 'declined', 'revoked', 'expired') then
    raise exception 'invalid invitation status transition from pending';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_guard_company_invitation_status_transition on public.company_invitations;
create trigger trg_guard_company_invitation_status_transition
before insert or update on public.company_invitations
for each row
execute function public.guard_company_invitation_status_transition();
create or replace function public.block_company_invitation_permissions_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'company_invitation_permissions is immutable after insert';
end;
$$;
drop trigger if exists trg_block_company_invitation_permissions_update
  on public.company_invitation_permissions;
create trigger trg_block_company_invitation_permissions_update
before update on public.company_invitation_permissions
for each row
execute function public.block_company_invitation_permissions_mutation();
drop trigger if exists trg_block_company_invitation_permissions_delete
  on public.company_invitation_permissions;
create trigger trg_block_company_invitation_permissions_delete
before delete on public.company_invitation_permissions
for each row
execute function public.block_company_invitation_permissions_mutation();
create or replace function public.apply_member_module_permissions_from_invitation(
  p_invitation_id uuid,
  p_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_identity_id uuid;
begin
  select ci.company_identity_id
    into v_company_identity_id
  from public.company_invitations ci
  where ci.id = p_invitation_id
  limit 1;

  if v_company_identity_id is null then
    raise exception 'invitation not found';
  end if;

  insert into public.company_member_module_permissions (
    company_membership_id,
    company_identity_id,
    module_key,
    permission_level,
    granted_by_user_id,
    granted_via_invitation_id
  )
  select
    p_membership_id,
    v_company_identity_id,
    cip.module_key,
    cip.permission_level,
    auth.uid(),
    p_invitation_id
  from public.company_invitation_permissions cip
  where cip.invitation_id = p_invitation_id
  on conflict (company_membership_id, module_key)
  do update set
    permission_level = excluded.permission_level,
    granted_by_user_id = excluded.granted_by_user_id,
    granted_via_invitation_id = excluded.granted_via_invitation_id,
    updated_at = now();
end;
$$;
create or replace function public.link_pending_invitations_to_user(
  p_auth_user_id uuid,
  p_email text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_email citext;
  v_updated_count integer;
begin
  v_normalized_email := public.normalize_email(p_email);

  if v_normalized_email is null then
    return 0;
  end if;

  update public.company_invitations ci
     set invitee_user_id = p_auth_user_id
   where ci.status = 'pending'
     and ci.invitee_user_id is null
     and ci.invitee_email = v_normalized_email;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;
create or replace function public.accept_company_invitation(
  p_invitation_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.company_invitations%rowtype;
  v_membership_id uuid;
  v_existing_membership_id uuid;
begin
  select *
    into v_invitation
  from public.company_invitations ci
  where ci.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation is not pending';
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    update public.company_invitations
       set status = 'expired'
     where id = p_invitation_id;
    raise exception 'invitation expired';
  end if;

  if auth.uid() is null then
    raise exception 'auth context required';
  end if;

  if v_invitation.invitee_user_id is null then
    if public.current_user_email() is null or v_invitation.invitee_email <> public.current_user_email() then
      raise exception 'invitation email does not match current user';
    end if;

    update public.company_invitations
       set invitee_user_id = auth.uid()
     where id = p_invitation_id;
    v_invitation.invitee_user_id := auth.uid();
  end if;

  if v_invitation.invitee_user_id <> auth.uid() then
    raise exception 'invitation does not belong to current user';
  end if;

  select cm.id
    into v_existing_membership_id
  from public.company_memberships cm
  where cm.company_identity_id = v_invitation.company_identity_id
    and cm.user_id = auth.uid()
  order by cm.created_at asc
  limit 1;

  if v_existing_membership_id is null then
    insert into public.company_memberships (
      company_identity_id,
      company_workspace_id,
      organization_id,
      user_id,
      membership_role,
      employment_type,
      status,
      can_approve_join_requests,
      is_primary_contact,
      approved_at,
      approved_by_user_id,
      notes
    )
    values (
      v_invitation.company_identity_id,
      v_invitation.company_workspace_id,
      public.current_user_organization_id(),
      auth.uid(),
      'viewer',
      'external',
      'active',
      false,
      false,
      now(),
      v_invitation.inviter_user_id,
      p_note
    )
    returning id into v_membership_id;
  else
    update public.company_memberships
       set status = 'active',
           approved_at = coalesce(approved_at, now()),
           approved_by_user_id = coalesce(approved_by_user_id, v_invitation.inviter_user_id),
           notes = coalesce(notes, p_note)
     where id = v_existing_membership_id
    returning id into v_membership_id;
  end if;

  perform public.apply_member_module_permissions_from_invitation(
    p_invitation_id,
    v_membership_id
  );

  update public.company_invitations
     set status = 'accepted',
         accepted_at = now(),
         accepted_by_user_id = auth.uid()
   where id = p_invitation_id;

  return v_membership_id;
end;
$$;
create or replace function public.decline_company_invitation(
  p_invitation_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.company_invitations%rowtype;
begin
  select *
    into v_invitation
  from public.company_invitations ci
  where ci.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation is not pending';
  end if;

  if auth.uid() is null then
    raise exception 'auth context required';
  end if;

  if v_invitation.invitee_user_id is not null and v_invitation.invitee_user_id <> auth.uid() then
    raise exception 'invitation does not belong to current user';
  end if;

  if v_invitation.invitee_user_id is null then
    if public.current_user_email() is null or v_invitation.invitee_email <> public.current_user_email() then
      raise exception 'invitation email does not match current user';
    end if;
  end if;

  update public.company_invitations
     set status = 'declined',
         declined_at = now(),
         declined_by_user_id = auth.uid(),
         message = coalesce(p_note, message)
   where id = p_invitation_id;
end;
$$;
create or replace function public.revoke_company_invitation(
  p_invitation_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_identity_id uuid;
begin
  select ci.company_identity_id
    into v_company_identity_id
  from public.company_invitations ci
  where ci.id = p_invitation_id
  for update;

  if v_company_identity_id is null then
    raise exception 'invitation not found';
  end if;

  if not public.can_manage_company_invitations(v_company_identity_id) then
    raise exception 'not allowed to revoke invitation';
  end if;

  update public.company_invitations
     set status = 'revoked',
         revoked_at = now(),
         revoked_by_user_id = auth.uid(),
         message = coalesce(p_note, message)
   where id = p_invitation_id
     and status = 'pending';
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
     set is_archived = true
   where company_identity_id = p_company_identity_id
     and is_archived = false;
end;
$$;
create or replace function public.guard_company_delete_allowed(
  p_company_identity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_invites integer;
  v_active_memberships integer;
begin
  select count(*)
    into v_pending_invites
  from public.company_invitations ci
  where ci.company_identity_id = p_company_identity_id
    and ci.status = 'pending';

  select count(*)
    into v_active_memberships
  from public.company_memberships cm
  where cm.company_identity_id = p_company_identity_id
    and cm.status in ('active', 'approved');

  return v_pending_invites = 0 and v_active_memberships = 0;
end;
$$;
create or replace function public.request_company_delete(
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
    raise exception 'not allowed to request company delete';
  end if;

  if not public.guard_company_delete_allowed(p_company_identity_id) then
    raise exception 'delete guard failed: active memberships or pending invitations exist';
  end if;

  update public.company_identities
     set delete_requested_at = now(),
         delete_requested_by_user_id = auth.uid(),
         deleted_at = now(),
         deleted_by_user_id = auth.uid()
   where id = p_company_identity_id;
end;
$$;
alter table public.company_invitations enable row level security;
alter table public.company_invitation_permissions enable row level security;
alter table public.company_member_module_permissions enable row level security;
drop policy if exists company_invitations_select on public.company_invitations;
create policy company_invitations_select
on public.company_invitations
for select
to authenticated
using (
  inviter_user_id = auth.uid()
  or invitee_user_id = auth.uid()
  or invitee_email = public.current_user_email()
  or public.is_company_member(company_identity_id)
);
drop policy if exists company_invitations_insert on public.company_invitations;
create policy company_invitations_insert
on public.company_invitations
for insert
to authenticated
with check (
  inviter_user_id = auth.uid()
  and status = 'pending'
  and public.can_manage_company_invitations(company_identity_id)
);
drop policy if exists company_invitations_update on public.company_invitations;
create policy company_invitations_update
on public.company_invitations
for update
to authenticated
using (
  public.can_manage_company_invitations(company_identity_id)
  or invitee_user_id = auth.uid()
  or invitee_email = public.current_user_email()
)
with check (
  public.can_manage_company_invitations(company_identity_id)
  or invitee_user_id = auth.uid()
  or invitee_email = public.current_user_email()
);
drop policy if exists company_invitation_permissions_select on public.company_invitation_permissions;
create policy company_invitation_permissions_select
on public.company_invitation_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.company_invitations ci
    where ci.id = invitation_id
      and (
        ci.inviter_user_id = auth.uid()
        or ci.invitee_user_id = auth.uid()
        or ci.invitee_email = public.current_user_email()
        or public.is_company_member(ci.company_identity_id)
      )
  )
);
drop policy if exists company_invitation_permissions_insert on public.company_invitation_permissions;
create policy company_invitation_permissions_insert
on public.company_invitation_permissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_invitations ci
    where ci.id = invitation_id
      and ci.status = 'pending'
      and (
        ci.inviter_user_id = auth.uid()
        or public.can_manage_company_invitations(ci.company_identity_id)
      )
  )
);
drop policy if exists company_member_module_permissions_select on public.company_member_module_permissions;
create policy company_member_module_permissions_select
on public.company_member_module_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships cm
    where cm.id = company_membership_id
      and (
        cm.user_id = auth.uid()
        or public.is_company_member(cm.company_identity_id)
      )
  )
);
drop policy if exists company_member_module_permissions_insert on public.company_member_module_permissions;
create policy company_member_module_permissions_insert
on public.company_member_module_permissions
for insert
to authenticated
with check (
  public.can_manage_company_invitations(company_identity_id)
);
drop policy if exists company_member_module_permissions_update on public.company_member_module_permissions;
create policy company_member_module_permissions_update
on public.company_member_module_permissions
for update
to authenticated
using (
  public.can_manage_company_invitations(company_identity_id)
)
with check (
  public.can_manage_company_invitations(company_identity_id)
);
drop policy if exists company_member_module_permissions_delete on public.company_member_module_permissions;
create policy company_member_module_permissions_delete
on public.company_member_module_permissions
for delete
to authenticated
using (
  public.can_manage_company_invitations(company_identity_id)
);
grant execute on function public.normalize_email(text) to authenticated;
grant execute on function public.can_manage_company_invitations(uuid) to authenticated;
grant execute on function public.link_pending_invitations_to_user(uuid, text) to authenticated;
grant execute on function public.apply_member_module_permissions_from_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_company_invitation(uuid, text) to authenticated;
grant execute on function public.decline_company_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_company_invitation(uuid, text) to authenticated;
grant execute on function public.archive_company_identity(uuid, text) to authenticated;
grant execute on function public.guard_company_delete_allowed(uuid) to authenticated;
grant execute on function public.request_company_delete(uuid, text) to authenticated;
