-- =============================================================================
-- Migration: 20260411120000_step05a_super_admin_infra
-- Tarih: 2026-04-11
-- Plan referansi: docs/database-hardening-plan.md Bolum 13 (Adim 0.5 Parca A)
-- =============================================================================

SET statement_timeout = '60s';
SET lock_timeout = '10s';

-- 1. user_profiles.is_super_admin kolonu
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_super_admin IS
  'Super admin bayragi. TRUE ise is_super_admin() fonksiyonu araciligiyla RLS policy bypass''i saglar. Adim 0.5 Parca A (2026-04-11).';

-- 2. Partial index
CREATE INDEX IF NOT EXISTS idx_user_profiles_super_admin
  ON public.user_profiles(auth_user_id)
  WHERE is_super_admin = true;

COMMENT ON INDEX public.idx_user_profiles_super_admin IS
  'Partial index: sadece is_super_admin = true satirlari. is_super_admin() fonksiyonu icin hizli lookup.';

-- 3. public.is_super_admin(uid) fonksiyonu
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT COALESCE(
    (SELECT up.is_super_admin
       FROM public.user_profiles up
      WHERE up.auth_user_id = uid
        AND up.is_super_admin = true
      LIMIT 1),
    false
  );
$fn$;

COMMENT ON FUNCTION public.is_super_admin(uuid) IS
  'Verilen kullanicinin (veya varsayilan olarak aktif oturumun) super admin olup olmadigini doner. SECURITY DEFINER: user_profiles RLS bypass. STABLE: ayni statement icinde cache. search_path = '''' (bos): search-path injection korumasi. Adim 0.5 Parca A (2026-04-11).';

ALTER FUNCTION public.is_super_admin(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- 4. Mehmet'in profilini super admin yap
UPDATE public.user_profiles
   SET is_super_admin = true
 WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid;

-- 5. Mehmet'e user_roles uzerinden super_admin rolu ata (idempotent)
INSERT INTO public.user_roles (id, user_profile_id, role_id, assigned_at, assigned_by)
SELECT
  gen_random_uuid(),
  up.id,
  r.id,
  now(),
  NULL
  FROM public.user_profiles up
 CROSS JOIN public.roles r
 WHERE up.auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
   AND r.code = 'super_admin'
   AND NOT EXISTS (
     SELECT 1
       FROM public.user_roles ur
      WHERE ur.user_profile_id = up.id
        AND ur.role_id = r.id
   );

-- 6. current_organization_id() guclendirme (Zamanlanmis Bomba Fix)
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT COALESCE(
    NULLIF(COALESCE(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id',
      auth.jwt() -> 'user_metadata' ->> 'organization_id'
    ), '')::uuid,
    (SELECT up.organization_id
       FROM public.user_profiles up
      WHERE up.auth_user_id = auth.uid()
        AND up.organization_id IS NOT NULL
      ORDER BY up.created_at DESC NULLS LAST
      LIMIT 1)
  );
$fn$;

COMMENT ON FUNCTION public.current_organization_id() IS
  'Aktif oturumun organization_id degerini doner. Once JWT''den (app_metadata/user_metadata fallback), sonra user_profiles tablosundan. SECURITY DEFINER: user_profiles RLS bypass. search_path = '''' (bos). Adim 0.5 Parca A guclendirmesi (2026-04-11).';

ALTER FUNCTION public.current_organization_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated, service_role;

-- 7. Migration sonu dogrulama
DO $verify$
DECLARE
  v_super_admin_count        int;
  v_mehmet_is_super          boolean;
  v_mehmet_has_role          boolean;
  v_is_super_admin_fn_exists boolean;
  v_current_org_sec_definer  boolean;
  v_is_super_admin_config    text[];
  v_current_org_config       text[];
  v_expected_search_path     text := 'search_path=""';
BEGIN
  SELECT count(*) INTO v_super_admin_count
    FROM public.user_profiles
   WHERE is_super_admin = true;

  SELECT EXISTS (
    SELECT 1
      FROM public.user_profiles
     WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
       AND is_super_admin = true
  ) INTO v_mehmet_is_super;

  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.user_profiles up ON up.id = ur.user_profile_id
      JOIN public.roles r ON r.id = ur.role_id
     WHERE up.auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
       AND r.code = 'super_admin'
  ) INTO v_mehmet_has_role;

  SELECT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'is_super_admin'
  ) INTO v_is_super_admin_fn_exists;

  SELECT p.proconfig INTO v_is_super_admin_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'is_super_admin'
     AND pg_get_function_arguments(p.oid) = 'uid uuid DEFAULT auth.uid()';

  SELECT p.prosecdef, p.proconfig
    INTO v_current_org_sec_definer, v_current_org_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'current_organization_id'
     AND pg_get_function_arguments(p.oid) = '';

  RAISE NOTICE '=== Adim 0.5 Parca A Migration Dogrulama ===';
  RAISE NOTICE 'Super admin sayisi (beklenen 1): %', v_super_admin_count;
  RAISE NOTICE 'Mehmet is_super_admin = true (beklenen t): %', v_mehmet_is_super;
  RAISE NOTICE 'Mehmet super_admin rolu (beklenen t): %', v_mehmet_has_role;
  RAISE NOTICE 'is_super_admin() fonksiyonu (beklenen t): %', v_is_super_admin_fn_exists;
  RAISE NOTICE 'is_super_admin() proconfig (beklenen {%}): %', v_expected_search_path, v_is_super_admin_config;
  RAISE NOTICE 'current_organization_id() SECURITY DEFINER (beklenen t): %', v_current_org_sec_definer;
  RAISE NOTICE 'current_organization_id() proconfig (beklenen {%}): %', v_expected_search_path, v_current_org_config;

  IF v_super_admin_count <> 1 THEN
    RAISE EXCEPTION 'Beklenmeyen super admin sayisi: % (beklenen 1)', v_super_admin_count;
  END IF;
  IF NOT v_mehmet_is_super THEN
    RAISE EXCEPTION 'Mehmet profili is_super_admin = true yapilamadi';
  END IF;
  IF NOT v_mehmet_has_role THEN
    RAISE EXCEPTION 'Mehmet''e super_admin rolu atanamadi';
  END IF;
  IF NOT v_is_super_admin_fn_exists THEN
    RAISE EXCEPTION 'public.is_super_admin() fonksiyonu olusturulamadi';
  END IF;
  IF NOT v_current_org_sec_definer THEN
    RAISE EXCEPTION 'public.current_organization_id() SECURITY DEFINER hale getirilemedi';
  END IF;
  IF v_is_super_admin_config IS NULL
     OR NOT (v_is_super_admin_config @> ARRAY[v_expected_search_path]) THEN
    RAISE EXCEPTION 'is_super_admin() search_path yanlis: beklenen %, gelen %',
      v_expected_search_path, v_is_super_admin_config;
  END IF;
  IF v_current_org_config IS NULL
     OR NOT (v_current_org_config @> ARRAY[v_expected_search_path]) THEN
    RAISE EXCEPTION 'current_organization_id() search_path yanlis: beklenen %, gelen %',
      v_expected_search_path, v_current_org_config;
  END IF;

  RAISE NOTICE '=== TUM DOGRULAMALAR BASARILI — Adim 0.5 Parca A tamam ===';
END $verify$;;
