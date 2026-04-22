-- =============================================================================
-- user_has_permission — 5'li rol adapter (access_role) desteği
-- =============================================================================
-- Önceki versiyon sadece user_roles → role_permissions zincirinden permission
-- kontrol ediyordu. Bugün eklenen `company_memberships.access_role` ve
-- `organization_memberships.role` 5-role adapter kolonları bu zincirin dışında
-- kaldığından, davet kabul eden yeni admin/manager kullanıcılar UI'da doğru
-- görünse bile `requirePermission()` ile korunan API'lere 403 alıyordu.
--
-- Fonksiyon artık 3 kaynaktan herhangi birinde match eşleşirse TRUE döner:
--   1. user_roles (legacy system)
--   2. company_memberships.access_role → roles(code) → role_permissions
--   3. organization_memberships.role → roles(code) → role_permissions
--
-- Not: Bu, rol adapter'ını DB-driven yetki kontrolüne bağlar. Böylece
-- `BUSINESS_PERMISSION_MATRIX` (JS) ve `role_permissions` (DB) arasında
-- gerçek senkronizasyon RPC bazında test edilebilir.
-- =============================================================================

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

  -- 1) Legacy user_roles
  if exists (
    select 1
    from public.user_profiles up
    join public.user_roles ur on ur.user_profile_id = up.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where up.auth_user_id = p_uid
      and p.code = p_permission_code
  ) then
    return true;
  end if;

  -- 2) company_memberships.access_role (5-role adapter — per firma)
  if exists (
    select 1
    from public.company_memberships cm
    join public.roles r on r.code = cm.access_role
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where cm.user_id = p_uid
      and cm.status = 'active'
      and p.code = p_permission_code
  ) then
    return true;
  end if;

  -- 3) organization_memberships.role (5-role adapter — hesap seviyesi)
  if exists (
    select 1
    from public.organization_memberships om
    join public.roles r on r.code = om.role
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where om.user_id = p_uid
      and om.status = 'active'
      and p.code = p_permission_code
  ) then
    return true;
  end if;

  return false;
end;
$$;
