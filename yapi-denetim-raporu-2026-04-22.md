# Yapı Denetim Raporu — risknova-platform

**Tarih:** 2026-04-22
**Kapsam:** Git ↔ prod Supabase tutarlılığı, kod sağlığı, orphan sayfalar, Supabase Advisor uyarıları, güvenlik delikleri, kullanılmayan yapılar.
**Çıkış:** "Kırılmış ya da ileride sorun çıkaracak şeyler + yetim sayfa listesi + çözüm önerileri".

---

## 🔴 ÖZET — En Kritik 3 Bulgu

1. **10 migration git'te commit edildi ama PROD'A HİÇ UYGULANMADI.** Push edilen en az **11 frontend dosyası** bu olmayan tablolara bağımlı — Vercel ortamında 500 hatası üretirler.
2. **`is_company_approver` RLS vs `access_role` UI kontrolü mismatch'i**. Bir kullanıcı UI'da "Yönetici" görünse bile prod'da rol değiştirmeye kalktığında RLS engelleyebilir (veya tersi).
3. **11 orphan sayfa** — menüye bağlı değil, çoğu "Yakında" placeholder ya da redirect shim. Kod kirliliği + potansiyel güvenlik yüzeyi.

Devamı aşağıda detaylı.

---

## 1. 🔴 KRİTİK — Migration Drift (Git ↔ Prod)

### Sorun
Prod Supabase'de **son uygulanan** (bugün hariç) migration: `20260419063445_incident_ai_corrective_actions` (dünün oturumu dışında). Sonraki 20260419** migration'lardan **sadece 3'ü** uygulandı (bugün). **10 migration git'te var ama prod'da yok:**

| Dosya | Ne Ekliyor |
|---|---|
| `20260419110000_mevzuat_versioned_retrieval_and_trace.sql` | `mevzuat_document_versions`, izleme tablosu |
| `20260419120000_workspace_system.sql` | Workspace temel sistemi |
| `20260419120100_seed_certifications.sql` | Sertifika seed'i |
| `20260419120200_workspace_backfill.sql` | `workspace_backfill_log` |
| `20260419123000_workspace_scope_solution_center.sql` | Çözüm merkezi workspace scoping |
| `20260419130000_legal_corpus_scoping.sql` | Hukuk corpus scoping |
| `20260419130000_ohs_archive_jobs.sql` | `ohs_archive_jobs`, `ohs_archive_job_items` |
| `20260419130100_ohs_archive_scope_presets.sql` | Arşiv preset'leri |
| `20260419143000_nova_outbox_and_dlq.sql` | `nova_outbox`, `nova_outbox_dlq` |
| `20260419180000_nova_governance_eval_and_rollouts.sql` | `nova_governance_evaluations`, rollout tabloları |
| `20260419213000_workspace_assignment_role_normalization.sql` | workspace_assignments rol normalizasyonu |

**Doğrulama:** Prod'da tabloları sorguladım — `nova_outbox`, `nova_outbox_dlq`, `ohs_archive_jobs`, `mevzuat_document_versions`, `workspace_backfill_log`, `nova_governance_evaluations` tablolarının hepsi **mevcut değil**.

### Kim Bozuldu
Frontend'den 11 dosya bu eksik tablolara başvuruyor (grep doğrulandı):

- `frontend/src/app/api/self-healing/nova-outbox/[id]/route.ts` → `nova_outbox` tablosu
- `frontend/src/app/api/ohs-archive/create/route.ts`, `[id]/route.ts`, `[id]/download/route.ts` → `ohs_archive_jobs`
- `frontend/src/lib/supabase/ohs-archive-api.ts` → `ohs_archive_jobs`
- `frontend/src/lib/nova/governance.ts` → `nova_governance_evaluations`
- `frontend/src/lib/self-healing/queue.ts`, `frontend/src/lib/nova/action-endpoint.ts` → `nova_outbox`
- `frontend/src/app/(protected)/settings/SelfHealingTab.tsx` → Self-healing queue (outbox)
- `frontend/src/app/api/self-healing/queue/[id]/route.ts` → `nova_outbox`
- `frontend/src/app/(protected)/osgb/documents/page.tsx` → `ohs_archive_jobs`

