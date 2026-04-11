-- Organizations: user can read only its own organization
create policy "organizations_select_own_org"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.organization_id = organizations.id
      and up.auth_user_id = auth.uid()
  )
);
-- Roles: authenticated users can read roles
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);
-- User profiles: user can read own profile
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (auth.uid() = auth_user_id);
-- User profiles: user can update own profile
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
-- User roles: user can read own assigned roles
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
-- Audit logs: user can read logs from own organization
create policy "audit_logs_select_own_org"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.organization_id = audit_logs.organization_id
      and up.auth_user_id = auth.uid()
  )
);
