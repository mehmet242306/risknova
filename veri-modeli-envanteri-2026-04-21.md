# Veri Modeli Envanteri — Şirket Çalışma Alanı

**Tarih:** 2026-04-21  
**Kapsam:** risknova-platform, Supabase prod (getrisknova)  
**Amaç:** Kullanıcının 10 varlıklı hedef listesine karşı mevcut durumu çıkarmak.  
**Not:** Bu doküman sadece envanter — migration yazılmadı.

---

## 1. Yönetici Özeti

- **Prod'da 151 public tablo** var. Hepsinde RLS enabled.
- Çekirdek iskelet büyük ölçüde **zaten kurulu**: organizations, user_profiles, company_identities/workspaces, memberships, audit_logs.
- **41 KB'lık pending migration** (`20260419201500_account_model_authorization_transform`, henüz prod'da yok) senin 10'lu listenin önemli bir bölümünü **zaten hedefliyor** — özellikle membership, plan sınırları, workspace aktivitesi, arşiv RPC'leri.
- **Büyük eksikler:** Location/Yerleşke ve Department/Bölüm **first-class tablo olarak yok**. Standart `deleted_by` kolonu **hiçbir tabloda yok**. Standart arşiv kolonları tutarsız.
- **Sessiz sorunlar:** 45+ tabloda `organization_id` var ama **nullable** — RLS açıkları barındırabilir. 10 tabloda RLS açık ama **policy sayısı sıfır** (data erişilemez, çoğu kasıtlı AI tabloları).

---

## 2. 41 KB Pending Migration — İçerik Özeti

