update public.user_profiles
set
  auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d',
  email = 'mehmet242306@gmail.com',
  updated_at = now()
where id = '8b768009-af63-4d8f-9d41-3aee2add5f7c'
  and auth_user_id is null;
insert into public.user_roles (id, user_profile_id, role_id, assigned_at, assigned_by)
select
  gen_random_uuid(),
  '8b768009-af63-4d8f-9d41-3aee2add5f7c'::uuid,
  r.id,
  now(),
  null
from public.roles r
where r.name = 'Organization Admin'
and not exists (
  select 1
  from public.user_roles ur
  where ur.user_profile_id = '8b768009-af63-4d8f-9d41-3aee2add5f7c'::uuid
    and ur.role_id = r.id
);
