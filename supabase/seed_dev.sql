insert into public.organizations (
  slug,
  name,
  organization_type,
  country,
  city,
  email,
  is_active
)
values (
  'demo-org',
  'Demo Organization',
  'osgb',
  'TR',
  'Elazig',
  'demo@guvenligimcepte.local',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  organization_type = excluded.organization_type,
  country = excluded.country,
  city = excluded.city,
  email = excluded.email,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.user_profiles (
  auth_user_id,
  organization_id,
  email,
  full_name,
  title,
  phone,
  is_active
)
select
  null,
  o.id,
  'demo.user@guvenligimcepte.local',
  'Demo User',
  'OHS Specialist',
  '+90 555 000 00 00',
  true
from public.organizations o
where o.slug = 'demo-org'
and not exists (
  select 1
  from public.user_profiles up
  where up.email = 'demo.user@guvenligimcepte.local'
);

insert into public.audit_logs (
  organization_id,
  actor_user_profile_id,
  action_type,
  entity_type,
  entity_id,
  severity,
  metadata_json
)
select
  o.id,
  up.id,
  'seed.inserted',
  'organization',
  o.id::text,
  'info',
  jsonb_build_object('source', 'seed_dev.sql')
from public.organizations o
left join public.user_profiles up
  on up.organization_id = o.id
 and up.email = 'demo.user@guvenligimcepte.local'
where o.slug = 'demo-org'
and not exists (
  select 1
  from public.audit_logs al
  where al.action_type = 'seed.inserted'
    and al.entity_type = 'organization'
    and al.entity_id = o.id::text
);
