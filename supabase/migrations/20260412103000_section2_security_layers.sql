create extension if not exists pgtap with schema extensions;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  module_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_permissions_unique unique (role_id, permission_id)
);

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  endpoint text not null,
  scope text not null check (scope in ('api', 'ai', 'auth')),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  limit_count integer not null check (limit_count > 0),
  plan_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_limits_bucket_unique unique (user_id, endpoint, scope, window_start, window_seconds)
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tenant_id uuid references public.company_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  event_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  endpoint text,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_permissions_module on public.permissions(module_key, code);
create index if not exists idx_role_permissions_role on public.role_permissions(role_id);
create index if not exists idx_role_permissions_permission on public.role_permissions(permission_id);
create index if not exists idx_rate_limits_user_scope on public.rate_limits(user_id, scope, window_start desc);
create index if not exists idx_rate_limits_org on public.rate_limits(organization_id, scope, window_start desc);
create index if not exists idx_security_events_org on public.security_events(organization_id, created_at desc);
create index if not exists idx_security_events_user on public.security_events(user_id, created_at desc);
create index if not exists idx_security_events_type on public.security_events(event_type, created_at desc);
create index if not exists idx_security_events_severity on public.security_events(severity, created_at desc);

alter table if exists public.user_sessions
  drop constraint if exists user_sessions_user_device_key;

alter table if exists public.user_sessions
  add constraint user_sessions_user_session_key unique (user_id, session_token);

drop trigger if exists trg_permissions_updated_at on public.permissions;
create trigger trg_permissions_updated_at
before update on public.permissions
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_role_permissions_updated_at on public.role_permissions;
create trigger trg_role_permissions_updated_at
before update on public.role_permissions
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_rate_limits_updated_at on public.rate_limits;
create trigger trg_rate_limits_updated_at
before update on public.rate_limits
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.rate_limits enable row level security;
alter table public.security_events enable row level security;

insert into public.roles (code, name, description)
values
  ('admin', 'Admin', 'Guvenlik ve yonetim yetkilerine sahip uygulama yoneticisi'),
  ('inspector', 'Inspector', 'Denetim ve operasyon odakli uygulama rolu'),
  ('viewer', 'Viewer', 'Salt okunur uygulama rolu')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.permissions (code, name, description, module_key)
values
  ('security.events.view', 'Guvenlik olaylarini goruntule', 'Security event akisina erisim', 'security'),
  ('security.rate_limits.view', 'Rate limit akislarini goruntule', 'Rate limit ihlallerini inceleme', 'security'),
  ('security.roles.manage', 'Rolleri yonet', 'Rol ve izin matrisi yonetimi', 'security'),
  ('settings.manage', 'Ayarlari yonet', 'Yonetim ayarlarina erisim', 'settings'),
  ('documents.read', 'Dokumanlari goruntule', 'Dokuman kutuphanesine erisim', 'documents'),
  ('documents.write', 'Dokumanlari duzenle', 'Dokuman olusturma ve guncelleme', 'documents'),
  ('documents.download', 'Dokuman indir', 'Dokuman export ve download', 'documents'),
  ('training.read', 'Egitimleri goruntule', 'Egitim kutuphanesine erisim', 'training'),
  ('training.write', 'Egitim duzenle', 'Egitim icerigi ve slayt duzenleme', 'training'),
  ('ai.use', 'AI kullan', 'Standart AI endpoint erisimi', 'ai'),
  ('ai.admin.use', 'Admin AI kullan', 'Yonetici AI ve ogrenme araclarina erisim', 'ai'),
  ('reports.view', 'Raporlari goruntule', 'Rapor merkezine erisim', 'reports'),
  ('profile.manage', 'Profil yonet', 'Profil ve MFA ayarlari', 'profile')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  module_key = excluded.module_key;

