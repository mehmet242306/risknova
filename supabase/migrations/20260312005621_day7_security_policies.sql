create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id',
      auth.jwt() -> 'user_metadata' ->> 'organization_id'
    ),
    ''
  )::uuid
$$;
drop policy if exists "organizations_select_own_org" on public.organizations;
drop policy if exists "roles_select_authenticated" on public.roles;
drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_roles_select_own" on public.user_roles;
drop policy if exists "audit_logs_select_own_org" on public.audit_logs;
create policy "organizations_select_own_org"
on public.organizations
for select
to authenticated
using (
  id = public.current_organization_id()
);
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (
  auth.uid() = auth_user_id
);
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (
  auth.uid() = auth_user_id
)
with check (
  auth.uid() = auth_user_id
);
create policy "user_roles_select_own"
on public.user_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = user_roles.user_profile_id
      and up.auth_user_id = auth.uid()
  )
);
create policy "audit_logs_select_own_org"
on public.audit_logs
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);
