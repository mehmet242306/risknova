-- =============================================================================
-- Migration: 20260411120000_step05a_super_admin_infra
-- Tarih: 2026-04-11
-- Plan referansi: docs/database-hardening-plan.md Bolum 13 (Adim 0.5 Parca A)
-- Rollback dosyasi: supabase/rollbacks/20260411120000_step05a_rollback.sql
--
-- AMAC
-- Bu migration iki ayri sorunu ayni atomik islemde cozer.
--
-- SORUN 1 — Fail-Open Admin (KRITIK)
--   Mevcut sistemde super admin mekanizmasi kismi:
--     * roles tablosunda 'super_admin' kodu tanimli ama hic kimseye atanmamis
--     * user_profiles.is_super_admin kolonu YOK
--     * public.is_super_admin() fonksiyonu YOK
--     * Bootstrap'ta Mehmet'e "Organization Admin" rolu atanmis, "super_admin" DEGIL
--     * Frontend fail-open (settings/page.tsx) + backend admin-ai route'lari
--       hicbir kontrol yapmiyor — ama bunlar ayri PR'larda duzeltilecek
--   Bu migration yalnizca DB altyapisini kurar:
--     * user_profiles.is_super_admin boolean kolonu (default false, NOT NULL)
--     * Partial index (sadece is_super_admin = true satirlar icin)
--     * public.is_super_admin(uid uuid) fonksiyonu (SECURITY DEFINER + STABLE)
--     * Mehmet'in profili is_super_admin = true
--     * Mehmet'e user_roles uzerinden "super_admin" rolu
--
-- SORUN 2 — current_organization_id() Zamanlanmis Bomba
--   Mevcut fonksiyon JWT'den organization_id claim'i okuyor. Mevcut 3 kullanicinin
--   hepsinde auth.users.raw_app_meta_data.organization_id MANUEL set edilmis
--   (muhtemelen SQL Editor'dan) ve bu nedenle fonksiyon calisiyor. Ama hicbir kod
--   (migration, Edge Function, frontend, trigger) bu alani set etmiyor — yeni
--   kullanici signup yaparsa app_metadata bos olacak, current_organization_id()
--   NULL donecek, 52 RLS policy o kullanici icin sessizce hicbir sey dondurmeyecek.
--   Bu migration fonksiyona son fallback olarak user_profiles JOIN ekler:
--     * SECURITY INVOKER → SECURITY DEFINER (user_profiles RLS bypass)
--     * STABLE korunur, dil SQL kalir (CREATE OR REPLACE guvenli, signature ayni)
--     * Mevcut davranis (JWT dolu kullanicilar icin) DEGISMEZ
--     * Yeni kullanici icin user_profiles fallback devreye girer
--
-- ATOMIK TRANSACTION
-- Supabase CLI migration'lari otomatik transaction icinde calistirir. Bu dosyada
-- acik BEGIN/COMMIT yok; herhangi bir RAISE EXCEPTION tum degisiklikleri geri alir.
--
-- SEARCH_PATH STANDARDI
-- Mevcut current_organization_id() zaten SET search_path TO '' (bos) kullaniyor.
-- Bu search-path injection saldirilarina karsi koruma saglar ve fonksiyon icindeki
-- tum tablo referanslarini tam sema yolu ile yazmayi zorunlu kilar. Hem yeni
-- is_super_admin() fonksiyonu hem de guncellenmis current_organization_id()
-- ayni standardi kullanir (tutarlilik + guvenlik). Fonksiyon govdeleri zaten
-- public.user_profiles gibi tam yol ile yazilmis.
-- =============================================================================

-- Guvenlik: lock ve statement timeout
SET statement_timeout = '60s';
SET lock_timeout = '10s';
-- -----------------------------------------------------------------------------
-- 1. user_profiles.is_super_admin kolonu
-- -----------------------------------------------------------------------------
-- Idempotent: IF NOT EXISTS. NOT NULL + DEFAULT false: mevcut 2 satir icin
-- varsayilan deger uygulanir, Mehmet madde 4'te TRUE'ya cekilir.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.user_profiles.is_super_admin IS
  'Super admin bayragi. TRUE ise is_super_admin() fonksiyonu araciligiyla RLS policy bypass''i saglar. Adim 0.5 Parca A (2026-04-11).';
-- -----------------------------------------------------------------------------
-- 2. Partial index — sadece is_super_admin = true satirlar icin
-- -----------------------------------------------------------------------------
-- Hedef: is_super_admin() fonksiyonunda hizli lookup. Partial oldugu icin
-- indeks boyutu cok kucuk (genelde <10 satir). auth_user_id uzerinde cunku
-- fonksiyon bu kolon ile sorgulayacak.

CREATE INDEX IF NOT EXISTS idx_user_profiles_super_admin
  ON public.user_profiles(auth_user_id)
  WHERE is_super_admin = true;
COMMENT ON INDEX public.idx_user_profiles_super_admin IS
  'Partial index: sadece is_super_admin = true satirlari. is_super_admin() fonksiyonu icin hizli lookup.';
-- -----------------------------------------------------------------------------
-- 3. public.is_super_admin(uid) fonksiyonu
-- -----------------------------------------------------------------------------
-- Desen: is_company_member() ve is_company_approver() ile ayni (SECURITY DEFINER
-- + STABLE + SET search_path). LIMIT 1 koruma icin. COALESCE ile NULL yerine
-- false doner (auth.uid() NULL ise veya profile yoksa).
--
-- Parametre varsayilani auth.uid(): frontend'den dogrudan RPC ile cagrildiginda
-- is_super_admin() yeterli; baska bir uid icin is_super_admin('xxx'::uuid).

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    (SELECT up.is_super_admin
       FROM public.user_profiles up
      WHERE up.auth_user_id = uid
        AND up.is_super_admin = true
      LIMIT 1),
    false
  );
