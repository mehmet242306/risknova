-- =============================================================================
-- İş 2 — 5'li Rol Adapter
-- =============================================================================
-- UI'da owner/admin/manager/editor/viewer 5'li modeli yüzeye çıkarır. Arka
-- planda user_roles / platform_admins / workspace_assignments.professional_role
-- / company_memberships.membership_role (professional) paralel çalışmaya
-- devam eder.
--
-- Değişiklikler:
-- 1. organization_memberships.role check enum'unu manager + editor ile genişlet.
-- 2. company_invitations.invited_role check enum'unu manager + editor ile genişlet.
-- 3. company_memberships tablosuna access_role kolonu ekle (5'li auth rolü).
--    membership_role (professional role) dokunulmadan kalır.
-- 4. accept_company_invitation düzeltmesi:
--    - İş 1'deki yanlış yazı geri alınıyor — membership_role tekrar 'viewer'
--      default'una dönüyor (membership_role check yalnızca professional
--      değerleri kabul eder; 'admin'/'staff' insert'i patlatırdı).
--    - Bunun yerine access_role = invited_role yazılır.
-- =============================================================================

-- 1. organization_memberships.role → 6 değer
alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role in ('owner', 'admin', 'manager', 'editor', 'staff', 'viewer'));

-- 2. company_invitations.invited_role → 6 değer
alter table public.company_invitations
  drop constraint if exists company_invitations_invited_role_check;
alter table public.company_invitations
  add constraint company_invitations_invited_role_check
  check (invited_role in ('owner', 'admin', 'manager', 'editor', 'staff', 'viewer'));

-- 3. company_memberships.access_role yeni kolon
alter table public.company_memberships
  add column if not exists access_role text;

-- Backfill: owner/viewer eşleşen değerler aynen; diğerleri 'viewer'.
update public.company_memberships
   set access_role = case
     when membership_role = 'owner' then 'owner'
     when membership_role = 'viewer' then 'viewer'
     else 'viewer'
   end
 where access_role is null;

alter table public.company_memberships
  alter column access_role set default 'viewer';

alter table public.company_memberships
  alter column access_role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'company_memberships_access_role_check'
       and conrelid = 'public.company_memberships'::regclass
  ) then
    alter table public.company_memberships
      add constraint company_memberships_access_role_check
      check (access_role in ('owner', 'admin', 'manager', 'editor', 'viewer'));
  end if;
end $$;

create index if not exists idx_company_memberships_access_role
  on public.company_memberships(company_identity_id, access_role);

-- 4. accept_company_invitation — membership_role'u professional default'a çevir,
--    access_role'u invited_role ile ayarla.
create or replace function public.accept_company_invitation(
  p_invitation_id uuid,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.company_invitations%rowtype;
  v_membership_id uuid;
  v_existing_membership_id uuid;
  v_access_role text;
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
    if public.current_user_email() is null
       or v_invitation.invitee_email <> public.current_user_email() then
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

  v_access_role := coalesce(v_invitation.invited_role, 'viewer');
  if v_access_role not in ('owner', 'admin', 'manager', 'editor', 'viewer') then
    v_access_role := 'viewer';
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
      access_role,
      employment_type,
      status,
      can_approve_join_requests,
      is_primary_contact,
      approved_at,
      approved_by_user_id,
      notes
    ) values (
      v_invitation.company_identity_id,
      v_invitation.company_workspace_id,
      public.current_user_organization_id(),
      auth.uid(),
      'viewer',
      v_access_role,
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
           access_role = v_access_role,
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
