insert into public.user_profiles (
  id,
  auth_user_id,
  organization_id,
  email,
  full_name,
  title,
  is_active,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  '213dbf63-88ec-4470-93bf-940d4cc9662f'::uuid,
  '6cb4ceca-89ee-4b13-b62d-f1abc9fd5768'::uuid,
  'mehmetyildirim2923@gmail.com',
  'Test Professional',
  'OHS Specialist',
  true,
  now(),
  now()
where not exists (
  select 1
  from public.user_profiles up
  where up.auth_user_id = '213dbf63-88ec-4470-93bf-940d4cc9662f'::uuid
);

insert into public.user_roles (id, user_profile_id, role_id, assigned_at, assigned_by)
select
  gen_random_uuid(),
  up.id,
  r.id,
  now(),
  null
from public.user_profiles up
join public.roles r on r.name = 'OHS Specialist'
where up.auth_user_id = '213dbf63-88ec-4470-93bf-940d4cc9662f'::uuid
and not exists (
  select 1
  from public.user_roles ur
  where ur.user_profile_id = up.id
    and ur.role_id = r.id
);