**Sonuç:** Vercel'e push edilmiş ama prod Supabase'de tablolar yok. Bu endpoint'leri ve sayfaları açan kullanıcı `relation "public.nova_outbox" does not exist` tarzı 500 hatası alır.

### Çözüm Önerisi
**Yüksek öncelik.** 10 migration'ı sırayla prod'a uygula. Her biri idempotent olup olmadığını önce hızlıca inceleyip sonra `apply_migration` ile gönder. Tahminî süre: 30-45 dk + doğrulama.

**DİKKAT:** `20260419130000_legal_corpus_scoping.sql` ve `20260419130000_ohs_archive_jobs.sql` **aynı timestamp**. Supabase migration runner alphabetical sıralar (l < o) → legal önce, ohs sonra. Ama bu pattern `db push` ile beklenmeyen davranışlara yol açabilir — içeriklerini oku, bağımsız çalıştıklarından emin ol.

---

## 2. 🟡 KRİTİK-ORTA — RLS vs UI Kontrol Mismatch

### Sorun
`company_memberships.access_role` UPDATE için RLS policy:
```sql
UPDATE USING is_company_approver(company_identity_id)
```

Bu fonksiyon eski sistem üzerinden çalışıyor (muhtemelen membership_role = 'owner' veya can_approve_join_requests = true). Ancak CompanyMembersList.tsx'teki UI kontrol:
```tsx
setCanManage(me?.access_role === "owner" || me?.access_role === "admin");
```

`access_role` **yeni kolon**; `is_company_approver` onu bilmiyor.

### Örnek Senaryo
Yeni davet kabul eden kullanıcı:
- `company_memberships.access_role = 'admin'` (davetten geldi)
- `company_memberships.membership_role = 'viewer'` (default)
- `can_approve_join_requests = false` (default)

UI canManage = TRUE (access_role admin). Kullanıcı rol dropdown'ını tıklar, UPDATE çalıştırır. RLS `is_company_approver` kontrol eder → `membership_role != 'owner'`, `can_approve_join_requests = false` → **FALSE** → UPDATE reddedilir. Kullanıcı hata alır.

### Çözüm Önerisi
İki seçenek:

