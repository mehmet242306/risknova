-- SKIPPED 2026-04-22 — uygulanmadı
--
-- Sebep: Frontend tarafında bu migration'ın ekleyeceği workspace-scoping
-- alanlarına yapılan açık referans bulunmuyor (solution_queries kullanımları
-- org-scope ile çalışıyor). Hedeflediği multi-country workspace konsepti
-- (20260419120000_workspace_system) skip edildiği için bu da skip.
-- Ayrıca migration içindeki current_workspace_id() override'ı mevcut doğru
-- versiyonu bozardı (WHERE id = auth.uid() yerine WHERE auth_user_id = auth.uid()
-- olmalı).
--
-- Detay: yapi-denetim-raporu-2026-04-22.md.

select 1 where false;
