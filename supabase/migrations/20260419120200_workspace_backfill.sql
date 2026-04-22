-- SKIPPED 2026-04-22 — uygulanmadı
--
-- Sebep: Bu migration `public.workspaces` tablosuna backfill yazıyordu, ancak
-- ilgili tabloyu oluşturan 20260419120000_workspace_system.sql skip edildi.
-- Tablo prod'da yok → INSERT başarısız olurdu.
--
-- Detay: yapi-denetim-raporu-2026-04-22.md.

select 1 where false;
