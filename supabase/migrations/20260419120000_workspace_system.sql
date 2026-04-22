-- SKIPPED 2026-04-22 — uygulanmadı
--
-- Sebep: prod'da zaten farklı şemaya sahip `workspace_members` tablosu var
-- (company_workspace_id, user_profile_id, role, permissions jsonb). Bu
-- migration'ın workspace_members şeması (workspace_id, user_id, role_key,
-- certification_id, is_primary) ile taban taban ters. CREATE TABLE IF NOT
-- EXISTS no-op geçse bile sonraki CREATE INDEX (user_id) çakıştığı için
-- apply başarısız oluyordu.
--
-- Ek olarak frontend tarafında `.from("workspaces")` çağrısı sıfır; multi-
-- country rollout konsepti henüz ürün kararı olmadığı için ölü kod.
--
-- Detay: yapi-denetim-raporu-2026-04-22.md — bölüm "Migration Drift".
--
-- Bu dosya bilerek boş bırakıldı. Supabase db push bu migration'ı bulup
-- çalıştırsa hiçbir etkisi olmaz.

select 1 where false;