$$;
COMMENT ON FUNCTION public.is_super_admin(uuid) IS
  'Verilen kullanicinin (veya varsayilan olarak aktif oturumun) super admin olup olmadigini doner. SECURITY DEFINER: user_profiles RLS bypass. STABLE: ayni statement icinde cache. search_path = '''' (bos): search-path injection korumasi, tum referanslar tam sema yolu ile yazilir. Adim 0.5 Parca A (2026-04-11).';
-- Sahip: postgres (default). Izin: public kaldirilir, authenticated + service_role eklenir.
ALTER FUNCTION public.is_super_admin(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
-- -----------------------------------------------------------------------------
-- 4. Mehmet'in profilini super admin yap
-- -----------------------------------------------------------------------------
-- Hedef auth_user_id: f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d
-- Bu UID auth.users tablosunda mehmet242306@gmail.com'a ait (dogrulandi 2026-04-11).
-- Diger 2 test kullanicisi (mehmetyildirim2923@, mehmetyildirim063423@) normal kullanici
-- olarak kalir (is_super_admin = false, default).
--
-- KRITIK NOT: UID hardcoded. Eger projedeki uid degisirse bu migration Mehmet'i
-- super admin yapmaz — ama migration yine de basarili sayilir ve madde 6 dogrulamasi
-- sirasinda RAISE EXCEPTION dogar. Bu gucvenlik icin kasıtli: yanlis uid ile sessizce
-- gecmektense patlamak daha guvenli.

UPDATE public.user_profiles
   SET is_super_admin = true
 WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid;
-- -----------------------------------------------------------------------------
-- 5. Mehmet'e user_roles uzerinden "super_admin" rolu ata
-- -----------------------------------------------------------------------------
-- NOT: roles tablosunda 'super_admin' kodu 20260312002129_day6_organization_foundation.sql
-- migration'i ile zaten tanimli. Bu INSERT idempotent: NOT EXISTS koruma var, iki kez
-- calistirilsa da duplicate kayit olusturmaz.
--
-- Bu rol ataması is_super_admin kolonuna EK katman — mevcut sistemde RBAC kodlari
-- rol tablosunu okuyor (ornegin settings page'deki ADMIN_ROLES kontrolu), o yuzden
-- hem kolon hem rol atanir. Ileride tek bir kaynak (kolon veya rol) secilir.

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
-- -----------------------------------------------------------------------------
-- 6. current_organization_id() fonksiyonu guclendirme (Zamanlanmis Bomba Fix)
-- -----------------------------------------------------------------------------
-- Mevcut fonksiyon (20260312005621_day7_security_policies.sql):
--   LANGUAGE sql, STABLE, SECURITY INVOKER (default)
--   auth.jwt()'den organization_id okur, user_metadata/app_metadata fallback'li
--
-- Degisiklikler:
--   * SECURITY INVOKER → SECURITY DEFINER
--   * SET search_path = public eklendi (security definer best practice)
--   * Son fallback katmani: user_profiles JOIN
--   * Dil: SQL (ayni) — CREATE OR REPLACE dil degisimi yok, guvenli
--   * Signature: argumansiz, RETURNS uuid (ayni)
--
-- 88 RLS policy bu fonksiyonu cagiriyor (qual + with_check birlesik). Mevcut davranis (JWT dolu kullanicilar)
-- degismez cunku katman 1 aynen korunuyor. Yeni kullanici icin katman 2 devreye
-- girer. CREATE OR REPLACE fonksiyonun IMZASI aynı kaldigi icin policy'ler
-- yeniden bind'lanmaz.

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    -- Katman 1: JWT claim (eski davranis — hizli yol)
    NULLIF(COALESCE(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id',
      auth.jwt() -> 'user_metadata' ->> 'organization_id'
    ), '')::uuid,
    -- Katman 2: user_profiles JOIN (YENI — zamanlanmis bomba fix)
    (SELECT up.organization_id
       FROM public.user_profiles up
      WHERE up.auth_user_id = auth.uid()
        AND up.organization_id IS NOT NULL
      ORDER BY up.created_at DESC NULLS LAST
      LIMIT 1)
  );
$$;
COMMENT ON FUNCTION public.current_organization_id() IS
  'Aktif oturumun organization_id degerini doner. Once JWT''den (app_metadata/user_metadata fallback), sonra user_profiles tablosundan. SECURITY DEFINER: user_profiles RLS bypass. search_path = '''' (bos): mevcut standartla tutarli, search-path injection korumasi. Adim 0.5 Parca A guclendirmesi (2026-04-11).';
