-- SKIPPED 2026-04-22 — uygulanmadı
--
-- Sebep: ohs_archive_scope_presets tablosuna jurisdictionally pre-defined
-- kapsam şablonları yazıyordu. Frontend `ohs_archive_jobs` kullanımında
-- `scope` kolonuna direct JSON gönderiyor (preset tablosunu sorgulamıyor).
-- Tablo olmadan mevcut akış çalışıyor.
--
-- Detay: yapi-denetim-raporu-2026-04-22.md.

select 1 where false;