**A) RLS'i access_role'a duyarlı yap (önerilen):**
```sql
CREATE OR REPLACE FUNCTION public.is_company_approver(p_company_identity_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_identity_id = p_company_identity_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND (
        cm.can_approve_join_requests = true
        OR cm.membership_role = 'owner'
        OR cm.access_role IN ('owner', 'admin')
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**B) UI canManage'ı RLS ile aynı kurala getir:** `can_approve_join_requests` de kontrol et. Ama bu daha dar olur.

A + bir trigger: kullanıcı access_role = 'owner'|'admin' set ederse aynı kayıtta `can_approve_join_requests = true` de yap (sync).

---

## 3. 🟡 ORTA — Orphan Sayfalar (11 adet)

Hiç nav link'i / hiç referansı olmayan ya da sadece redirect yapan sayfalar:

| Sayfa | Tip | Öneri |
|---|---|---|
| `(protected)/analizler/page.tsx` | Redirect → `/incidents` | **Sil**, `next.config.js` redirect'e taşı |
| `(protected)/visual-risk/page.tsx` | Redirect → `/risk-analysis` | **Sil**, redirect'e taşı |
| `(protected)/closure-verification/page.tsx` | "Yakında" stub | **Sil** |
| `(protected)/health/page.tsx` | "Yakında" stub | **Sil** |
| `(protected)/health-docs/page.tsx` | "Yakında" stub | **Sil** |
| `(protected)/photo-findings/page.tsx` | "Yakında" stub | **Sil** |
| `(protected)/tasks/page.tsx` | "Yakında" stub | **Sil** |
| `(protected)/users/page.tsx` | "Yakında" stub | **Sil** veya settings/UserManagementTab ile birleştir |
| `(protected)/osgb/announcements/page.tsx` | Stub | **Sil** veya OSGB menüsüne ekle |
| `(protected)/live-scan/page.tsx` | İşlevsel ama menüsüz | **Menüye ekle** |
| `(protected)/documents/personal/page.tsx` | İşlevsel ama menüsüz | **`/documents` sekmesine entegre** |

**Ek temizlik adayı:** `frontend/src/_parked/protected-pages/` dizini. İçinde 17 eski sayfa var (calendar, hazard-library, locations, r-skor-2d, rham vb). Routing'e bağlı değil (park edilmiş). Gözden geçirip sil.

### Çözüm Önerisi
Tek bir commit'te 9 stub/redirect sayfayı sil. live-scan ve documents/personal için ayrıca bir commit ile menüye ekle veya entegre et. _parked/ dizinini ayrıca sil (git log tutuyor zaten).

---

## 4. 🟡 ORTA — Supabase Advisor Aktif Uyarıları

Bugünkü advisor çalışmasında **aynı uyarılar** devam ediyor (bizim fix ettiğimiz `slide_deck_sessions_update` hariç):

### ERROR seviyesi (1)
- `scan_session_stats` view'ı `SECURITY DEFINER` ile tanımlı — view, view oluşturucunun izinleriyle çalışır, RLS by-pass edilir.
  - **Çözüm:** View'ı `SECURITY INVOKER` olarak yeniden tanımla.

### WARN seviyesi
- **~18 tablo `USING (true)` veya `WITH CHECK (true)` RLS politikasıyla** — çok permissive. Listede: `ai_qa_learning`, `certificate_templates`, `certificates`, `surveys`, `survey_questions`, `survey_tokens`, `survey_responses`, `company_committee_meetings`, `company_periodic_controls`, `company_training_attendees`, `company_trainings`, `slide_view_events` (INSERT), vb.
  - **Çözüm:** Her biri için org_scoped kural yaz.
- **6 public bucket broad listing** — `avatars`, `company-logos`, `documents`, `scan-images`, `slide-media`, `voice-notes`. URL bilen herkes bucket'ın tüm dosyalarını listeleyebilir.
  - **Çözüm:** Storage policy'lerini daralt (path-prefix-based read).
- **20+ fonksiyonda `search_path` mutable** — SQL injection saldırı yüzeyi (minor ama mevcut).
  - **Çözüm:** Her fonksiyona `SET search_path = public` ekle.
- **Auth leaked password protection disabled** — HIBP kontrolü kapalı.
  - **Çözüm:** Supabase dashboard → Auth → Password → Enable HIBP.

### INFO seviyesi
- **10 AI tablosunda RLS açık ama policy yok** — data tamamen kilitli (yalnızca service_role). Kasıtlı olabilir ama dokumente et.

---

## 5. 🟡 ORTA — Kod Sağlığı Bulguları

### 5.1 `user_has_permission` RPC legacy kalıyor
- `frontend/src/lib/hooks/use-permission.ts` + api-auth.ts `requirePermission` → `user_has_permission` RPC'sini çağırıyor.
- RPC sadece `user_roles → role_permissions` zincirini kullanıyor (eski 10-rol sistemi).
- Bugünkü 5'li adapter (`company_memberships.access_role`) RPC tarafından bilinmiyor.
- **Sonuç:** UI'da `useCompanyAccessRole` ile 5'li model görünürken, `requirePermission()` geri kalan yerlerde eski rolleri kontrol ediyor. İki sistem paralel.
- **Çözüm:** `user_has_permission`'ı genişlet — hem user_roles hem company_memberships.access_role bakısın. Ayrı bir migration tur.

### 5.2 `invited_role` vs `access_role` enum mismatch
- `company_invitations.invited_role` check: owner/admin/manager/editor/staff/viewer (6 değer).
- `company_memberships.access_role` check: owner/admin/manager/editor/viewer (5 değer, **staff yok**).
- `accept_company_invitation` içinde `if access_role not in (...) then access_role := 'viewer'` fallback var — yani 'staff' sessizce 'viewer' olur.
- API schema zaten 'staff' kabul etmiyor, ama DB doğrudan insert'e açık. Minör.
- **Çözüm:** Ya 'staff' destekle (access_role check'e ekle), ya invited_role check'inden 'staff'ı sil. Tercih: sil — 5'li model temiz.

### 5.3 `score-history/page.tsx` modified + yeni untracked dosya
- `git status`'te `score-history/page.tsx` modified + `score-history/FieldInspectionClient.tsx` untracked (dünden kalma). Committe edilmemiş, eski şemaya bağlı olabilir.
- **Çözüm:** İçeriği gözden geçir, commit et ya da discard et (kullanılmıyorsa).

### 5.4 Duplicate migration timestamp
- `20260419130000_legal_corpus_scoping.sql` ve `20260419130000_ohs_archive_jobs.sql` aynı timestamp. Supabase migration runner alfabetik sıralar — fonksiyonel ama best practice değil.
- **Çözüm:** Birini `20260419130001_...` olarak rename et ve yeniden commit et.

### 5.5 İki davet sistemi paralel
- **Eski**: `sendOsgbPersonnelInviteEmail` — OSGB personel için `loginUrl + temporaryPassword` gönderir (pre-provisioning). `api/osgb/personnel/invite`.
- **Yeni**: `sendCompanyInvitationEmail` (bugün eklenen) — `/invite/[id]` linki. `api/companies/[id]/invitations`.
- **Sonuç:** İki farklı invitation akışı. OSGB personel davet hâlâ eski pattern kullanıyor; yeni accept page OSGB akışına bağlanmamış.
- **Çözüm:** OSGB personel davet'ini de yeni pattern'e geçirecek bir follow-up tur. Şu an ikisi birlikte çalışıyor, sorun yok ama code duplication var.

---

## 6. 🟢 DÜŞÜK — Diğer Bulgular

- **`.claude/settings.local.json` git'te takip ediliyor** — lokal developer ayarı, normalde gitignore'da olmalı. Şu an bazı commit'lerde M olarak görünüyor, her build'de değişebilir.
- **OSGB announcements sayfası stub + menüsüz** (orphan listesinde de). OSGB alt uygulaması içinde hiç kullanılmıyor.
- **`InviteMemberPanel` permission gate çalışır ama henüz diğer kritik butonlara (sil, arşivle) yayılmadı.** Pattern kullanıma hazır (`canPerform(role, "delete")` vb.) ama şu an sadece davet butonunda var.

---

## 7. 📋 Öncelik Sıralı Çözüm Planı

### Hemen (bu oturum veya bir sonraki)
1. **[~45 dk]** 10 eski migration'ı prod'a uygula (nova_outbox, ohs_archive_jobs, nova_governance, mevzuat_versioned, workspace_system, workspace_backfill, workspace_scope_solution_center, legal_corpus_scoping, workspace_assignment_role_normalization, ohs_archive_scope_presets). Her birini **önce oku**, sonra `apply_migration`.
2. **[~15 dk]** `is_company_approver` fonksiyonunu `access_role`'a duyarlı hale getir (migration). Hem RLS hem is_company_member hem can_manage_company_invitations doğru çalışsın.
3. **[~20 dk]** 11 orphan sayfayı sil ya da menüye ekle. Stub'lar + redirect'ler silinir; live-scan + documents/personal menüye eklenir.

### Kısa vadeli (hafta içi)
4. `user_has_permission` RPC'sine access_role + organization_memberships.role duyarlılığı ekle (migration).
5. `scan_session_stats` view'ı SECURITY INVOKER olarak yeniden tanımla (advisor ERROR).
6. `_parked/protected-pages/` dizinini sil (17 dosya).
7. `.claude/settings.local.json`'u gitignore'a al.
8. `score-history/FieldInspectionClient.tsx` (untracked) durumunu netleştir.

### Orta vadeli (beta sonrası)
9. 18 `using (true)` RLS politikasını sırayla org-scoped hale getir (her biri ayrı migration olabilir).
10. 20+ fonksiyona `SET search_path = public` ekle (tek migration'a toplu).
11. Public bucket storage policy'lerini path-prefix'li daralt.
12. Supabase Auth leaked password protection'ı aktive et.
13. OSGB personel davet akışını yeni `/invite/[id]` pattern'ine geçir.
14. `BUSINESS_PERMISSION_MATRIX`'i tüm modüllerin kritik butonlarına uygula (şu an sadece InviteMemberPanel).

---

## 8. 📎 Dosya / Kod Referansları

### Migration drift (eksik)
- `supabase/migrations/20260419110000_mevzuat_versioned_retrieval_and_trace.sql`
- `supabase/migrations/20260419120000_workspace_system.sql`
- `supabase/migrations/20260419120100_seed_certifications.sql`
- `supabase/migrations/20260419120200_workspace_backfill.sql`
- `supabase/migrations/20260419123000_workspace_scope_solution_center.sql`
- `supabase/migrations/20260419130000_legal_corpus_scoping.sql`
- `supabase/migrations/20260419130000_ohs_archive_jobs.sql`
- `supabase/migrations/20260419130100_ohs_archive_scope_presets.sql`
- `supabase/migrations/20260419143000_nova_outbox_and_dlq.sql`
- `supabase/migrations/20260419180000_nova_governance_eval_and_rollouts.sql`
- `supabase/migrations/20260419213000_workspace_assignment_role_normalization.sql`

### Bozuk frontend (eksik tablolara bağımlı)
- `frontend/src/app/api/self-healing/nova-outbox/[id]/route.ts`
- `frontend/src/app/api/self-healing/queue/[id]/route.ts`
- `frontend/src/app/api/ohs-archive/create/route.ts`
- `frontend/src/app/api/ohs-archive/[id]/route.ts`
- `frontend/src/app/api/ohs-archive/[id]/download/route.ts`
- `frontend/src/lib/supabase/ohs-archive-api.ts`
- `frontend/src/lib/nova/governance.ts`
- `frontend/src/lib/self-healing/queue.ts`
- `frontend/src/lib/nova/action-endpoint.ts`
- `frontend/src/app/(protected)/settings/SelfHealingTab.tsx`
- `frontend/src/app/(protected)/osgb/documents/page.tsx`

### RLS mismatch kodu
- `frontend/src/components/companies/CompanyMembersList.tsx:126` (canManage hesaplaması)
- Prod: `company_memberships_update` policy → `is_company_approver(company_identity_id)`

### Orphan sayfalar
- `frontend/src/app/(protected)/analizler/page.tsx`
- `frontend/src/app/(protected)/visual-risk/page.tsx`
- `frontend/src/app/(protected)/closure-verification/page.tsx`
- `frontend/src/app/(protected)/health/page.tsx`
- `frontend/src/app/(protected)/health-docs/page.tsx`
- `frontend/src/app/(protected)/photo-findings/page.tsx`
- `frontend/src/app/(protected)/tasks/page.tsx`
- `frontend/src/app/(protected)/users/page.tsx`
- `frontend/src/app/(protected)/osgb/announcements/page.tsx`
- `frontend/src/app/(protected)/live-scan/page.tsx`
- `frontend/src/app/(protected)/documents/personal/page.tsx`
- `frontend/src/_parked/protected-pages/` (dizin)

---

## SON

Bu rapor **statik denetim** sonucudur. Gerçek prod'da hangi endpoint'lerin patladığı runtime logs ile doğrulanabilir (Vercel logs + Supabase error_logs tablosu). Özellikle **migration drift** en tehlikeli bulgudur — bu oturum bitmeden 10 migration'ı sıralı uygulamak ve doğrulamak önerilir.