with permission_map as (
  select code, id as permission_id
  from public.permissions
),
role_map as (
  select code, id as role_id
  from public.roles
  where code in (
    'super_admin',
    'admin',
    'platform_admin',
    'organization_admin',
    'osgb_manager',
    'inspector',
    'ohs_specialist',
    'workplace_physician',
    'dsp',
    'viewer'
  )
),
matrix(role_code, permission_code) as (
  values
    ('super_admin', 'security.events.view'),
    ('super_admin', 'security.rate_limits.view'),
    ('super_admin', 'security.roles.manage'),
    ('super_admin', 'settings.manage'),
    ('super_admin', 'documents.read'),
    ('super_admin', 'documents.write'),
    ('super_admin', 'documents.download'),
    ('super_admin', 'training.read'),
    ('super_admin', 'training.write'),
    ('super_admin', 'ai.use'),
    ('super_admin', 'ai.admin.use'),
    ('super_admin', 'reports.view'),
    ('super_admin', 'profile.manage'),
    ('admin', 'security.events.view'),
    ('admin', 'security.rate_limits.view'),
    ('admin', 'settings.manage'),
    ('admin', 'documents.read'),
    ('admin', 'documents.write'),
    ('admin', 'documents.download'),
    ('admin', 'training.read'),
    ('admin', 'training.write'),
    ('admin', 'ai.use'),
    ('admin', 'reports.view'),
    ('admin', 'profile.manage'),
    ('platform_admin', 'security.events.view'),
    ('platform_admin', 'security.rate_limits.view'),
    ('platform_admin', 'settings.manage'),
    ('platform_admin', 'documents.read'),
    ('platform_admin', 'documents.write'),
    ('platform_admin', 'documents.download'),
    ('platform_admin', 'training.read'),
    ('platform_admin', 'training.write'),
    ('platform_admin', 'ai.use'),
    ('platform_admin', 'reports.view'),
    ('platform_admin', 'profile.manage'),
    ('organization_admin', 'security.events.view'),
    ('organization_admin', 'security.rate_limits.view'),
    ('organization_admin', 'settings.manage'),
    ('organization_admin', 'documents.read'),
    ('organization_admin', 'documents.write'),
    ('organization_admin', 'documents.download'),
    ('organization_admin', 'training.read'),
    ('organization_admin', 'training.write'),
    ('organization_admin', 'ai.use'),
    ('organization_admin', 'reports.view'),
    ('organization_admin', 'profile.manage'),
    ('osgb_manager', 'security.events.view'),
    ('osgb_manager', 'documents.read'),
    ('osgb_manager', 'documents.write'),
    ('osgb_manager', 'documents.download'),
    ('osgb_manager', 'training.read'),
    ('osgb_manager', 'training.write'),
    ('osgb_manager', 'ai.use'),
    ('osgb_manager', 'reports.view'),
    ('osgb_manager', 'profile.manage'),
    ('inspector', 'documents.read'),
    ('inspector', 'documents.write'),
    ('inspector', 'documents.download'),
    ('inspector', 'training.read'),
    ('inspector', 'training.write'),
    ('inspector', 'ai.use'),
    ('inspector', 'reports.view'),
    ('inspector', 'profile.manage'),
    ('ohs_specialist', 'documents.read'),
    ('ohs_specialist', 'documents.write'),
    ('ohs_specialist', 'documents.download'),
    ('ohs_specialist', 'training.read'),
    ('ohs_specialist', 'training.write'),
    ('ohs_specialist', 'ai.use'),
    ('ohs_specialist', 'reports.view'),
    ('ohs_specialist', 'profile.manage'),
    ('workplace_physician', 'documents.read'),
    ('workplace_physician', 'documents.download'),
    ('workplace_physician', 'training.read'),
    ('workplace_physician', 'ai.use'),
    ('workplace_physician', 'reports.view'),
    ('workplace_physician', 'profile.manage'),
    ('dsp', 'documents.read'),
    ('dsp', 'training.read'),
    ('dsp', 'reports.view'),
    ('dsp', 'profile.manage'),
    ('viewer', 'documents.read'),
    ('viewer', 'training.read'),
    ('viewer', 'reports.view'),
    ('viewer', 'profile.manage')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.role_id, p.permission_id
from matrix m
join role_map r on r.code = m.role_code
join permission_map p on p.code = m.permission_code
on conflict (role_id, permission_id) do nothing;

create or replace function public.effective_app_role(p_uid uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_uid is null then
    return 'anonymous';
  end if;

  if public.is_super_admin(p_uid) then
    return 'super_admin';
  end if;

  select r.code
  into v_role
  from public.user_profiles up
  join public.user_roles ur on ur.user_profile_id = up.id
  join public.roles r on r.id = ur.role_id
  where up.auth_user_id = p_uid
    and r.code in ('admin', 'platform_admin', 'organization_admin', 'osgb_manager')
  order by case r.code
    when 'admin' then 1
    when 'platform_admin' then 2
    when 'organization_admin' then 3
    when 'osgb_manager' then 4
    else 99
  end
  limit 1;

  if v_role is not null then
    return case when v_role in ('admin', 'platform_admin', 'organization_admin', 'osgb_manager') then 'admin' else v_role end;
  end if;

  select r.code
  into v_role
  from public.user_profiles up
  join public.user_roles ur on ur.user_profile_id = up.id
  join public.roles r on r.id = ur.role_id
  where up.auth_user_id = p_uid
    and r.code in ('inspector', 'ohs_specialist', 'workplace_physician', 'dsp')
  order by case r.code
    when 'inspector' then 1
    when 'ohs_specialist' then 2
    when 'workplace_physician' then 3
    when 'dsp' then 4
    else 99
  end
  limit 1;

  if v_role is not null then
    return 'inspector';
  end if;

  return 'viewer';
end;
$$;

create or replace function public.user_has_permission(
  p_permission_code text,
  p_uid uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_uid is null or p_permission_code is null or btrim(p_permission_code) = '' then
    return false;
  end if;

  if public.is_super_admin(p_uid) then
    return true;
  end if;

  return exists (
    select 1
    from public.user_profiles up
    join public.user_roles ur on ur.user_profile_id = up.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where up.auth_user_id = p_uid
      and p.code = p_permission_code
  );
end;
$$;

create or replace function public.log_security_event(
  p_event_type text,
  p_severity text default 'warning',
  p_endpoint text default null,
  p_user_id uuid default auth.uid(),
  p_organization_id uuid default null,
  p_tenant_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_profile_id uuid;
  v_organization_id uuid;
begin
  if p_user_id is not null then
    select id, organization_id
    into v_user_profile_id, v_organization_id
    from public.user_profiles
    where auth_user_id = p_user_id
    limit 1;
  end if;

  insert into public.security_events (
    organization_id,
    tenant_id,
    user_id,
    user_profile_id,
    event_type,
    severity,
    endpoint,
    ip_address,
    user_agent,
    details
  )
  values (
    coalesce(p_organization_id, v_organization_id),
    p_tenant_id,
    p_user_id,
    v_user_profile_id,
    p_event_type,
    case when p_severity in ('info', 'warning', 'critical') then p_severity else 'warning' end,
    p_endpoint,
    p_ip_address,
    p_user_agent,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.resolve_ai_daily_limit(p_user_id uuid)
returns table(plan_key text, daily_limit integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_key text;
begin
  select sp.plan_key
  into v_plan_key
  from public.user_subscriptions us
  join public.subscription_plans sp on sp.id = us.plan_id
  where us.user_id = p_user_id
    and us.status = 'active'
  order by us.created_at desc
  limit 1;

  v_plan_key := coalesce(v_plan_key, 'free');

  return query
  select
    v_plan_key,
    case v_plan_key
      when 'enterprise' then 500
      when 'business' then 300
      when 'professional' then 180
      when 'starter' then 75
      else 25
    end;
end;
$$;

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_scope text,
  p_limit_count integer,
  p_window_seconds integer,
  p_plan_key text default null,
  p_organization_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  request_count integer,
  limit_count integer,
  window_start timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_row public.rate_limits%rowtype;
begin
  if p_user_id is null then
    raise exception 'consume_rate_limit requires p_user_id';
  end if;

  if p_limit_count <= 0 or p_window_seconds <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (
    user_id,
    organization_id,
    endpoint,
    scope,
    window_start,
    window_seconds,
    request_count,
    limit_count,
    plan_key,
    metadata
  )
  values (
    p_user_id,
    p_organization_id,
    p_endpoint,
    case when p_scope in ('api', 'ai', 'auth') then p_scope else 'api' end,
    v_window_start,
    p_window_seconds,
    1,
    p_limit_count,
    p_plan_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, endpoint, scope, window_start, window_seconds)
  do update set
    request_count = public.rate_limits.request_count + 1,
    limit_count = excluded.limit_count,
    plan_key = coalesce(excluded.plan_key, public.rate_limits.plan_key),
    metadata = public.rate_limits.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_row;

  if v_row.request_count > v_row.limit_count then
    perform public.log_security_event(
      p_event_type => 'rate_limit.exceeded',
      p_severity => 'warning',
      p_endpoint => p_endpoint,
      p_user_id => p_user_id,
      p_organization_id => p_organization_id,
      p_ip_address => p_ip_address,
      p_user_agent => p_user_agent,
      p_details => jsonb_build_object(
        'scope', v_row.scope,
        'limit_count', v_row.limit_count,
        'request_count', v_row.request_count,
        'window_seconds', v_row.window_seconds,
        'window_start', v_row.window_start,
        'plan_key', v_row.plan_key
      ) || coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  return query
  select
    v_row.request_count <= v_row.limit_count,
    greatest(v_row.limit_count - v_row.request_count, 0),
    v_row.window_start + make_interval(secs => v_row.window_seconds),
    v_row.request_count,
    v_row.limit_count,
    v_row.window_start;
end;
$$;

create or replace function public.search_security_events(
  p_query text default null,
  p_event_type text default null,
  p_severity text default null,
  p_limit integer default 120
)
returns table(
  id uuid,
  created_at timestamptz,
  event_type text,
  severity text,
  endpoint text,
  ip_address text,
  user_agent text,
  organization_id uuid,
  user_id uuid,
  actor_name text,
  actor_email text,
  details jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    se.id,
    se.created_at,
    se.event_type,
    se.severity,
    se.endpoint,
    se.ip_address,
    se.user_agent,
    se.organization_id,
    se.user_id,
    up.full_name as actor_name,
    up.email as actor_email,
    se.details
  from public.security_events se
  left join public.user_profiles up
    on up.auth_user_id = se.user_id
  where public.is_super_admin()
    and (
      p_query is null
      or coalesce(se.event_type, '') ilike '%' || p_query || '%'
      or coalesce(se.endpoint, '') ilike '%' || p_query || '%'
      or coalesce(up.full_name, '') ilike '%' || p_query || '%'
      or coalesce(up.email, '') ilike '%' || p_query || '%'
    )
    and (p_event_type is null or se.event_type = p_event_type)
    and (p_severity is null or se.severity = p_severity)
  order by se.created_at desc
  limit greatest(coalesce(p_limit, 120), 1);
$$;

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated
on public.permissions
for select
to authenticated
using (true);

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists rate_limits_select_self on public.rate_limits;
create policy rate_limits_select_self
on public.rate_limits
for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists security_events_select_scope on public.security_events;
create policy security_events_select_scope
on public.security_events
for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin());

revoke all on function public.effective_app_role(uuid) from public;
grant execute on function public.effective_app_role(uuid) to authenticated, service_role;

revoke all on function public.user_has_permission(text, uuid) from public;
grant execute on function public.user_has_permission(text, uuid) to authenticated, service_role;

revoke all on function public.log_security_event(text, text, text, uuid, uuid, uuid, text, text, jsonb) from public;
grant execute on function public.log_security_event(text, text, text, uuid, uuid, uuid, text, text, jsonb) to authenticated, service_role;

revoke all on function public.resolve_ai_daily_limit(uuid) from public;
grant execute on function public.resolve_ai_daily_limit(uuid) to authenticated, service_role;

revoke all on function public.consume_rate_limit(uuid, text, text, integer, integer, text, uuid, text, text, jsonb) from public;
grant execute on function public.consume_rate_limit(uuid, text, text, integer, integer, text, uuid, text, text, jsonb) to authenticated, service_role;

revoke all on function public.search_security_events(text, text, text, integer) from public;
grant execute on function public.search_security_events(text, text, text, integer) to authenticated, service_role;

create or replace function public.rls_tests()
returns setof text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_org_id uuid := gen_random_uuid();
  v_uid_a uuid := gen_random_uuid();
  v_uid_b uuid := gen_random_uuid();
  v_profile_a uuid := gen_random_uuid();
  v_profile_b uuid := gen_random_uuid();
  v_role_viewer uuid;
  v_role_admin uuid;
  v_notification_a uuid := gen_random_uuid();
  v_notification_b uuid := gen_random_uuid();
  v_rate_limit_id uuid := gen_random_uuid();
begin
  return next plan(8);

  insert into public.organizations (id, name, slug)
  values (v_org_id, 'RLS Test Org', 'rls-test-' || substr(v_org_id::text, 1, 8))
  on conflict (slug) do nothing;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_uid_a, 'authenticated', 'authenticated', 'rls_a_' || substr(v_uid_a::text,1,8) || '@risknova.test', crypt('Passw0rd!234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_uid_b, 'authenticated', 'authenticated', 'rls_b_' || substr(v_uid_b::text,1,8) || '@risknova.test', crypt('Passw0rd!234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.user_profiles (id, auth_user_id, organization_id, email, full_name)
  values
    (v_profile_a, v_uid_a, v_org_id, 'rls_a@risknova.test', 'RLS Test A'),
    (v_profile_b, v_uid_b, v_org_id, 'rls_b@risknova.test', 'RLS Test B')
  on conflict (id) do nothing;

  select id into v_role_viewer from public.roles where code = 'viewer' limit 1;
  select id into v_role_admin from public.roles where code in ('admin', 'organization_admin', 'platform_admin') order by case code when 'admin' then 1 else 2 end limit 1;

  insert into public.user_roles (user_profile_id, role_id)
  values
    (v_profile_a, v_role_viewer),
    (v_profile_b, v_role_admin)
  on conflict do nothing;

  insert into public.notifications (id, organization_id, user_id, title, message, type, level)
  values
    (v_notification_a, v_org_id, v_uid_a, 'RLS A', 'A only', 'system', 'info'),
    (v_notification_b, v_org_id, v_uid_b, 'RLS B', 'B only', 'system', 'info');

  insert into public.rate_limits (
    id, user_id, organization_id, endpoint, scope, window_start, window_seconds, request_count, limit_count
  )
  values (
    v_rate_limit_id, v_uid_a, v_org_id, '/test', 'api', date_trunc('minute', now()), 60, 1, 60
  );

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_uid_a::text, true);
  return next is((select count(*)::integer from public.notifications), 1, 'Kullanici A sadece kendi bildirimini gorur');
  return next ok(exists(select 1 from public.notifications where id = v_notification_a), 'Kullanici A kendi bildirimine erisir');
  return next ok(not exists(select 1 from public.notifications where id = v_notification_b), 'Kullanici A diger kullanicinin bildirimini goremez');
  return next is((select count(*)::integer from public.rate_limits), 1, 'Kullanici A kendi rate limit kovasini gorur');

  perform set_config('request.jwt.claim.sub', v_uid_b::text, true);
  return next is((select count(*)::integer from public.notifications), 1, 'Kullanici B sadece kendi bildirimini gorur');
  return next ok(exists(select 1 from public.notifications where id = v_notification_b), 'Kullanici B kendi bildirimine erisir');
  return next ok(public.user_has_permission('security.events.view', v_uid_b), 'Admin kullanici guvenlik olaylarini gorur');
  return next ok(not public.user_has_permission('security.events.view', v_uid_a), 'Viewer guvenlik olaylarini goremez');

  delete from public.rate_limits where id = v_rate_limit_id;
  delete from public.notifications where id in (v_notification_a, v_notification_b);
  delete from public.user_roles where user_profile_id in (v_profile_a, v_profile_b);
  delete from public.user_profiles where id in (v_profile_a, v_profile_b);
  delete from auth.users where id in (v_uid_a, v_uid_b);
  delete from public.organizations where id = v_org_id;

  return next * from finish();
end;
$$;

comment on function public.rls_tests() is
  'pgTAP tabanli temel RLS dogrulama suiti. Deployment oncesi select * from public.rls_tests(); ile calistirilir.';