`supabase/migrations/20260419201500_account_model_authorization_transform.sql` (henüz prod'a uygulanmadı) şunları getiriyor:

**Hesap/kimlik modeli:**
- `organizations`'a `account_type` (individual/osgb/enterprise), `status`, `current_plan_id` kolonları
- Yeni tablo: `organization_memberships` (role: owner/admin/staff/viewer)
- Yeni tablo: `platform_admins` (super_admin/support_admin/...)
- Backfill: `user_profiles` → `organization_memberships`, `user_roles` → `platform_admins`
- Fonksiyonlar: `is_platform_admin()`, `is_account_owner_or_admin()`

**Abonelik/plan:**
- Yeni tablo: `plans` (5 plan seed'li: individual_free/pro, osgb_starter/team, enterprise)
- Yeni tablo: `organization_subscriptions`
- Fonksiyonlar: `current_plan_limits()`, `has_active_workspace_capacity()`, `has_active_staff_capacity()`

**Workspace (firma çalışma alanı):**
- `company_workspaces`'a `status` (active/archived), `archived_at`, `archived_by_user_id`, `created_by_user_id` kolonları
- RPC: `create_company_identity_with_workspace()` (ortak oluşturma)
- RPC: `archive_company_identity()`, `restore_archived_company_identity()`
- Yeni tablo: `workspace_assignments` (firma → uzman: isg_uzmani/isyeri_hekimi/diger_saglik/operasyon/viewer)
- Fonksiyonlar: `can_access_company_workspace()`, `can_manage_company_workspace()`

**OSGB portal şeması:**
- `workspace_tasks`, `workspace_task_assignments`, `workspace_announcements`

**Aktivite kaydı (senin istediğin tam da bu!):**
- Yeni tablo: `workspace_activity_logs` (organization_id, company_workspace_id, actor_user_id, event_type, event_payload)
- Trigger fonksiyonu: `log_workspace_activity()` — company_workspaces, workspace_assignments, risk_assessments'e otomatik log

**Diğer:**
- `enterprise_leads` (pre-sale)
- `risk_assessments.company_workspace_id` eklenmesi

---

## 3. 10 Varlık Listeniz → Gerçek Durum Matrisi

| Senin varlığın | Mevcut karşılık | Durum | Eksik ne? |
|---|---|---|---|
| 1. Company / Organization | `organizations` + `company_identities` | ✅ Var, ikili model | `organizations`=müşteri hesabı, `company_identities`=OSGB'nin müşteri firmaları (farklı kavram) |
| 2. Workspace | `company_workspaces` | ✅ Var (41 KB sonrası tam olgun) | Nitelikli "multi-tenant workspace" için yeterli |
| 3. Location / Yerleşke / Bina / Saha | **YOK** | ❌ Eksik | `company_workspaces` içinde address/city/district alanları var ama **first-class `locations` tablosu yok**. Bir firmanın 5 şubesi varsa modellenemiyor. |
| 4. Department / Bölüm | **YOK** | ❌ Eksik | `team_categories` + `team_members` var ama bunlar "ekip" (örn. acil durum ekibi), bölüm değil. Bir fabrikanın "Üretim/Bakım/İK" ayrımı yok. |
| 5. Team / Ekip | `team_categories` + `team_members` | ✅ Var | `team_members` NOT NULL org_id ile bağlı |
| 6. Members / Kullanıcılar | `user_profiles` + `company_memberships` + (41KB) `organization_memberships` | ⚠️ 3 paralel model | `user_profiles` = temel kullanıcı, `company_memberships` = firma (müşteri) üyeliği, `organization_memberships` = hesap (customer account) üyeliği. **İkisinin rolü belirsiz gözükecek** |
| 7. Roles / Yetkiler | `roles` + `user_roles` + `permissions` + `role_permissions` + (41KB) `platform_admins`, `organization_memberships.role`, `workspace_assignments.professional_role` | ⚠️ 5 paralel yapı | Sistem rolleri + organizasyon rolleri + profesyonel roller + platform admin. Kararlı ama karmaşık. |
| 8. Documents / Kayıtlar | `company_documents`, `company_document_versions`, `editor_documents`, `editor_document_versions`, `admin_documents`, `document_templates`, `document_signatures`, `consent_documents`, `legal_documents`, `mevzuat_documents`, `solution_documents`, `personnel_documents`, `slide_decks`, ... | ✅ Çok parçalı var | 12+ belge tablosu, amaç bazlı ayrım. Tutarsız `org_id` kullanımı (bazıları NOT NULL, bazıları yok) |
| 9. Activity Log / Audit | `audit_logs` + (41KB) `workspace_activity_logs` | ⚠️ İki sistem | `audit_logs` = genel audit (kullanıcı, güvenlik), `workspace_activity_logs` = trigger tabanlı iş olayları. Birbiriyle kesişiyor mu, nereden ne yazılıyor net değil. |
| 10. Archive / Trash | **Çok tutarsız** | ❌ Standart yok | `is_archived`: 4 tabloda var. `archived_at`: 3 tabloda. `deleted_at`: ~100 tabloda. `deleted_by`: **0 tabloda**. |

---

## 4. Standardizasyon Durumu

### 4.1 `organization_id` Kapsamı

Sayım (151 public tablodan):
- **NOT NULL org_id:** 34 tablo (✅ ideal)
  - audit_logs, company_committee_meetings, company_document_versions, company_documents, company_memberships, company_periodic_controls, company_trainings, company_workspaces, corrective_action_updates, corrective_actions, editor_documents, incident_dof, incident_ishikawa, incidents, notifications, nova_workspaces, personnel, personnel_documents, personnel_health_exams, personnel_ppe_records, personnel_special_policies, personnel_trainings, question_bank, risk_assessment_findings, risk_assessment_images, risk_assessment_items, risk_assessment_rows, risk_assessments, slide_media_assets, team_members, timesheets, user_profiles, yearly_training_plans, yearly_work_plans
- **Nullable org_id:** 45 tablo (⚠️ karar gerektirir — business table mi, kurum-dışı mı?)
  - Örnek problem adayları: `slide_decks`, `slide_deck_sessions`, `isg_tasks`, `isg_task_categories`, `surveys`, `risk_categories`, `team_categories`, `certificates`, `certificate_templates`, `nova_workflow_runs`, `scan_sessions`, `digital_twin_models`
- **Yok:** 72 tablo
  - Çoğu **kasıtlı**: `legal_documents`, `mevzuat_*`, `permissions`, `roles`, `role_permissions`, `plans` (ileride), `subscription_plans`, `ai_knowledge_base`, vb. → sistem seviyesi global veri
  - Ama **şüpheli olanlar**: `company_identities` (FK `owner_organization_id` var ama ismi farklı — sorgu `organization_id` aradı), `company_personnel`, `company_invitations`, `company_join_requests`, `workspace_invitations`, `workspace_members`, `user_roles`, `slides` — bunlar business tablo, direkt ya da dolaylı org_id olması lazım

### 4.2 Arşiv / Soft-Delete Kolonları

| Kolon | Hangi tablolarda | Durum |
|---|---|---|
| `is_archived` | company_identities, company_workspaces, slide_decks, ai_learning_archive | 4 tablo — **tutarsız** |
| `archived_at` | company_identities, slide_decks, ai_learning_archive (41 KB → company_workspaces'a ekleyecek) | 3+1 tablo — **tutarsız** |
| `archived_by_user_id` | company_identities (zaten var), (41 KB → company_workspaces'a ekleyecek) | 1+1 tablo — **tutarsız** |
| `deleted_at` | ~100 tablo | Yaygın ama **sadece timestamp** |
| `deleted_by` | **0 tablo** | ❌ **Hiçbir yerde yok** |

### 4.3 RLS Kapsamı

- Tüm 151 tablonun hepsinde `relrowsecurity = true` — ✅ RLS açık
- **10 tabloda policy yok** (Advisor da INFO seviyesinde işaret ediyor): `ai_daily_summary`, `ai_external_data`, `ai_learned_patterns`, `ai_learning_sessions`, `ai_model_versions`, `ai_search_queries`, `ai_training_data`, `ai_training_logs`, `ai_user_interactions` — hepsi AI tabloları, veri kilitli (muhtemelen sadece service_role erişimli; güvenli ama dokümante edilmeli)
- En çok policy'li olanlar: risk_assessments (10), personnel_documents/health_exams/ppe/special/trainings (8 her biri), solution_queries (8), user_preferences (7)

### 4.4 Aktivite / Audit Kapsamı

- `audit_logs` var ve NOT NULL `organization_id` — ✅ iyi
- Ama **hangi business mutasyonu bu tabloya yazıyor** belirsiz. Trigger bazlı mı, kod içinden mi? Kapsam gerçekten sistem çapında mı yoksa sadece KVKK/security olayları mı?
- 41 KB migration `workspace_activity_logs` ekliyor + trigger → bu **yapısal olarak farklı bir sistem** (sadece workspace olayları, event-sourced JSON payload). İki tablo konumlandırması netleştirilmeli.

---

## 5. Kritik Gözlemler

1. **Location/Yerleşke eksikliği, şu an düşündüğümüzden büyük.** OSGB müşterisi "fabrikanın 3 şubesi var, her birinde ayrı risk analizi" dediğinde modellenemiyor. Bunu eklemek → `locations` tablosu + `risk_assessments.location_id`, `incidents.location_id`, `personnel.location_id` gibi dokunuş gerektirir. Küçük iş değil.

2. **Department/Bölüm eksikliği.** OSGB değil ama enterprise müşteri "Üretim bölümünde 3 kaza" gibi ayrım yapamaz. Eklemek → `departments` tablosu + `personnel.department_id`, `incidents.department_id`. `team_categories`'den farklı: bir kullanıcı birden fazla team'e ait olabilir ama genelde tek department'ta.

3. **`deleted_by` standardının yokluğu GDPR/audit açısından ciddi eksik.** "Bu kaydı kim sildi" cevabı ~100 tabloda verilemiyor.

4. **İki aktivite log tablosu (`audit_logs` + `workspace_activity_logs`) riski.** 41 KB migration uygulandığında event logging iki yerden birden çıkacak. Rol ayrımı yapılmalı: `audit_logs` = user/security/compliance olayları, `workspace_activity_logs` = iş akışı olayları.

5. **Nullable `organization_id` olan 45 tabloda sessiz RLS sızıntıları olabilir.** Her tablonun policy'sine bakıp scope doğrulamak ayrı bir iş.

6. **`user_roles` tablosu org_id'siz.** user_roles → user_profiles (org_id var) üzerinden dolaylı scope. Sorun değil ama direkt bir kolon olsa query'ler basitleşirdi. 41 KB migration bunu `organization_memberships.role` ile paralel hale getiriyor — migration sonrası "hangisi doğru" kararı gerekli.

7. **`company_identities`, `company_personnel`, `company_invitations` sorguda org_id'siz göründü.** Aslında `owner_organization_id` gibi farklı isimle FK'ları var. İsim standardı yok. Düzeltmek için ya rename ya da sorgu kurallarını güncelle.

---

## 6. Önerilen Sonraki Adım

**Değerlendirme:** Senin 10'lu listendeki işin **~%60'ı zaten var veya 41 KB migration içinde geliyor.** Asıl eksikler:

**A) Şema eksikleri (yeni tablolar gerekiyor):**
- `locations` (yerleşke/bina/saha)
- `departments` (bölüm)
- (Opsiyonel) `archive_trash` pattern için standart kolon seti

**B) Standartlaştırma (mevcut tablolarda):**
- `deleted_by` kolonu business tablolara
- `is_archived` + `archived_at` + `archived_by_user_id` standart seti business tablolara
- Nullable `organization_id`'lerin kararı: NOT NULL yapılacak mı, yok mu olacak mı

**C) Temizlik:**
- `audit_logs` vs `workspace_activity_logs` rol ayrımı dokümante
- 45 nullable-org-id tabloya tek tek kapsam bakışı

**Önerilen sıralama (sonraki oturumlar):**

1. **Önce 41 KB pending migration'ı prod'a uygula** (zaten commit edilmiş, yerel). Bundan sonra gerçek durum netleşir.
2. Sonra **locations + departments tablolarını ayrı migration olarak ekle** (FK'ları hangi tablolara bağlanacak + RLS policy seti).
3. Sonra **standart archive/trash set'i** tek bir migration'da tüm business tablolara uygula (`is_archived`, `archived_at`, `archived_by_user_id`, `deleted_by`).
4. Sonra **nullable org_id temizliği** kapsamlı bir migration ile.

Her adım 1-2 migration, kontrol edilebilir. Büyük patlama değil, evrimsel.

---

## 7. Ham Veri — Ek

Prod tablo sayısı : 151 (public schema)  
RLS enabled       : 151 / 151  
NOT NULL org_id   : 34  
Nullable org_id   : 45  
Yok / farklı isim : 72  
`is_archived` var : 4  
`deleted_at` var  : ~100  
`deleted_by` var  : 0

İlgili dosyalar:
- Pending migration: `supabase/migrations/20260419201500_account_model_authorization_transform.sql`
- Çekirdek RLS foundation: `supabase/migrations/20260312004009_rls_foundation_policies.sql`
- Company workspace metadata: `supabase/migrations/20260322_003_company_workspace_metadata_and_personnel.sql`
- Invitation permissions: `supabase/migrations/20260329031034_invitation_permission_system.sql`

---

## SON

Envanter tamam. Şu ana kadar kod yazılmadı; bu doküman sadece mevcut durumu gösteriyor. Tasarım/uygulama adımına geçmeden önce öncelik ve kapsam konusunda senin onayın gerekli.