ALTER FUNCTION public.current_organization_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated, service_role;
-- -----------------------------------------------------------------------------
-- 7. Migration sonu dogrulama
-- -----------------------------------------------------------------------------
-- Her adimin beklenen sonucu kontrol edilir. Herhangi bir sapmada RAISE EXCEPTION
-- ile tum migration rollback edilir (atomik transaction).

DO $$
DECLARE
  v_super_admin_count        int;
  v_mehmet_profile_exists    boolean;
  v_mehmet_is_super          boolean;
  v_mehmet_has_role          boolean;
  v_is_super_admin_fn_exists boolean;
  v_current_org_sec_definer  boolean;
  v_is_super_admin_config    text[];
  v_current_org_config       text[];
  v_expected_search_path     text := 'search_path=""';
BEGIN
  -- 7.1 Kac kullanici super admin?
  SELECT count(*) INTO v_super_admin_count
    FROM public.user_profiles
   WHERE is_super_admin = true;

  -- 7.1.1 Hedef profil local ortamda var mi?
  SELECT EXISTS (
    SELECT 1
      FROM public.user_profiles
     WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
  ) INTO v_mehmet_profile_exists;

  -- 7.2 Mehmet'in profilinde bayrak true mi?
  SELECT EXISTS (
    SELECT 1
      FROM public.user_profiles
     WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
       AND is_super_admin = true
  ) INTO v_mehmet_is_super;

  -- 7.3 Mehmet'e user_roles uzerinden super_admin atandi mi?
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.user_profiles up ON up.id = ur.user_profile_id
      JOIN public.roles r ON r.id = ur.role_id
     WHERE up.auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'::uuid
       AND r.code = 'super_admin'
  ) INTO v_mehmet_has_role;

  -- 7.4 is_super_admin() fonksiyonu olustu mu + proconfig'i ne?
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

  -- 7.5 current_organization_id() SECURITY DEFINER oldu mu + proconfig'i ne?
  SELECT p.prosecdef, p.proconfig
    INTO v_current_org_sec_definer, v_current_org_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'current_organization_id'
     AND pg_get_function_arguments(p.oid) = '';

  -- Rapor
  RAISE NOTICE '=== Adim 0.5 Parca A Migration Dogrulama ===';
  RAISE NOTICE 'Super admin sayisi: %', v_super_admin_count;
  RAISE NOTICE 'Mehmet profili local ortamda bulundu mu?: %', v_mehmet_profile_exists;
  RAISE NOTICE 'Mehmet is_super_admin = true: %', v_mehmet_is_super;
  RAISE NOTICE 'Mehmet super_admin rolu: %', v_mehmet_has_role;
  RAISE NOTICE 'is_super_admin() fonksiyonu (beklenen t): %', v_is_super_admin_fn_exists;
  RAISE NOTICE 'is_super_admin() proconfig (beklenen {%}): %', v_expected_search_path, v_is_super_admin_config;
  RAISE NOTICE 'current_organization_id() SECURITY DEFINER (beklenen t): %', v_current_org_sec_definer;
  RAISE NOTICE 'current_organization_id() proconfig (beklenen {%}): %', v_expected_search_path, v_current_org_config;

  -- Sert kontroller: ortama bagimli veri yerine altyapi tutarliligi dogrulanir.
  IF v_mehmet_profile_exists AND NOT v_mehmet_is_super THEN
    RAISE EXCEPTION 'Hedef super admin profili bulundu ancak is_super_admin = true yapilamadi';
  END IF;

  IF v_mehmet_profile_exists AND NOT v_mehmet_has_role THEN
    RAISE EXCEPTION 'Hedef super admin profili bulundu ancak super_admin rolu atanamadi';
  END IF;

  IF NOT v_is_super_admin_fn_exists THEN
    RAISE EXCEPTION 'public.is_super_admin() fonksiyonu olusturulamadi';
  END IF;

  IF NOT v_current_org_sec_definer THEN
    RAISE EXCEPTION 'public.current_organization_id() SECURITY DEFINER hale getirilemedi';
  END IF;

  -- 7.6 Search_path kontrolleri: her iki fonksiyon da bos search_path kullanmali
  -- proconfig array'i '{search_path=""}' icermeli (PostgreSQL bos string icin cift tirnak gosterimi)
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
END $$;
-- EOF;
