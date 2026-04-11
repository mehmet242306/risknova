# Database Hardening Plan

**Belge durumu:** DRAFT — karar bekleniyor, henüz hiçbir migration uygulanmadı
**Hazırlayan:** Claude Code (Opus 4.6)
**Tarih:** 2026-04-10
**Supabase projesi:** `guvenligimcepte-dev` (xbnvedbagfmkrvicvoam) — Postgres 17.6
**Hedef:** RiskNova veritabanını endüstri-standardı SaaS seviyesine çıkarmak (multi-tenant güvenlik, audit, soft delete, veri bütünlüğü, performans, backup).

---

## 1. Mevcut Durum Özeti

### 1.1 Ölçek
- **114 public tablo**, hepsinde RLS **aktif** ✅
- **273 RLS policy** tanımlı
- **48 trigger**, **228 fonksiyon**
- Toplam veri hacmi küçük: en büyük tablo `legal_chunks` (13 MB, ~2.347 satır). Plan hacim baskısı olmadan **şimdi** yapılmalı.

### 1.2 Eksik Tablosu (Raporlama Sonucu)

| Eksik | Durum | Etki |
|---|---|---|
| `FORCE ROW LEVEL SECURITY` | 0/114 tablo | Tablo sahibi RLS'i bypass edebilir |
| Tek & genel `set_updated_at()` trigger fonksiyonu | Yok — her tabloda farklı `set_xxx_updated_at` | 38 tabloda tetikleyici var, 76'sında yok veya isim tutarsız |
| `created_by` / `updated_by` standardı | 0/114 | "Kim ekledi / kim güncelledi" izlenemez |
| `deleted_at` (soft delete) | 2/114 (`company_identities`, `slide_decks`) | Yanlış silinen veri kurtarılamaz |
| `version` (optimistic lock) | 2/114 (`editor_documents`, `editor_document_versions`) | Aynı anda güncelleme çakışmaları sessiz kaybediliyor |
| `organization_id` eksik | 67/114 tablo (bkz. §2.3) | Kritiklerinde cross-tenant sızıntı riski |
| Genel `audit_trigger_func()` | Yok | Her tablo için ayrı ayrı yazmak gerekecek |
| audit_logs genişletilmiş şema | Yok (11 kolon) | `old_values`, `new_values`, `changed_fields`, `request_id`, `session_id`, `source`, `user_email_snapshot` eksik |
| audit_logs immutability | Yok | UPDATE/DELETE reddi yok, log manipüle edilebilir |

### 1.3 `audit_logs` Mevcut Durumu

```
Satır sayısı: 50
Disk boyutu: 128 kB
```

Mevcut kolonlar:

| Kolon | Tip | Null? |
|---|---|---|
| id | uuid | NO |
| organization_id | uuid | NO |
| actor_user_profile_id | uuid | YES |
| action_type | text | NO |
| entity_type | text | NO |
| entity_id | text | YES |
| severity | text | NO |
| metadata_json | jsonb | NO |
| ip_address | text | YES |
| user_agent | text | YES |
| created_at | timestamptz | NO |

**Eksik kolonlar** (Adım 1'de ADD COLUMN ile gelecek):
`old_values jsonb`, `new_values jsonb`, `changed_fields text[]`, `request_id uuid`, `session_id uuid`, `source text`, `user_email_snapshot text`.

> `ip_address` şu an `text` — `inet` tipi daha doğru olurdu, ancak mevcut 50 satırı dönüştürmek non-breaking olmayabilir. Karar §11'de.

### 1.4 En Çok Yazılan Top 10 Tablo (Trigger Performans Etkisi İçin)

| # | Tablo | inserts | updates | deletes | total writes | live rows |
|---|---|---|---|---|---|---|
| 1 | legal_chunks | 3.325 | 2.232 | 978 | **6.535** | 2.347 |
| 2 | risk_assessment_rows | 412 | 0 | 0 | 412 | 412 |
| 3 | risk_assessment_images | 379 | 0 | 0 | 379 | 379 |
| 4 | legal_documents | 60 | 143 | 17 | 220 | 43 |
| 5 | slides | 112 | 2 | 29 | 143 | 83 |
| 6 | slide_decks | 12 | 120 | 3 | 135 | 9 |
| 7 | personnel | 123 | 2 | 0 | 125 | 105 |
| 8 | user_sessions | 1 | 94 | 0 | 95 | 1 |
| 9 | company_workspaces | 19 | 33 | 0 | 52 | 19 |
| 10 | audit_logs | 50 | 0 | 0 | 50 | 50 |

**Not:** `legal_chunks` yoğun yazılıyor ancak pure referans tablosu (global mevzuat). Audit trigger'ını buraya **bağlamayalım** — performans düşürür, anlamlı audit değeri yok.

### 1.5 En Çok Okunan Top 10 Tablo (Read Performans İçin)

| # | Tablo | seq_scan | idx_scan | total reads |
|---|---|---|---|---|
| 1 | legal_chunks | 591 | 5.595 | 445.787 |
| 2 | company_memberships | 17.204 | 50 | 151.533 |
| 3 | notifications | 5 | 13.316 | 115.218 |
| 4 | user_profiles | 10 | 44.275 | 44.251 |
| 5 | company_workspaces | 1.590 | 765 | 31.415 |
| 6 | company_identities | 122 | 23.971 | 26.030 |
| 7 | personnel | 215 | 674 | 20.817 |
| 8 | legal_documents | 219 | 4.659 | 15.578 |
| 9 | risk_assessments | 1.337 | 153 | 12.430 |
| 10 | risk_assessment_findings | 147 | 249 | 5.840 |

**Kritik gözlem:** `company_memberships` tablosunda **17.204 seq_scan vs 50 idx_scan** — yetki kontrolü her istekte sequential scan yapıyor. Adım 3'te indeks eklenmeli. Aynı şekilde `company_workspaces` (1.590 seq) ve `risk_assessments` (1.337 seq).

### 1.6 Mevcut Trigger'lar (Özet)

38 tabloda trigger mevcut. Çoğu `set_xxx_updated_at (UPDATE)` formunda — ama **7 farklı isim konvansiyonu** kullanılıyor (`set_updated_at`, `set_cd_updated_at`, `trg_xxx_updated_at`, `set_xxx_updated_at`…). Tek genel fonksiyona göç Adım 1'de.

76 tabloda hiç updated_at trigger'ı yok — bunlar ya tabloya hiç UPDATE atılmıyor (ör. log tabloları) ya da `updated_at` manuel set ediliyor (kırılgan).

---

## 2. Hedef Durum

### 2.1 Standart Kolon Seti (Her Tabloda)

```sql
id               uuid         PRIMARY KEY DEFAULT gen_random_uuid()
created_at       timestamptz  NOT NULL DEFAULT now()
updated_at       timestamptz  NOT NULL DEFAULT now()
created_by       uuid         NULL REFERENCES auth.users(id) ON DELETE SET NULL
updated_by       uuid         NULL REFERENCES auth.users(id) ON DELETE SET NULL
deleted_at       timestamptz  NULL
deleted_by       uuid         NULL REFERENCES auth.users(id) ON DELETE SET NULL
deletion_reason  text         NULL
version          integer      NOT NULL DEFAULT 1
organization_id  uuid         NULL  -- tenant tablosuna göre NOT NULL veya NULL
```

### 2.2 Standart Trigger Seti (Her Tabloda)

| Trigger | Zaman | Fonksiyon | Ne yapar |
|---|---|---|---|
| `tg_set_updated_fields` | BEFORE UPDATE | `_audit.set_updated_fields()` | `updated_at=now()`, `updated_by=auth.uid()`, `version=version+1` |
| `tg_set_created_fields` | BEFORE INSERT | `_audit.set_created_fields()` | `created_at=now()`, `created_by=auth.uid()` |
| `tg_audit_changes` | AFTER INSERT/UPDATE/DELETE | `_audit.audit_trigger_func()` | audit_logs'a kayıt yazar (hassas kolonları maskeleyerek) |
| `tg_soft_delete_guard` | BEFORE DELETE | `_audit.soft_delete_guard()` | Kritik tablolarda RAISE EXCEPTION — gerçek DELETE'i engelle, `deleted_at` SET eden fonksiyon kullanılmasını zorla |

### 2.3 Standart RLS Policy Şablonu

Her tablo için dört policy:

```sql
-- SELECT: tenant eşleşmeli, soft-deleted görünmesin
CREATE POLICY "<table>_select" ON <table> FOR SELECT
  USING (
    organization_id = (SELECT user_profiles.organization_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- INSERT: tenant eşleşmeli
CREATE POLICY "<table>_insert" ON <table> FOR INSERT
  WITH CHECK (
    organization_id = (SELECT user_profiles.organization_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- UPDATE: tenant eşleşmeli, hem USING hem WITH CHECK
CREATE POLICY "<table>_update" ON <table> FOR UPDATE
  USING (
    organization_id = (SELECT user_profiles.organization_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = (SELECT user_profiles.organization_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- DELETE: genelde reddedilir; soft delete için UPDATE policy yeterli
CREATE POLICY "<table>_delete" ON <table> FOR DELETE
  USING (false);
```

> **JWT claim alternatifi:** Supabase Auth Hook ile `organization_id`'yi JWT'ye ekleyip `auth.jwt() ->> 'organization_id'` ile okumak daha hızlı (JOIN yok). Bu **Adım 4** olarak ayrılacak.

### 2.4 audit_logs Hedef Şeması

Mevcut 11 kolon + eklenecek 7 kolon = 18 kolon. Immutability: `FOR UPDATE USING(false)`, `FOR DELETE USING(false)`.

### 2.5 Soft Delete Stratejisi

- `deleted_at IS NULL` partial unique index'ler: `CREATE UNIQUE INDEX ... ON x (org, code) WHERE deleted_at IS NULL;`
- `table_name_active` view'ları: tüm SELECT'lerde kullanılacak
- `restore_entity(tbl, id)` fonksiyonu: audit'e yazarak geri alır
- `hard_delete_after_30_days` cron: KVKK uyumu için scheduled_deletions üzerinden

---

## 3. Aşamalı Uygulama Planı

Sıralamada **önce non-breaking**, sonra pilot, sonra batch. Her adım ayrı migration dosyası, her biri **incremental** (önceki adıma bağımlı).

### ADIM 1 — Non-Breaking Altyapı (Side-Effect Free)

**Dosya adayı:** `supabase/migrations/YYYYMMDDHHMMSS_db_hardening_01_infra.sql`

**İçerik:**
1. `CREATE SCHEMA IF NOT EXISTS _audit;`
2. `_audit.sensitive_columns` metadata tablosu: `(table_name, column_name)` — hangi kolonlar audit log'a maskelenerek gidecek
3. `_audit.set_updated_fields()` trigger fonksiyonu (henüz hiçbir tabloya bağlı değil)
4. `_audit.set_created_fields()` trigger fonksiyonu
5. `_audit.audit_trigger_func()` — `TG_TABLE_NAME`, `TG_OP`, `OLD`, `NEW` ile çalışan genel fonksiyon; hassas kolonları `_audit.sensitive_columns`'dan okur ve `[REDACTED]` yazar; `old_values`, `new_values`, `changed_fields` doldurur
6. `public.audit_logs` ALTER TABLE — yeni kolonlar:
   - `old_values jsonb NULL`
   - `new_values jsonb NULL`
   - `changed_fields text[] NULL`
   - `request_id uuid NULL`
   - `session_id uuid NULL`
   - `source text NULL DEFAULT 'system'`
   - `user_email_snapshot text NULL`
7. `public.audit_logs` için immutability policy: UPDATE `USING (false)`, DELETE `USING (false)`
8. `public.audit_logs` ALTER TABLE ... `FORCE ROW LEVEL SECURITY` — ilk FORCE RLS uygulaması, en güvenli tablo
9. `public.log_audit_event(...)` helper fonksiyonu (Edge Function'lar için)
10. `public.restore_entity(table_name text, entity_id uuid)` helper
11. `_audit.audit_tenant_isolation()` denetim fonksiyonu — **sadece okur, değiştirmez** — eksik RLS / eksik tenant kolonu / eksik policy'leri listeler
12. Index'ler: audit_logs üzerinde `(entity_type, entity_id)`, `(created_at DESC)`, `(actor_user_profile_id)`, `(organization_id, created_at DESC)`

**Etki:**
- Hiçbir mevcut sorgu etkilenmez (ADD COLUMN nullable, yeni fonksiyonlar, yeni şema)
- Uygulama kodu değişmez
- `audit_logs` yeni kolonları NULL olarak eklenir — mevcut 50 satır olduğu gibi kalır
- audit_logs immutability: şu an sadece `INSERT` yapılıyor (50 satır, 0 update, 0 delete) — hiçbir şeyi kırmaz

**Geri alma:**
```sql
ALTER TABLE public.audit_logs DROP COLUMN old_values, DROP COLUMN new_values, ...;
DROP SCHEMA _audit CASCADE;
DROP POLICY "audit_logs_no_update" ON public.audit_logs;
DROP POLICY "audit_logs_no_delete" ON public.audit_logs;
ALTER TABLE public.audit_logs NO FORCE ROW LEVEL SECURITY;
```

**Test yöntemi:**
1. Migration sonrası `SELECT count(*) FROM public.audit_logs;` → 50 (bozulmadı)
2. `INSERT INTO public.audit_logs (...) VALUES (...);` → çalışmalı
3. `UPDATE public.audit_logs SET severity='info' WHERE id = ...;` → 0 satır etkilenmeli (policy engel)
4. `SELECT * FROM _audit.audit_tenant_isolation();` → eksiklikler listelensin (bu zaten bildiğimiz liste)
5. `npm run build` (frontend) → hata olmamalı
6. Mevcut risk_assessment oluşturma akışını dashboard'dan test et

**Tahmini süre:** 2-3 saat (migration yazma 1s + staging test 1s + review 0.5s)

---

### ADIM 2 — Pilot Tablo: Tam Uygulama

**Dosya adayı:** `supabase/migrations/YYYYMMDDHHMMSS_db_hardening_02_pilot_<table>.sql`

**Pilot tablo seçimi:** bkz. §4.

**İçerik (pilot tabloya):**
1. `ALTER TABLE` — eksik standart kolonları ekle (`created_by`, `updated_by`, `deleted_at`, `deleted_by`, `deletion_reason`, `version` — eğer yoksa)
2. Mevcut `trg_<table>_set_updated_at` trigger'ını DROP et, `tg_set_updated_fields` bağla (`_audit.set_updated_fields()`)
3. `tg_set_created_fields` INSERT trigger'ı ekle
4. `tg_audit_changes` trigger'ı ekle (`_audit.audit_trigger_func()`)
5. RLS policy'lerini gözden geçir — `deleted_at IS NULL` ekle
6. `<table>_active` view'u oluştur
7. Partial unique index'ler (varsa) — `WHERE deleted_at IS NULL`
8. `_audit.sensitive_columns` tablosuna (eğer varsa) pilot tablonun hassas kolonları eklensin

**Breaking change değerlendirmesi (pilot için):**
- `version` kolonu eklenir → Eğer frontend mevcut UPDATE'lerde `version` göndermezse trigger yine de artırır (sorun yok)
- Ancak **optimistic locking aktif etmek** için frontend'in `WHERE id=? AND version=?` göndermesi gerekir. Bu Adım 2'de **optional** bırakılacak; frontend değişikliği Adım 2b olarak sonra.

**Etki:**
- Pilot tablo dışında kimse etkilenmez
- Pilot tabloya yazan frontend kodu çalışmaya devam eder (tüm yeni kolonlar nullable veya default'lu)
- Audit log'lar pilot tablodan gelen her INSERT/UPDATE/DELETE için yazılmaya başlar

**Geri alma:**
- Migration'ın down script'i ile tüm trigger'lar kaldırılır, kolonlar drop edilir, view silinir
- audit_logs'ta oluşan yeni kayıtlar manuel temizlenebilir (opsiyonel)

**Test yöntemi (kabul kriterleri):**
1. Pilot tabloya frontend'den yeni kayıt ekle → `created_by` dolu, `version=1`, audit_logs'ta 1 yeni satır
2. Aynı kaydı güncelle → `updated_by` set, `version=2`, audit_logs'ta `old_values`/`new_values`/`changed_fields` dolu satır
3. Soft delete et (`deleted_at=now()`) → SELECT'lerde artık görünmez, audit'e düşer
4. `restore_entity(...)` ile geri al → tekrar görünür, audit'e düşer
5. İki farklı tenant kullanıcısıyla cross-tenant test → sızıntı yok
6. Frontend E2E: pilot tabloyu kullanan tüm sayfalar sorunsuz çalışsın

**Başarı kriteri:** Yukarıdaki 6 test PASS + 48 saat gözlem boyunca hata/yavaşlama yok.

**Tahmini süre:** 3-4 saat migration + 1 gün gözlem

---

### ADIM 3 — Tenant İzolasyon Denetimi + Batch Rollout

**Önce:** `SELECT * FROM _audit.audit_tenant_isolation();` çıktısına göre tablolar üç gruba ayrılır:

**Grup 1 — tenant-core (5-6 tablo):**
`organizations`, `user_profiles`, `roles`, `user_roles`, `company_identities`, `company_workspaces`, `company_memberships`
→ En yüksek öncelik, en büyük izolasyon riski

**Grup 2 — operational (15-20 tablo):**
`risk_assessments`, `risk_assessment_rows`, `risk_assessment_findings`, `risk_assessment_items`, `risk_assessment_images`, `incidents`, `incident_dof`, `incident_ishikawa`, `incident_personnel`, `incident_witnesses`, `personnel`, `personnel_*`, `slide_decks`, `slides`, `editor_documents`, `company_documents`, `isg_tasks`, `timesheets`

**Grup 3 — supporting (kalan ~70 tablo):**
`ai_*`, `legal_*`, `mevzuat_*`, `scan_*`, `slide_*` revizyon tabloları, `agent_*`, `notifications`, `audit_logs` zaten Adım 1'de, vs.

**Grup 4 — tenant-free (referans tabloları, 20-25 tablo):**
Global okunur, tenant kolonu gerekmez: `mevzuat_document_types`, `mevzuat_topics`, `legal_sources`, `ai_model_versions`, `subscription_plans`, `risk_clusters` (?), `roles` (?)
→ Bu tabloları hedef şemadan **muaf** tutarız, ama audit trigger **vardır**

**Her grup için migration**:
- Grup 1: `YYYYMMDDHHMMSS_db_hardening_03a_group1_tenant_core.sql`
- Grup 2: `YYYYMMDDHHMMSS_db_hardening_03b_group2_operational.sql`
- Grup 3: `YYYYMMDDHHMMSS_db_hardening_03c_group3_supporting.sql`

Her biri pilot şablonunun aynısı, birden fazla tabloya uygulanmış hali.

**Paralel iş — Adım 3 sırasında:**
- Eksik indeksler (özellikle `company_memberships` seq_scan sorunu)
- Check constraint'ler (enum'lar, tarih mantığı, skorlar)
- Foreign key ON DELETE stratejisi gözden geçirme

**Tahmini süre:**
- Grup 1: 1 gün (pilot'tan öğrenilenler + tenant-core hassasiyeti)
- Grup 2: 1-2 gün
- Grup 3: 1-2 gün (çoğu batch script)
- Toplam: **4-6 gün**

---

## 4. Pilot Tablo Seçimi — Gerekçe

### Adaylar ve Değerlendirme

| Tablo | live rows | total writes | frontend refs | version kolonu? | updated_at? | Uygunluk |
|---|---|---|---|---|---|---|
| `risk_assessments` | 15 | düşük | 14 referans (risk-assessment-api.ts) | Yok | Var | 🟡 Orta — uygulama kodu ağır |
| `risk_assessment_rows` | 412 | 412 | 14 ref | Yok | Var | 🟡 Orta — ağır yazılıyor |
| `editor_documents` | 1 | düşük | 3 ref | **Var** ✅ | Var | 🟢 **İyi** — version zaten var, optimistic lock test edilebilir |
| `team_categories` | 14 | 35 | düşük | Yok | Var | 🟢 **Çok iyi** — izole, az trafik, uygulama bağımlılığı düşük |
| `isg_tasks` | düşük | düşük | 1 ref | Yok | Var | 🟢 İyi |
| `personnel` | 105 | 125 | 12 ref | Yok | Var | 🔴 Kötü — yüksek uygulama bağımlılığı |

### Öneri: İki aşamalı pilot

**Pilot A (dry run):** `team_categories`
- Neden: 14 satır, minimal frontend bağımlılığı (sadece ayar sayfası), zaten `trg_team_categories_updated_at` var
- Amaç: Adım 1 altyapısının *gerçekten* çalıştığını göstermek, kimse fark etmeden. Eğer batarsa kimse etkilenmez.

**Pilot B (gerçek pilot):** `risk_assessment_findings`
- Neden:
  - 16 satır (hâlâ küçük), 32 write
  - Operational — gerçek business entity
  - Risk analizi akışında kritik, ama `risk_assessments`'tan daha az frontend bağımlılığı
  - Zaten `trg_risk_assessment_findings_set_updated_at` trigger'ı var — migrate etmek için iyi örnek
- Amaç: Gerçek kullanıcı trafiği altında audit log'ların dolduğunu, cross-tenant izolasyonun çalıştığını, performansın düşmediğini doğrulamak

### Pilot Bağımlılığı — Super Admin Mekanizması

Pilot tablonun RLS policy'lerini yazarken `is_super_admin()` fonksiyonunu kullanmak istiyoruz:
```sql
USING (organization_id = public.current_user_organization_id() OR public.is_super_admin())
```

Bu fonksiyon **Adım 0.5'te kurulur** ve Adım 2 (pilot) bunun üzerine yazar. Yani **Adım 0.5 olmadan pilot tablo RLS'i doğru yazılamaz** (ya eski yaklaşım kullanılır ve sonra yeniden yazılır, ya da beklenir). Bu bağımlılık zaten yeni sıra (0.5 → 0.7 → 1 → 2) ile çözüldü.

### Pilot Başarı Kriterleri
1. Migration uygulandıktan sonra mevcut frontend kodu **hiç değişmeden** çalışmalı
2. Tablodaki her INSERT/UPDATE/DELETE audit_logs'a düşmeli
3. `old_values`, `new_values`, `changed_fields` doğru dolmalı
4. İki tenant arası hiçbir sızıntı olmamalı (SQL test)
5. INSERT/UPDATE latency %20'den az artmalı
6. 48 saat gözlem — hata yok, yavaşlama yok
7. Soft delete + restore çalışmalı
8. Rollback script'i test edildi ve çalışıyor

---

## 5. Risk Matrisi

| # | Değişiklik | Olasılık | Etki | Bozma Senaryosu | Önlem |
|---|---|---|---|---|---|
| R1 | `FORCE RLS` aktif | Orta | **Yüksek** | Service role kullanmayan admin sayfaları erişim kaybı; bazı RPC'ler çalışmaz | Sadece `audit_logs`'tan başla, gruplar halinde yay; her tabloda önce staging'de 24s test |
| R2 | Genel audit trigger tüm tablolarda | Düşük | **Orta** | Yüksek trafikli tablolarda (legal_chunks) latency artışı | `legal_chunks`, `legal_documents`, `ai_*` gibi referans tabloları audit'ten muaf tut |
| R3 | Soft delete: tabloya `deleted_at IS NULL` eklenmesi | Orta | **Yüksek** | Eski sorgular silinmiş kayıtları de-facto görmeye devam edebilir, "where deleted_at is null" eklenmemiş yerler | RLS policy'sine `deleted_at IS NULL` koy → policy seviyesinde enforce; view + grep denetimi |
| R4 | `version` kolonu + opsiyonel optimistic lock | Düşük | **Düşük** (aktif etmezsek) | Kapalıyken hiçbir etki yok | Pilot'ta aktif etmeyip sadece trigger'ın version'u artırdığını doğrula |
| R5 | `organization_id` eksik tablolara NOT NULL ekleme | **Yüksek** | **Yüksek** | Mevcut satırlar var, NOT NULL alamaz; backfill gerek; frontend'in org_id set etmediği INSERT'ler patlar | **Aşamalı**: önce NULL ekle, backfill, sonra NOT NULL; frontend INSERT'lerde org_id doldurduğu doğrulansın |
| R6 | audit_logs immutability | Düşük | Düşük | Mevcut admin ekranından log silme fonksiyonu varsa patlar | grep ile `.from('audit_logs').delete` ara — 0 sonuç bulundu ✅ |
| R7 | `created_by`/`updated_by` NOT NULL | **Yüksek** | **Yüksek** | Sistem işlemleri (cron, trigger, migration) auth.uid() dönemez → INSERT patlar | **NULL tut**, enforce etme; sadece normal kullanıcı işlemleri için dolu olsun |
| R8 | Trigger zinciri sonsuz döngü | Düşük | Yüksek | `audit_logs`'a audit trigger bağlamak → kendi kendini tetikler | `audit_logs` tablosuna audit trigger **bağlanmaz** (meta-audit ayrı bir policy ile) |
| R9 | Genel trigger fonksiyonu yüksek-trafikli tabloda kilitlenme | Düşük | Orta | SECURITY DEFINER ile yazılmazsa RLS döngüleri | Fonksiyon `SECURITY DEFINER` + `SET search_path = public, _audit` |
| R10 | `ip_address` tip değişimi `text → inet` | Düşük | Düşük | Mevcut 50 satırdaki invalid değer dönüşmez | **Şimdilik yapma**, yeni kolon `ip_address_inet` ekle, migration ile doldur, sonra rename |
| **R11** | **Fail-open admin kontrolü** (§12.4) | **Zaten var (kritik)** | **Kritik** | Mevcut frontend `settings/page.tsx` fail-open → herkes admin; `admin-ai` API route'ları service_role + auth kontrolü yok → anonim RLS bypass | **Adım 0.5 ile mitigasyon**: Frontend fail-closed + backend auth guard + `is_super_admin()` DB fonksiyonu + Mehmet hesabına super_admin atama. Adım 1'den önce uygulanmalı, pilot müşteri öncesi mutlaka kapanmalı |

---

## 6. Breaking Change Listesi

### Kod Değişikliği **Gerektirmeyen** (Non-Breaking)
- Adım 1'in tamamı (altyapı, fonksiyonlar, audit_logs ADD COLUMN)
- Pilot tablolarda: audit trigger bağlanması, soft delete kolonu eklenmesi (nullable), `set_updated_fields` trigger'ı
- RLS policy'ye `deleted_at IS NULL` eklenmesi — frontend şu an soft-deleted kayıt beklemiyor
- Genel trigger fonksiyonuna geçiş (eski trigger'lar drop edilip yenisi bağlanır, isim dışında davranış aynı)

### Kod Değişikliği **Gerektiren** (Breaking — Ayrı Takip)
- **Optimistic locking aktivasyonu (B1):** Frontend'in UPDATE'lerinde `WHERE version=?` ve response'tan `version` okuma zorunlu
  - Etkilenen dosyalar: `frontend/src/lib/supabase/*-api.ts` (14 dosya)
  - Mobile app: aynı şekilde
  - **Plan:** Adım 2'de trigger version'u artırır ama optimistic lock **aktif değil**. Kod güncellendikten sonra Adım 2c'de aktive edilir.
- **Soft delete "çöp kutusu" UI (B2):** Admin panelinde silinmiş kayıtları listeleme ekranı — yeni özellik, breaking değil
- **`restore_entity` çağrıları (B3):** Silme UI'larına "geri al" butonu → yeni özellik
- **Frontend'in `organization_id`'yi her INSERT'te göndermesi (B4):** Bazı yerlerde trigger veya default ile set ediliyor olabilir. Grep ile tespit + Grup 1 öncesi doğrulama gerekli.

### Frontend Etkisi Özeti
| Alan | Adım 1 | Adım 2 Pilot A | Adım 2 Pilot B | Adım 3 Grup 1 | Adım 3 Grup 2 | Optimistic Lock |
|---|---|---|---|---|---|---|
| Hiç değişiklik | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ |
| Yeni API metotları | — | — | — | — | — | ✅ |
| UI ekleme | — | — | — | — | — | ✅ |

*Grup 1/2'de frontend değişiklik gerekmez **eğer** `organization_id` zaten doğru set ediliyorsa. Doğrulama: §11-Q5.

### Mobile App Etkisi
Proje yapısında mobil kod bulamadım (sadece `frontend/` ve `supabase/`). Eğer bağımsız mobil app varsa audit'e ek item: §11-Q6.

---

## 7. Staging ve Test Stratejisi

### 7.1 Şu Anki Durum
- **Tek proje:** `guvenligimcepte-dev` — adı "dev" içeriyor, muhtemelen zaten dev/staging ortamı
- **Prod ortamı var mı?** Bilinmiyor — §11-Q1'de sorulacak
- **Ayrı staging Supabase projesi:** Yok (free tier'da bir tane daha açılabilir)

### 7.2 Önerilen
1. **Eğer prod yoksa ve bu proje canlı kullanımda değilse:** `guvenligimcepte-dev` üzerinde direkt devam — her migration öncesi manuel pg_dump al
2. **Eğer prod varsa:** İkinci bir Supabase projesi (`guvenligimcepte-staging`) aç, mevcut şemayı clone et, her migration önce staging'de 24 saat test edilsin
3. **Seçenek 3 — Supabase Branching (Pro plan):** PITR ve branching özelliği varsa branch oluşturarak test; yoksa opsiyon değil

### 7.3 Her Migration İçin Kabul Kriterleri Şablonu

Her migration için ayrı kontrol listesi:

```
[ ] Migration dosyası yazıldı
[ ] Rollback (down) script'i var ve test edildi
[ ] Staging/dev'de uygulandı
[ ] SQL testleri çalıştırıldı (pre-tanımlı test suite)
[ ] `_audit.audit_tenant_isolation()` çıktısı öncesi/sonrası karşılaştırıldı
[ ] Frontend build PASS
[ ] Frontend E2E — etkilenen sayfalar manuel test
[ ] Cross-tenant izolasyon testi (iki kullanıcı)
[ ] 24 saat gözlem — pg_stat, error log, frontend error
[ ] Performans regresyonu yok (%20 tolerans)
[ ] Commit + push
```

---

## 8. Rollback Planı

### Genel Prensip
Her migration ayrı transaction içinde. Başarısız olursa **otomatik** geri alınır. Başarılı olup sonradan sorun çıkarsa **manuel** rollback script'i çalıştırılır.

### Adım 1 Rollback
```sql
BEGIN;
ALTER TABLE public.audit_logs NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
ALTER TABLE public.audit_logs
  DROP COLUMN IF EXISTS old_values,
  DROP COLUMN IF EXISTS new_values,
  DROP COLUMN IF EXISTS changed_fields,
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS session_id,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS user_email_snapshot;
DROP FUNCTION IF EXISTS public.log_audit_event(...);
DROP FUNCTION IF EXISTS public.restore_entity(text, uuid);
DROP SCHEMA IF EXISTS _audit CASCADE;
COMMIT;
```

### Adım 2 Rollback (Pilot A/B)
```sql
BEGIN;
DROP TRIGGER IF EXISTS tg_audit_changes ON public.<pilot_table>;
DROP TRIGGER IF EXISTS tg_set_updated_fields ON public.<pilot_table>;
DROP TRIGGER IF EXISTS tg_set_created_fields ON public.<pilot_table>;
-- Eski trigger'ı yeniden oluştur
CREATE TRIGGER trg_<old_name> ...;
-- Eklenen kolonları drop et (sadece bu migration'da eklenenler)
ALTER TABLE public.<pilot_table>
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS version;
DROP VIEW IF EXISTS public.<pilot_table>_active;
-- RLS policy'lerini eski haline
DROP POLICY "<new>" ON public.<pilot_table>;
CREATE POLICY "<old>" ...;
COMMIT;
```

### Senaryolar
| Senaryo | Aksiyon |
|---|---|
| Migration sırasında syntax hatası | Otomatik rollback (transaction), düzelt, yeniden |
| Migration sonrası testler fail | Manuel rollback script çalıştır, düzelt, yeniden |
| 24s gözlem sonrası yavaşlama tespit | Belirli trigger'ı drop et (target rollback); root cause incele |
| Cross-tenant sızıntı tespit | **ACİL** — tüm değişikliği rollback, event'i audit'e yaz, ekip ile incele |
| Frontend E2E fail | Rollback; frontend düzeltmesi + migration birlikte planlanır |

### Veri Kurtarma
- Her migration öncesi `pg_dump` snapshot'ı `backups/` altına alınır (dosya adı: `pre_hardening_stepN_YYYYMMDD.dump`)
- Felaket durumunda: `pg_restore --clean --if-exists`

---

## 9. Zaman Tahmini

**Uygulama sırası (güncellenmiş):**
```
Adım 0   → Fizibilite belgesi (mevcut)
Adım 0.5 → Acil güvenlik düzeltmesi (Q9 fail-open + admin-ai route)  ← YENİ, ACİL
Adım 0.7 → Frontend tenant hazırlığı (Q5 42 düzeltme)                ← YENİ
Adım 1   → Non-breaking altyapı migration'ı
Adım 2   → Pilot tablo
Adım 3   → Batch rollout
Adım 4   → JWT claim'e geçiş
```

| Adım | Efor | Takvim |
|---|---|---|
| **Adım 0.5 — Acil güvenlik düzeltmesi** (§13) | **4-5 saat** | **0.5-1 gün** |
| **Adım 0.7 — Frontend tenant hazırlığı** (§14) | **4-6 saat** | **1 gün** |
| Adım 1 — Non-breaking altyapı | 2-3 saat | 1 gün (yazma + test + 24s gözlem) |
| Adım 2a — Pilot A (team_categories) | 1-2 saat | 0.5 gün |
| Adım 2b — Pilot B (risk_assessment_findings) | 2-3 saat | 1 gün + 48 saat gözlem |
| Adım 3 — Grup 1 (tenant-core) | 4-6 saat | 1 gün |
| Adım 3 — Grup 2 (operational) | 6-8 saat | 1-2 gün |
| Adım 3 — Grup 3 (supporting) | 4-6 saat | 1-2 gün |
| Adım 4 — JWT org_id claim (Supabase Auth Hook) | 3-4 saat | 0.5 gün (ayrı sprint) |
| **Toplam (6 adım)** | **30-43 saat** | **7.5-10 gün** |

Ek: Eksik indeks ekleme (`company_memberships` seq_scan sorunu) — 2 saat, Adım 3 esnasında paralel.

**Kritik yol:** Adım 0.5 → Adım 0.7 → Adım 1 → Adım 2 → Adım 3. Adım 4 bağımsız paralel yapılabilir.

**Adım 0.5 ve 0.7 neden önce?**
- Adım 1 altyapısı `is_super_admin()` fonksiyonuna RLS policy güncellemelerinde bağımlı (Adım 3'te). Fonksiyon Adım 0.5'te kurulmalı ki Adım 3 hazır bulsın.
- Adım 3'te `organization_id` kolonlarını NOT NULL yapacağız; Adım 0.7'de frontend'in her INSERT'te org_id gönderdiğinden emin olmalıyız yoksa INSERT'ler patlar.
- Adım 0.5'teki Q9 fail-open kapanmadan pilot müşteri gelmemeli — bu organizasyonel bir taahhüt.

---

## 10. Kararlar (Mehmet Tarafından Onaylandı)

> Aşağıdakiler önceki mesajda Mehmet tarafından verilen kararlardır, belgeye yansıtılmıştır.

| # | Konu | Karar | Etki |
|---|---|---|---|
| D1 | **FORCE RLS kapsamı** | Şimdilik sadece `audit_logs` ve güvenlik-kritik tablolarda. Nihai hedef: tüm tablolarda. | Adım 1 `audit_logs`'a uygular; Grup 1'de `organizations`, `user_profiles`, `user_roles` gibi hassas tablolara yayılır |
| D2 | **JWT organization_id claim** | **Ayrı Adım 4** olarak ele alınacak, Supabase Auth Hook ile. Şimdi karıştırma. | RLS policy'leri şimdilik `user_profiles` JOIN kullanır (mevcut yaklaşım); Adım 4'te JWT claim'e geçilir |
| D3 | **created_by/updated_by toplu ekleme** | 114 tabloya tek seferde eklenmez. Pilot sonrası 3 grup (tenant-core / operational / supporting). | Her grup ayrı migration, ayrı test |
| D4 | **audit_logs genişletme** | Non-breaking, Adım 1'de hemen. Eklenecek: `old_values`, `new_values`, `changed_fields`, `request_id`, `session_id`, `source`, `user_email_snapshot`, (severity zaten var) | ADD COLUMN NULLABLE, mevcut 50 satır etkilenmez |
| D5 | **audit_logs immutability** | UPDATE ve DELETE RLS policy ile reddedilir. Super admin bile silemesin. Sadece INSERT. | Adım 1'de `USING (false)` policy'leri |
| D6 | **Genel audit_trigger_func()** | `_audit` şeması altında. Hassas kolon maskeleme `_audit.sensitive_columns` metadata tablosundan okur. Tek fonksiyon tüm tablolara bağlanabilir. | Adım 1 içinde |
| D7 | **Soft delete unique constraint** | Partial unique index: `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`. Her tabloda mevcut unique constraint'ler bu şekilde dönüştürülür. | Adım 2+3'te pilot tablodan başlayarak |

---

## 11. Açık Sorular ve Bekleyen Kararlar

Bu bölüm iki alt başlığa ayrılmıştır:
- **§11.1 — Cevaplanmış sorular** (Q1, Q3, Q4, Q5, Q9): Araştırma tamamlandı, detaylar §12'de
- **§11.2 — Adım 1'i engellemeyen sorular** (Q2, Q6, Q7, Q8, Q10): Her biri için cevap deadline'ı

---

### 11.1 Cevaplanmış Sorular

#### Q1 — Prod ortamı var mı? ✅ CEVAPLANDI
**Cevap:** Hayır. `guvenligimcepte-dev` tek ortam, içinde sadece test hesapları var, canlı müşteri yok.
**Karar:**
- Ayrı staging kurulmayacak, mevcut ortamda ilerleyecek
- Her migration öncesi `pg_dump` ile tam yedek → `backups/` klasörüne, dosya adı: `pre_hardening_stepN_YYYYMMDD.dump`
- Migration'lar yine de "prod'a uyguluyormuş gibi" dikkatli: idempotent + rollback script'li
- **Gelecek iş:** Gerçek müşteri alınmaya yaklaşıldığında yeni Supabase projesi açılıp mevcut ortam "prod" olarak yeniden konumlandırılacak, yeni proje "staging" olacak

#### Q3 — Audit trigger'dan muaf tablolar ✅ CEVAPLANDI
**Detay:** §12.1
**Özet:** `legal_*`, `mevzuat_*`, `ai_*` (internal state), `user_sessions`, `push_tokens` prefix bazlı muaf. Her muafiyet için gerekçe ve 3 ay sonra review notu §12.1'de.

#### Q4 — Tenant kategorileri ✅ CEVAPLANDI (onay bekliyor)
**Detay:** §12.2
**Özet:** Her tablo üç kategoriden birine yerleştirildi (FK haritası kullanılarak). Kategori A (tenant eklenecek, 33 tablo), Kategori B (global kalacak, 28 tablo), Kategori C (karar gerekli, 6 tablo). Backfill stratejisi her tablo için belirlendi. **Mehmet satır satır gözden geçirip onaylayacak.**

#### Q5 — Frontend yazma taraması ✅ CEVAPLANDI → **Adım 0.7'ye taşındı**
**Detay:** §12.3 (bulgular) + §14 (Adım 0.7 uygulama planı)
**Özet:** 67 yazma operasyonu tarandı. **42 nokta** düzeltme gerektiriyor: 13 INSERT org_id eksik, 21 UPDATE tenant guard yok, 5 hard delete soft delete'e çevrilecek. **Bu düzeltmeler Adım 1 migration'ından ÖNCE yapılmalı** çünkü tenant kolonlarını NOT NULL yapmadan önce frontend INSERT'lerinin hepsi organization_id set ediyor olmalı.

#### Q9 — Super admin mekanizması ✅ CEVAPLANDI → **Adım 0.5'e taşındı (ACİL GÜVENLİK)**
**Detay:** §12.4 (bulgular) + §13 (Adım 0.5 uygulama planı)
**Özet:** Bu bir "karar noktası" değil, **acil güvenlik açığıdır**:

1. **Frontend fail-open:** `settings/page.tsx:17-49`'daki lokal `useIsAdmin` hook'u 5 katlı fail-OPEN — default `true`, supabase yok `true`, user yok `true`, `profile_roles` tablosu yok (hata) `true`, catch `true`. Sonuç: **herkes admin**.
2. **Backend service_role bypass:** `frontend/src/app/api/admin-ai/route.ts` ve `frontend/src/app/api/admin-ai/learn/route.ts` `SUPABASE_SERVICE_ROLE_KEY` kullanıyor ve **hiçbir auth kontrolü yok**. Anonim veya authenticated herhangi bir istek tüm tenant'ların verisine erişebilir (firma sayıları, personel sayıları, olaylar, vb.) ve RLS bypass ile `ai_qa_learning`, `ai_user_interactions`, `ai_knowledge_base`, `ai_learning_sessions` tablolarına yazabilir. **Bu frontend fail-open'dan daha kritik.**
3. **DB'de altyapı yok:** `user_profiles.is_super_admin` kolonu yok, `public.is_super_admin()` fonksiyonu yok, bootstrap'ta Mehmet "Organization Admin" rolüne atanmış ama hiç kimseye `super_admin` rolü atanmamış.

**Şu an canlı müşteri olmadığı için zarar yok, ama pilot müşteriye gitmeden mutlaka kapanmalı.** Adım 0.5 bu açığı Adım 1'den önce kapatır.

---

### 11.2 Adım 1'i Engellemeyen Sorular

> Bu sorular Adım 1 migration'ını engellemez ama ilgili adımdan önce netleşmeli.

#### Q2 — Pilot A (`team_categories`) gerçekten yapılsın mı?
**Şu an kritik değil:** Adım 1 uygulanmadan karar verilmek zorunda değil. Adım 1 bittikten sonra karar verilebilir.
**Deadline:** Adım 2a başlamadan önce (Adım 1 bittikten sonra).
**Önerim devam ediyor:** Pilot A yapılsın — 2-3 saatlik ekstra yatırım, altyapının gerçekten çalıştığını kimse fark etmeden doğrulatır.

#### Q6 — Mobil uygulama kapsamda mı?
**Şu an kritik değil:** Adım 1 ve pilot aşamalarda mobil etkilenmez (ne trigger ne RLS değişikliği mobil için breaking değil, soft delete/optimistic lock ise çok sonra gelir).
**Deadline:** Adım 3 Grup 2 (operational) bitiminden önce — optimistic locking ve soft delete UI'ı mobilde de yapılacaksa planlama gerek.
**Eylem:** Mehmet'in cevap vermesi gerek: mobil app repo nerede? Yoksa "yok" yanıtı yeterli.

#### Q7 — Supabase plan (Free vs Pro)?
**Şu an kritik değil:** Adım 1 planı etkilemez. Backup stratejisi Q1 cevabıyla çözüldü: manuel pg_dump + backups/ klasörü.
**Deadline:** Adım 3 tamamlandıktan sonra (canlı öncesi). PITR + branching Pro plan gerektirir, canlıya yakın alınmalı.
**Eylem:** Canlı launch öncesi karar — şimdi cevaplanması gerekmiyor.

#### Q8 — `ip_address` text → inet migrasyonu
**Şu an kritik değil:** Şu anki 50 satır text olarak çalışıyor, Adım 1-3'ü etkilemez.
**Deadline:** "Tipleri sıkılaştırma" sprintinde (Adım 5+, gelecek iş).
**Eylem:** §14 İlerleme İzleme tablosunda Adım 5 olarak zaten listelendi.

#### Q10 — `updated_by` için `auth.uid()` NULL dönerse ne olur?
**Şu an kritik değil:** Adım 1'de trigger fonksiyonu yazılırken karar verilecek ama "NULL kalsın" yaklaşımıyla yazılabilir, değiştirmek kolay.
**Deadline:** Adım 1 migration'ı yazılırken — ben migration dosyasında "NULL kalır, source='system' ayrı alanda" kararını yazacağım, Mehmet inceler.
**Kararım:** `updated_by = auth.uid()` (trigger'da). Eğer NULL dönerse NULL kalır. Audit log'da `source='system'` alanı ayrım için kullanılır. Sentinel UUID (`00000000-...`) kullanılmaz — FK referans karmaşıklığı yaratır.

---

### 11.3 Adım 1 Sırasında Karar Gereken Noktalar

Adım 1 migration'ını yazarken **durup sormam gereken** noktalar:

1. **`_audit.sensitive_columns` başlangıç içeriği** — Hangi kolonlar maskelenecek? İlk öneri: `user_profiles.phone`, `user_profiles.email`, `personnel.tc_kimlik_no` (varsa), `personnel.iban` (varsa), herhangi bir token/password/secret alanı. Adım 1'de boş tablo olarak oluşturacağım, Adım 2 pilot sırasında Mehmet ile doldurulacak. **→ Karar bu yaklaşımla: şimdi boş kalsın.**

2. **`audit_logs` ihtiyari kolon `deleted_at` eklensin mi?** Hayır — audit log'lar asla silinmez (immutable), `deleted_at` anlamsız. **→ Karar: Eklemiyorum.**

3. **`_audit` şeması için RLS** — Şemadaki `sensitive_columns` tablosu sadece super admin okuyabilsin. Ama Adım 1'de super admin mekanizması henüz yok (Q9 raporuna göre). **→ Karar: Şema sadece `postgres` ve `service_role`'a açık olsun, authenticated'a değil. Böylece RLS gerekmez.** Bu Adım 3 Grup 1'den sonra RLS'e çevrilebilir.

4. **Genel trigger fonksiyonunun `SECURITY` modu** — `SECURITY DEFINER` mi `INVOKER` mi? `DEFINER` gerekli çünkü audit_logs'a kullanıcı yazamasa bile trigger yazabilmeli. **→ Karar: `SECURITY DEFINER` + `SET search_path = public, _audit`.**

5. **`_audit.audit_tenant_isolation()` çıktı formatı** — Tablo mu TEXT mi JSONB mi? **→ Karar: `TABLE(table_name text, issue text, severity text)` döndüren set-returning function.**

Bu beş nokta haricinde Adım 1'de "karar gerekli" çıkarsa **dururum ve sorarım**, varsayım yapmam.

---

## 12. Araştırma Sonuçları (Q3, Q4, Q5, Q9)

Bu bölüm Mehmet'in onay sonrası yapılan dört detaylı araştırmanın çıktısıdır. Her alt bölüm karar-hazır rapor formatındadır. Mehmet satır satır inceleyip onaylamalı, özellikle §12.2 (kategoriler) ve §12.4 (super admin).

---

### 12.1 Audit Trigger'dan Muaf Tablolar (Q3 Sonucu)

**Toplam muaf:** 30 tablo (114 tablodan). Geri kalan 84 tablo audit trigger alacak (pilot + batch rollout sırasında kademeli).

**Alternatif izleme:** Muaf tablolar için şu an **ayrı bir logging mekanizması yok**. Supabase'in kendi `pg_stat_user_tables` ve `pg_stat_statements` verileri genel write istatistiğini verir ama kim-ne-zaman detayı yok. Eğer ileride bu tablolar için denetim ihtiyacı doğarsa: (a) logical replication + ayrı audit DB, veya (b) seçili kritik işlemler (örn. admin AI bilgi tabanı güncelleme) için manuel `log_audit_event()` çağrısı Edge Function'dan. Şimdilik `/dev/null`.

#### Muafiyet Grubu 1: Yasal/Mevzuat Referans Verisi (21 tablo)

| Tablo | Gerekçe | Review |
|---|---|---|
| `legal_chunks` | Mevzuat metinlerinin chunk'ları, global sync ile güncelleniyor, kullanıcı verisi değil | 2026-07-10 |
| `legal_documents` | Mevzuat doküman metadata'sı, global | 2026-07-10 |
| `legal_sources` | Resmi gazete / mevzuat kaynak tanımları, global | 2026-07-10 |
| `legal_article_history` | Madde geçmişi, global tarihçe | 2026-07-10 |
| `legal_cross_references` | Mevzuat arası çapraz referans, global | 2026-07-10 |
| `legal_sector_relevance` | Sektöre uygunluk etiketleri, global | 2026-07-10 |
| `mevzuat_documents` | Mevzuat dokümanları (Türkçe), global | 2026-07-10 |
| `mevzuat_sections` | Mevzuat bölümleri, global | 2026-07-10 |
| `mevzuat_document_types` | Doküman tip taksonomisi, global | 2026-07-10 |
| `mevzuat_topics` | Konu taksonomisi, global | 2026-07-10 |
| `mevzuat_section_topics` | Bölüm-konu ilişki tablosu, global | 2026-07-10 |
| `mevzuat_embeddings` | Embedding vektörleri, global | 2026-07-10 |
| `mevzuat_references` | Bölüm içi referanslar, global | 2026-07-10 |
| `sync_logs` | Mevzuat senkronizasyon job'larının log'u (parent: `legal_sources`), global | 2026-07-10 |

#### Muafiyet Grubu 2: AI Internal State (13 tablo)

> **Dikkat:** Bunlar "AI'ın kendi state'i" — kullanıcı verisi değil. Kullanıcı etkileşimi içeren `ai_user_interactions`, `ai_qa_learning`, `ai_learning_archive`, `ai_learning_sessions` Kategori C'de (§12.2) tartışıldı — muhtemelen tenant alacak.

| Tablo | Gerekçe | Review |
|---|---|---|
| `ai_knowledge_base` | Global AI bilgi tabanı (Nova'nın sabit bilgisi) | 2026-07-10 |
| `ai_model_versions` | Model versiyon metadata'sı, global | 2026-07-10 |
| `ai_risk_patterns` | Global risk desenleri (kümülatif öğrenme) | 2026-07-10 |
| `ai_sector_knowledge` | Sektör bazlı bilgi (global, tenant'a değil sektöre özgü) | 2026-07-10 |
| `ai_training_data` | Model eğitim verisi, global | 2026-07-10 |
| `ai_training_logs` | Eğitim log'ları, global | 2026-07-10 |
| `ai_learned_patterns` | Öğrenilmiş desenler, global kümülatif | 2026-07-10 |
| `ai_external_data` | Dış kaynak verisi (crawler), global | 2026-07-10 |
| `ai_external_sources` | Dış kaynak tanımları, global | 2026-07-10 |
| `ai_search_queries` | Arama sorgusu log'u (telemetri), global | 2026-07-10 |
| `ai_daily_summary` | Günlük global özet, kullanıcı verisi değil | 2026-07-10 |

#### Muafiyet Grubu 3: Yüksek-Frekans Sistem State (3 tablo)

| Tablo | Gerekçe | Alternatif İzleme | Review |
|---|---|---|---|
| `user_sessions` | Oturum tablosu, her istekte güncelleniyor (94 update/1 row). Audit trigger bağlarsak latency patlar. Güvenlik logu için Supabase Auth'un kendi log'u yeterli. | Supabase Auth log'u (`auth` şeması) | 2026-07-10 |
| `push_tokens` | Bildirim token'ları, kullanıcı cihaz kayıtları. Hassas olmayan sistem verisi. | Gerekirse `log_audit_event()` ile "token rotation" olayı manuel | 2026-07-10 |
| `subscription_usage` | Kullanım sayaçları, saatte bir güncelleniyor olabilir. Her artırımı audit'e yazmanın değeri yok. | Faturalama zaten ayrı kaydediliyor | 2026-07-10 |

#### Muafiyet Kuralı ve Uygulaması

- **Review date (2026-07-10):** 3 ay sonra bu listeyi gözden geçir. İhtiyaç doğarsa tablo listeden çıkar, audit eklenir.
- **Yeni tablo eklenirse:** Varsayılan olarak audit trigger **var** — muaf olması için bu listeye eklenmesi gerek + gerekçe + review date.
- **`_audit.exempt_tables` metadata tablosu:** Adım 1 migration'ında bu liste kod olarak değil **tablo olarak** tutulacak, yönetimi kolay olsun.

---

### 12.2 Tenant Kategorizasyonu (Q4 Sonucu)

**Metodoloji:** Her tablo için veritabanı FK haritası kullanılarak parent ilişkileri çıkarıldı. Backfill kaynağı parent'tan JOIN ile belirlenebilir.

**3 kategori:**
- **Kategori A** — Eksik olan `organization_id` eklenecek (27 tablo)
- **Kategori B** — Tenant-free, global kalacak (28 tablo)
- **Kategori C** — Karar gerekli, şüpheli (6 tablo) — **Mehmet tartışmalı**

> `organization_id` ZATEN var olan 47 tablo listeye alınmadı (bkz. §1.2 raporu).

#### Kategori A — Tenant Kolonu Eklenecek (27 tablo)

Her satır için: amacı, satır sayısı, backfill stratejisi (parent'tan JOIN), risk notu.

| Tablo | Amaç | Satır | Backfill Kaynağı | Risk Notu |
|---|---|---|---|---|
| `incident_personnel` | Olaya karışan personel linki | ~0 | `incidents.organization_id` (parent FK) | Defense-in-depth — parent'ta var, buraya da |
| `incident_witnesses` | Olay tanıkları | ~0 | `incidents.organization_id` | Defense-in-depth |
| `editor_document_versions` | Döküman sürüm geçmişi | ~0 | `editor_documents.organization_id` | Parent'ta var |
| `document_signatures` | Döküman dijital imza kayıtları | ~0 | `editor_documents.organization_id` via `document_id` | Parent'ta var |
| `company_document_versions` | Şirket doküman sürümleri | ~0 | `company_documents.organization_id` via `document_id` | Zaten var ama doğrulanmalı |
| `slides` | Slayt içerikleri | 83 | `slide_decks.organization_id` via `deck_id` | Frontend insert'lerinde eksik (§12.3 #30-42), düzeltme gerekli |
| `slide_deck_revisions` | Slayt deck revizyonları | ~0 | `slide_decks.organization_id` via `deck_id` | Parent'ta var |
| `slide_view_events` | Slayt izlenme olayları | ~0 | `slide_deck_sessions` → `slide_decks.organization_id` | İki hop JOIN |
| `survey_questions` | Anket soruları | ~0 | `surveys.organization_id` via `survey_id` | Frontend insert'lerinde eksik |
| `survey_tokens` | Anket katılım token'ları | ~0 | `surveys.organization_id` via `survey_id` | Frontend insert'lerinde eksik |
| `survey_responses` | Anket cevapları | ~0 | `surveys.organization_id` via `survey_id` | Frontend insert'lerinde eksik |
| `workspace_invitations` | İşyeri davetleri | ~0 | `company_workspaces.organization_id` via `company_workspace_id` | Frontend insert'lerinde eksik |
| `workspace_members` | İşyeri üyeleri | ~0 | `company_workspaces.organization_id` via `company_workspace_id` | Birden fazla UPDATE call eksik guard |
| `company_invitations` | Şirket davetleri | ~0 | `company_workspaces.organization_id` via `company_workspace_id` | İki parent FK, tek seçilmeli |
| `company_invitation_permissions` | Davet bazlı yetki matrisi | ~0 | `company_invitations` → parent FK | İki hop JOIN |
| `company_join_requests` | Şirket katılım talepleri | ~0 | `requesting_organization_id` ZATEN var (farklı isim!) | **Yeniden adlandırma mı kolon ekleme mi?** |
| `company_member_module_permissions` | Üyelik bazlı modül yetkileri | ~0 | `company_memberships.organization_id` via `company_membership_id` | Parent'ta var |
| `company_relationships` | Şirket holding/parent ilişkileri | ~0 | Her iki parent `company_identities`'ın kendi org_id'si var — **hangisi?** | **Karar gerek** — parent mı child mı? |
| `company_training_attendees` | Eğitim katılımcı kayıtları | ~0 | `company_trainings.organization_id` via `training_id` | Parent'ta var |
| `isg_announcements` | İSG duyuruları | ~0 | `legal_sources.id` → muhtemelen **global olabilir** | ⚠️ Kategori C'ye aday |
| `isg_task_completions` | Görev tamamlama kayıtları | ~0 | `isg_tasks.organization_id` via `task_id` | Parent'ta var |
| `bim_models` | BIM model dosyaları | ~0 | `company_workspaces.organization_id` via `company_id` | Parent'ta var |
| `machines` | Makine envanteri | ~0 | `company_workspaces.organization_id` via `company_id` | Parent'ta var |
| `digital_twin_points` | Dijital ikiz noktaları | ~0 | `company_workspaces.organization_id` via `company_id` | Parent'ta var |
| `scan_detections` | Tarama tespit sonuçları | ~0 | `scan_sessions.organization_id` via `session_id` | Parent'ta ZATEN var |
| `scan_frames` | Tarama frame kayıtları | ~0 | `scan_sessions.organization_id` via `session_id` | Parent'ta var |
| `scan_reports` | Tarama raporları | ~0 | `scan_sessions.organization_id` via `session_id` | Parent'ta var |
| `photogrammetry_jobs` | Fotogrametri işleri | ~0 | `scan_sessions.organization_id` via `session_id` | Parent'ta var |
| `solution_documents` | Çözüm merkezi çıktı dokümanları | ~0 | `solution_queries.organization_id` via `query_id` | Parent'ta var |
| `timesheet_entries` | Mesai çizelgesi girişleri | ~0 | `timesheets.organization_id` via `timesheet_id` | Parent'ta var |

**Backfill ortak şablon (tek tablo için):**
```sql
-- 1. Kolonu NULLABLE ekle
ALTER TABLE public.<tbl> ADD COLUMN organization_id uuid NULL REFERENCES public.organizations(id);

-- 2. Parent'tan doldur
UPDATE public.<tbl> t
   SET organization_id = p.organization_id
  FROM public.<parent> p
 WHERE t.<fk_col> = p.id
   AND t.organization_id IS NULL;

-- 3. Validate: NULL kalan var mı?
SELECT count(*) FROM public.<tbl> WHERE organization_id IS NULL;

-- 4. NULL yoksa NOT NULL yap
ALTER TABLE public.<tbl> ALTER COLUMN organization_id SET NOT NULL;

-- 5. Index
CREATE INDEX idx_<tbl>_organization_id ON public.<tbl>(organization_id);
```

**Riskli backfill noktaları:**
1. `company_relationships` — iki parent (parent + child company), hangisinin org_id'si alınacak? **Öneri:** parent company'nin (holding), çünkü ilişkiyi "sahip" orası yönetir. **Onay gerek.**
2. `company_join_requests` — zaten `requesting_organization_id` kolonu var. Kol "organization_id" olmalı mı (standart) yoksa bu ismin anlamı farklı mı? **Öneri:** `requesting_organization_id`'yi bırak, ayrı `organization_id` ekleme (çakışır). Bunun yerine RLS policy'lerinde `requesting_organization_id` kullanılsın. **Onay gerek.**
3. `isg_announcements` — parent `legal_sources`, global bir tablo. Bu duyurular muhtemelen her tenant'a gösterilen global mevzuat duyuruları. **Öneri:** Kategori B'ye taşınsın, global kalsın. **Onay gerek.**
4. Kolon FK varsa ama `ON DELETE` davranışı belirsizse — yanlış cascade veri kaybına yol açar. Her FK için explicit `ON DELETE RESTRICT` (veya duruma göre `SET NULL`) kullanılacak.

#### Kategori B — Tenant-Free (Global Kalacak, 28 tablo)

| Tablo | Amaç | Global Etiketi |
|---|---|---|
| `legal_chunks` | Mevzuat chunk'ları | Referans veri |
| `legal_documents` | Mevzuat dokümanları | Referans veri |
| `legal_sources` | Mevzuat kaynakları | Referans veri |
| `legal_article_history` | Madde geçmişi | Referans veri |
| `legal_cross_references` | Mevzuat çapraz ref | Referans veri |
| `legal_sector_relevance` | Sektör uygunluk | Taksonomi |
| `mevzuat_documents` | Mevzuat dokümanları (TR) | Referans veri |
| `mevzuat_sections` | Mevzuat bölümleri | Referans veri |
| `mevzuat_document_types` | Doküman tipleri | Taksonomi |
| `mevzuat_topics` | Konu taksonomisi | Taksonomi |
| `mevzuat_section_topics` | Bölüm-konu ilişki | Taksonomi |
| `mevzuat_embeddings` | Embedding vektörleri | Sistem state |
| `mevzuat_references` | İçi referanslar | Referans veri |
| `ai_knowledge_base` | Nova global bilgi | AI model state |
| `ai_model_versions` | Model metadata | AI model state |
| `ai_risk_patterns` | Global risk desenleri | AI model state |
| `ai_sector_knowledge` | Sektör bilgisi | AI model state |
| `ai_training_data` | Eğitim verisi | AI model state |
| `ai_training_logs` | Eğitim log'u | AI model state |
| `ai_learned_patterns` | Öğrenilmiş desenler | AI model state |
| `ai_external_data` | Dış kaynak verisi | AI model state |
| `ai_external_sources` | Dış kaynak tanımı | AI model state |
| `ai_search_queries` | Arama telemetrisi | Global telemetri |
| `ai_daily_summary` | Günlük özet | Global analitik |
| `subscription_plans` | Abonelik planları | Sistem ayarı |
| `roles` | Sistem rolleri | Sistem ayarı |
| `mevzuat_section_topics` | (tekrar — ignore) | — |
| `sync_logs` | Mevzuat sync log'u | Sistem state |

**Şüphe yok** — bu 28 tablo gerçekten global.

#### Kategori C — ✅ Karara Bağlandı (2026-04-11)

Aşağıdaki tablolar için Mehmet ile yapılan ek araştırma sonrası kesin kararlar verildi:

| Tablo | Karar | Gerekçe |
|---|---|---|
| `ai_user_interactions` | ✅ **Kategori A** | Kullanıcının Nova ile konuşmaları tenant bazlı analitik için önemli, KVKK açısından kişisel veri. Backfill: `user_profiles.organization_id` üzerinden |
| `ai_qa_learning` | ✅ **Kategori A** | Aynı gerekçe |
| `ai_learning_sessions` | ✅ **Kategori B (global)** | Şemada hiçbir kullanıcı/org ilişkisi yok (id, session_type, status, metrikler, zaman damgaları). Yazan iki yer (`admin-ai/learn/route.ts:187`, `supabase/functions/ai-web-scraper/index.ts`) global platform işlemi. 1 satır mevcut. Audit'ten de muaf (§12.1 Grup 2) |
| `ai_learning_archive` | ✅ **Kategori A'da (zaten var)** | `organization_id` kolonu ZATEN var; önceki rapor (§1.2) yanlış tarıyordu. FK haritası teyit etti. |
| `risk_clusters` | ✅ **Kategori A** (teyit) | FK: `scan_sessions.id` + `company_workspaces.id` — tenant-specific. Backfill: `company_workspaces.organization_id` |
| `user_preferences` | ✅ **Tenant-free** (teyit) | Kullanıcıya özel, `user_id` yeterli |
| `subscription_usage` | ✅ **Kategori A** (teyit) | Parent `user_subscriptions.organization_id` üzerinden backfill |

**Ek Kategori C → diğerlerine taşındı:**

| Tablo | Önceki | Yeni | Gerekçe |
|---|---|---|---|
| `isg_announcements` | Kategori A (belirsiz) | ✅ **Kategori B (global)** | Parent `legal_sources` global mevzuat tablosu. Frontend ve backend'de 0 yazma referansı. Gelecekte cron/crawler yazacak, tenant-level değil. 0 satır. |
| `company_relationships` | Kategori A (şüpheli) | ✅ **Kategori D (çoklu-FK)** | İki FK: `parent_company_id` + `child_company_id` — şema bir şirketler arası ilişkiyi temsil ediyor, tek bir organizasyona ait değil. Ayrı kategoriye taşındı (bkz. §12.2 Kategori D) |
| `company_join_requests` | Kategori A (belirsiz) | ✅ **Kategori D (özel — mevcut kolonla)** | Zaten `requesting_organization_id` kolonu var. Yeni kolon eklenmeyecek. RLS policy'de bu kolon + `company_identity_id` üzerinden iki taraflı guard (hem talep eden hem hedef şirket görebilmeli) |

---

#### Kategori D — Çoklu-FK Tenant-Aware (YENİ)

**Tanım:** Tenant izolasyonu tek bir `organization_id` kolonu yerine tabloya özgü **iki veya daha fazla FK** üzerinden sağlanır. Şemada genelde bir "ilişki" veya "talep" tablosudur ve her iki taraf görme/işleme hakkına sahip olmalıdır. Bu tablolara yeni `organization_id` kolonu **eklenmez**; RLS policy'leri mevcut FK'ları kullanır.

**Kullanım kriteri (ne zaman Kategori D?):**
1. Tablo iki bağımsız tenant tarafı arasındaki ilişkiyi modelliyorsa (örn. holding-yan şirket, ana işveren-alt işveren)
2. Her iki tarafın da kaydı görme/işleme hakkı varsa
3. Tek bir `organization_id` atamak veri modelini bozuyorsa (hangi taraf?)

**Adım 1/2'de kullanılacak RLS şablonu (`company_relationships` için taslak):**

```sql
-- SELECT: her iki taraftaki şirket üyeleri görebilir
CREATE POLICY "company_relationships_select"
ON public.company_relationships FOR SELECT
TO authenticated
USING (
  public.is_company_member(parent_company_id)
  OR public.is_company_member(child_company_id)
  OR public.is_super_admin()
);

-- INSERT: ilişkiyi kuran taraf, her iki şirkette de yetkili olmalı (veya en az parent approver)
CREATE POLICY "company_relationships_insert"
ON public.company_relationships FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_approver(parent_company_id)
  OR public.is_super_admin()
);

-- UPDATE: parent approver değiştirebilir
CREATE POLICY "company_relationships_update"
ON public.company_relationships FOR UPDATE
TO authenticated
USING (
  public.is_company_approver(parent_company_id)
  OR public.is_super_admin()
)
WITH CHECK (
  public.is_company_approver(parent_company_id)
  OR public.is_super_admin()
);

-- DELETE: hard delete yasak — soft delete kullanılır (deleted_at set edilir)
CREATE POLICY "company_relationships_delete"
ON public.company_relationships FOR DELETE
USING (false);
```

**Not — `is_company_member()` ve `is_company_approver()` fonksiyonları:**
Mevcut DB'de bu iki fonksiyon **zaten var** (Q9 araştırması sırasında tespit edildi):
- `public.is_company_member(p_company_identity_id uuid) RETURNS boolean` — SECURITY DEFINER + STABLE
- `public.is_company_approver(p_company_identity_id uuid) RETURNS boolean` — SECURITY DEFINER + STABLE

Kaynak: `supabase/migrations/20260318_001_company_identity_workspace_shared_ops.sql:239-254`

Parça A'ya ek iskelet eklenmesine **gerek yok** — hazır fonksiyonlar kullanılacak.

**Kategori D şablonu (gelecekteki tablolar için):**

Yeni bir tablo eklenirken Kategori D'ye mi ait diye karar verirken:

```
Soru 1: Bu tablo iki bağımsız tenant tarafı arasındaki ilişki mi? (evet/hayır)
Soru 2: Her iki taraf da görme hakkına sahip mi? (evet/hayır)
Soru 3: Tek bir organization_id doğal olarak belirsiz mi? (evet/hayır)

Üç soruya da "evet" → Kategori D
```

**Kategori D tabloları listesi:**
| Tablo | FK #1 | FK #2 | Görme Hakkı | Yazma Hakkı |
|---|---|---|---|---|
| `company_relationships` | `parent_company_id` | `child_company_id` | Her iki taraf üyeleri | Parent approver |
| `company_join_requests` | `requesting_organization_id` | `company_identity_id` | Talep eden + hedef şirket | Talep eden oluşturur, hedef onaylar |

Gelecekte eklenebilecek örnekler: şirketler arası mutabakatlar, çoklu-taraflı denetimler, paylaşılan raporlar.

**Özet — Q4 Kategori C 8 kararı uygulanacak:**

Sonuç: Kategori A 3 tablo kazandı (`ai_user_interactions`, `ai_qa_learning`, `risk_clusters`, `subscription_usage`), Kategori B 2 tablo kazandı (`ai_learning_sessions`, `isg_announcements`), Kategori D yeni tanıtıldı (`company_relationships`, `company_join_requests`), `user_preferences` tenant-free kalıyor.

---

### 12.3 Frontend Yazma Taraması (Q5 Sonucu)

**Tarama kapsamı:** `frontend/src/` altındaki tüm `.ts` ve `.tsx` dosyalarında `.insert()`, `.upsert()`, `.update()`, `.delete()`, `.rpc()` çağrıları.

#### Özet İstatistik

| Operasyon | Toplam | org_id Tamam | org_id Eksik | Belirsiz/Diğer |
|---|---|---|---|---|
| `.insert()` | 33 | 19 | 7 | 7 (spread operator) |
| `.upsert()` | 5 | 5 | 0 | 0 |
| `.update()` | 23 | **2** tenant guard'lı | **21** guard yok (policy'ye güveniyor) | — |
| `.delete()` (hard) | 8 | — | — | 8 tanesi soft delete'e çevrilecek |
| `.rpc()` yazma | 5 | — | — | Derinlemesine incelenmedi |

**Toplam düzeltme gereken:** 42 nokta (13 INSERT org_id eksik + 21 UPDATE guard yok + 8 hard delete)

#### INSERT/UPSERT — org_id Eksik Olanlar (Kritik, Acil)

| # | Dosya:satır | Tablo | Sorun |
|---|---|---|---|
| 1 | `incident-api.ts:485-493` | `incident_witnesses` | INSERT payload'unda org_id yok — parent incident'tan alınmalı |
| 2 | `incident-api.ts:674` | `incident_personnel` | Spread operator, org_id eksik |
| 3 | `incident-api.ts:703` | `incident_personnel` | Bulk map() insert, org_id eksik |
| 4 | `document-api.ts:165` | `editor_document_versions` | document_id ve version var, org_id eksik |
| 5 | `document-api.ts:247` | `document_signatures` | Sig spread operator, org_id eksik |
| 6 | `survey-api.ts:268` | `survey_questions` | survey_id linked, org_id eksik |
| 7 | `survey-api.ts:283` | `survey_tokens` | survey_id linked, org_id eksik |
| 8 | `survey-api.ts:313` | `survey_responses` | token_id linked, org_id eksik |
| 9 | `slide-deck-api.ts:296` | `slides` | Sadece deck_id, org_id eksik |
| 10 | `slide-deck-api.ts:357` | `slides` | Sadece deck_id, org_id eksik |
| 11 | `training-slides-ai/route.ts:171` | `slides` | deck_id var, org_id eksik |
| 12 | `slide-deck-import/route.ts:201` | `slides` | deck_id var, org_id eksik |
| 13 | `slide-single-ai/route.ts:149` | `slides` | deck_id var, org_id eksik |
| 14 | `admin-ai/route.ts:151` | `ai_qa_learning` | Kategori C tablosu — karara bağlı |
| 15 | `admin-ai/route.ts:161` | `ai_user_interactions` | Kategori C tablosu — karara bağlı |
| 16 | `admin-ai/learn/route.ts:164` | `ai_knowledge_base` | **Global tablo — org_id zaten gerek yok** (Kategori B) ✅ |
| 17 | `admin-ai/learn/route.ts:187` | `ai_learning_sessions` | Kategori C tablosu — karara bağlı |
| 18 | `InviteProfessionalModal.tsx:222` | `workspace_invitations` | company_workspace_id var, org_id eksik |

**Düzeltme deseni:**
```ts
// Öncesi
await supabase.from('slides').insert({ deck_id, index, content })

// Sonrası — parent'tan al
const { data: deck } = await supabase.from('slide_decks').select('organization_id').eq('id', deck_id).single()
await supabase.from('slides').insert({ deck_id, index, content, organization_id: deck.organization_id })
```

Veya server-side helper (daha iyi): `resolveOrganizationId(deck_id, 'slide_decks')`.

#### UPDATE — Tenant Guard Eksik (Orta, Batch Düzeltme)

23 UPDATE çağrısının **21 tanesi** sadece `.eq('id', x)` ile filtreleniyor, `.eq('organization_id', orgId)` yok. RLS policy bu sızıntıyı engelliyor olsa da **defense-in-depth** için code-level guard eklenmeli.

**Öncelik sırası:**
1. `incidents`, `incident_dof`, `incident_ishikawa` — olay güncelleme
2. `personnel` (2 yer) — personel güncelleme
3. `risk_assessments`, `risk_assessment_findings` — risk analizi güncelleme
4. `editor_documents` (2 yer) — döküman güncelleme
5. `company_workspaces`, `company_identities` — şirket güncelleme
6. `slide_decks`, `slides` — slayt güncelleme
7. `company_trainings`, `company_periodic_controls` — eğitim/kontrol güncelleme
8. `certificate_templates`, `question_bank` — şablon/soru güncelleme
9. `workspace_members`, `workspace_invitations`, `team_members` — üyelik/davet güncelleme

#### DELETE — Hard Delete (Soft Delete Geçişi)

| # | Dosya:satır | Tablo | Dönüşüm |
|---|---|---|---|
| 1 | `company-api.ts:547` | `company_workspaces` | `delete()` → `update({ deleted_at: new Date().toISOString(), deleted_by: userId })` |
| 2 | `company-api.ts:558` | `company_identities` | Aynı |
| 3 | `tracking-api.ts:213` | `company_trainings` | Aynı |
| 4 | `tracking-api.ts:329` | `company_periodic_controls` | Aynı |
| 5 | `slide-deck-api.ts:381` | `slides` | Aynı |
| 6 | `training-slides-ai/route.ts:175` | `slide_decks` | **Error cleanup** — belki hard delete kalabilir (transaction başarısız olursa orphan kaydı silme). Değerlendir. |
| 7 | `slide-deck-import/route.ts:204` | `slide_decks` | Aynı — error cleanup |
| 8 | `dashboard/actions.ts:13` | `user_sessions` | **Logout** — hard delete uygun, soft delete gerekmez |

**Öneri:** #6, #7 (error cleanup) ve #8 (logout) hard delete olarak kalsın — bunlar "işlem başarısız, kaydı geri al" senaryosu veya ephemeral state. Diğer 5 tanesi soft delete'e geçsin.

#### Grup 1 (tenant-core) Migration'ından Önce Yapılacaklar

Migration'dan önce frontend'de yapılması gereken değişiklikler (ayrı PR'da):

**Acil (P0):**
- 13 INSERT'e org_id ekle (yukarıdaki tablo #1-18 hariç Kategori C ve B olanlar)

**Önemli (P1):**
- 21 UPDATE'e tenant guard ekle (code-level savunma)

**Sonra (P2 — Adım 2+):**
- 5 hard delete'i soft delete'e çevir
- Optimistic locking aktivasyonu (pilot'tan sonra)

**Etkilenen dosyalar (düzeltme PR'ı için):**
- `frontend/src/lib/supabase/incident-api.ts`
- `frontend/src/lib/supabase/document-api.ts`
- `frontend/src/lib/supabase/survey-api.ts`
- `frontend/src/lib/supabase/slide-deck-api.ts`
- `frontend/src/app/api/training-slides-ai/route.ts`
- `frontend/src/app/api/slide-deck-import/route.ts`
- `frontend/src/app/api/slide-single-ai/route.ts`
- `frontend/src/components/.../InviteProfessionalModal.tsx`
- (Kategori C karar sonrası) `frontend/src/app/api/admin-ai/route.ts`, `admin-ai/learn/route.ts`

---

### 12.4 Super Admin Mevcut Durumu (Q9 Sonucu)

> ⚠️ **KRİTİK BULGU — GÜVENLİK AÇIĞI:** `frontend/src/app/(protected)/settings/page.tsx:29-41` olmayan `profile_roles` tablosuna sorgu atıyor, hata durumunda `setIsAdmin(true)` fallback'i kullanıyor. **Sonuç:** Tüm authenticated kullanıcılar admin olarak görünüyor, admin-only sayfalar/tab'lar (Nova AI tab gibi) herkese açık. Bu Adım 1'den bağımsız olarak **acil düzeltme** gerektirir.

#### Mevcut Durum

**Veritabanı tarafı (kısmen var):**
- ✅ `roles` tablosu tanımlı — `super_admin`, `platform_admin`, `organization_admin`, `osgb_manager`, `ohs_specialist`, `workplace_physician`, `dsp`, `viewer` kodları mevcut
- ✅ `user_roles` ara tablosu var (`user_profile_id` ↔ `role_id`)
- ✅ SECURITY DEFINER pattern örnekleri: `current_user_organization_id()`, `is_company_approver()`, `current_user_email()`
- ❌ `user_profiles.is_super_admin` kolonu **yok**
- ❌ `public.is_super_admin()` fonksiyonu **yok**
- ❌ Mevcut 273 RLS policy'de **hiçbirinde** super admin bypass yok — sadece `is_company_approver()` şirket seviyesi var
- ❌ Bootstrap migration (`20260313034621_bootstrap_current_admin_profile.sql`) Mehmet'in hesabına **"Organization Admin"** rolü atıyor — **"super_admin" değil** (rol kodu tabloda tanımlı ama kimseye atanmamış)
- ✏️ **DÜZELTME (2026-04-11):** `current_organization_id()` fonksiyonu JWT'den `organization_id` claim'i okumaya çalışıyor. Önceki raporum bu claim'in eksik olduğunu ve fonksiyonun NULL döndüğünü iddia etmişti — **bu yanlıştı**. Ek araştırma sonucu: mevcut 3 kullanıcının hepsinde `auth.users.raw_app_meta_data.organization_id` **manuel olarak set edilmiş** (tahminen Mehmet tarafından SQL Editor ile) ve fonksiyon `app_metadata` fallback'i üzerinden çalışıyor. **88 RLS policy** bu fonksiyonu kullanıyor ve mevcut kullanıcılar için düzgün çalışıyor.
  > **Sayı düzeltmesi (2026-04-11 2. revizyon):** İlk tarama sadece `pg_policies.qual` alanını kontrol ediyordu, bu yüzden 79 sonuç vermişti. İkinci tarama hem `qual` hem `with_check` ikisini birleşik kontrol etti ve gerçek sayı **88** olarak tespit edildi. Bu düzeltme sadece sayısal, planı etkilemiyor.
- ⚠️ **Ama yeni kullanıcı için zamanlanmış bomba:** Hiçbir kod (migration, Edge Function, frontend, trigger) `raw_app_meta_data.organization_id`'yi SET etmiyor. Yeni kullanıcı OAuth/email ile signup yaparsa bu alan boş olacak → `current_organization_id()` NULL dönecek → ~52 kırılgan policy (§12.4a) o kullanıcı için sessizce hiçbir şey döndürmeyecek. **Bu açık Adım 0.5 Parça A'da `current_organization_id()` fonksiyonuna `user_profiles` JOIN fallback'i eklenerek kapatılır** (detay §13.2 Parça A madde 8).

**Frontend tarafı (iki paralel, biri güvenlik açığı):**

**Mekanizma 1 — Email allow-list** (`frontend/src/lib/hooks/use-is-admin.ts`)
- `NEXT_PUBLIC_ADMIN_EMAILS` env var'ı veya fallback `mehmet242306@gmail.com`
- Auth user email'ini kontrol ediyor
- DB'ye hiç bakmıyor
- **Güvenlik:** Kısıtlı ama çalışıyor. env var sızıntısı riski var.

**Mekanizma 2 — `profile_roles` sorgusu** (`frontend/src/app/(protected)/settings/page.tsx:15-49`)
```ts
const { data: roles, error } = await supabase
  .from("profile_roles")  // ← BU TABLO YOK!
  .select("role")
  .eq("profile_id", user.id);

if (error || !roles || roles.length === 0) {
  setIsAdmin(true);  // ← HATA = HERKES ADMIN
  return;
}
```
- `profile_roles` tablosu veritabanında mevcut değil
- Her sorgu hata dönüyor, her kullanıcı `isAdmin=true` alıyor
- **Etki:** Settings sayfasında "Nova AI" tab'ı vb. `adminOnly: true` kontrolleri **hiçbir kullanıcıya kısıtlanmıyor**

**JWT custom claim:** Yok (`supabase/config.toml`'da auth hook kapalı)

#### Mehmet'in Tercih Ettiği Yaklaşımla Uyum

**Mevcut kullanılabilir parçalar (tekrar yazılmayacak):**
- SECURITY DEFINER fonksiyon pattern'i (örnekler var)
- `roles` + `user_roles` altyapısı (`super_admin` kodu zaten tanımlı)

**Eklenecekler:**
1. `user_profiles.is_super_admin BOOLEAN DEFAULT FALSE` kolonu
2. Partial index: `CREATE INDEX ON user_profiles(id) WHERE is_super_admin = TRUE`
3. `public.is_super_admin(uid uuid DEFAULT auth.uid()) RETURNS BOOLEAN` fonksiyonu
   - `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`
   - İçerik: `SELECT COALESCE((SELECT is_super_admin FROM user_profiles WHERE auth_user_id = uid LIMIT 1), FALSE)`
   - `STABLE` etiketi: aynı transaction içinde cache'lenir (per-row değil, per-statement) ✅
   - Owner: `postgres`; `GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;`
4. Bootstrap update: Mehmet'in user_profile'ına `is_super_admin = TRUE` ve user_roles tablosunda "super_admin" rol ataması

**RLS policy güncellemesi (kaç policy?):**
- Grup 1 (tenant-core) sırasında ~30 policy etkilenir
- Genel pattern: `USING (organization_id = public.current_user_organization_id() OR public.is_super_admin())`
- Adım 1'de **policy değiştirmiyoruz**; sadece fonksiyon ve kolon ekliyoruz
- Adım 3 Grup 1'de policy'ler tek tek güncellenecek

**Frontend düzeltmeleri (AYRI PR, Adım 1 ile paralel yapılabilir):**
1. `settings/page.tsx` — `profile_roles` sorgusu kaldırılır, `user_profiles.is_super_admin` üzerinden kontrol. Hata durumunda **`setIsAdmin(false)`** fallback (güvenli varsayılan)
2. `use-is-admin.ts` — email allow-list kaldırılır, DB sorgusuna geçer
3. `NEXT_PUBLIC_ADMIN_EMAILS` env var kaldırılır
4. Server action'larda DB-side super admin kontrolü (şu an yok)

#### Adım 1'de Yapılacak

Adım 1 migration'ı Q9 çözümünün **veritabanı kısmını** içerecek (en küçük invaziv set):
1. `user_profiles.is_super_admin` kolonu ekle
2. `public.is_super_admin()` fonksiyonu ekle
3. Mehmet'in profile'ına `is_super_admin = TRUE` ata (bootstrap tarzı küçük SQL)
4. `audit_logs` tablosuna "user_profiles.is_super_admin değişti" özel trigger'ı → hassas bir değişiklik olduğu için her TRUE/FALSE geçişi audit'e düşsün

**Yapılmayacak (ilgili adımlara ertelendi):**
- RLS policy güncellemeleri → Adım 3 Grup 1
- Frontend düzeltmeleri → Ayrı PR (Adım 1 onayından sonra, **ama acil** çünkü mevcut güvenlik açığı var)
- JWT custom claim → Adım 4 (bağımsız sprint)

#### Mehmet'e Acil Öneri (Q9 ile ilgili)

`settings/page.tsx`'teki fallback güvenlik açığı **Adım 1 migration'ından bağımsız**, hemen düzeltilebilir. Tek satırlık fix:

```diff
- setIsAdmin(true);
+ setIsAdmin(false);
```

Bunu şimdi yapıp yapmayacağımıza karar ver — migration işine başlamadan önce 2 dakikalık iş.

---

### 12.5 API Route Güvenlik Taraması (Q9 Ek Araştırma)

**Tarihi:** 2026-04-11 (ek tarama, Q9 sonucu genişletildi)
**Kapsam:** `frontend/src/app/api/**/route.ts` — toplam 14 route

#### Sınıflandırma

| Sınıf | Sayı | Kriterler |
|---|---|---|
| 🔴 **KRİTİK** | 2 | Service role + hiç auth yok → RLS bypass |
| 🟠 **YÜKSEK** | 0 | — |
| 🟡 **ORTA** | 5 | Auth yok (anon key ile ama public) → anonim Anthropic çağrısı + anonim data insert |
| 🔵 **DÜŞÜK** | 5 | Auth + tenant var, ownership check eksik |
| ⚪ **TEMİZ/PUBLIC** | 2 | Public olması gereken health check'ler |

#### Detaylı Tablo

| # | Route | Service Role? | Auth? | RBAC? | Tenant? | Sınıf | Parça B? |
|---|---|---|---|---|---|---|---|
| 1 | `admin-ai` | ✅ (fallback'li) | ❌ | ❌ | ❌ | 🔴 KRİTİK | ✅ requireSuperAdmin |
| 2 | `admin-ai/learn` | ✅ | ❌ | ❌ | ❌ | 🔴 KRİTİK | ✅ requireSuperAdmin |
| 3 | `analyze-risk` | ❌ | ❌ | ❌ | N/A (AI) | 🟡 ORTA | ✅ requireAuth |
| 4 | `debug/runtime-check` | ❌ | ❌ | N/A | N/A | ⚪ PUBLIC | — |
| 5 | `document-ai` | ❌ | ❌ | ❌ | N/A | 🟡 ORTA | ✅ requireAuth |
| 6 | `document-import` | ❌ | ❌ | ❌ | N/A | 🟡 ORTA | ✅ requireAuth |
| 7 | `env-check` | ❌ | ❌ | N/A | N/A | ⚪ PUBLIC | — |
| 8 | `import-employees` | ❌ | ❌ | ❌ | ❌ | 🟡 ORTA | ✅ requireOrgMember |
| 9 | `slide-deck-export` | ❌ | ✅ | ❌ | ✅ | 🔵 DÜŞÜK | ❌ (§14.8) |
| 10 | `slide-deck-import` | ❌ | ✅ | ❌ | ✅ | 🔵 DÜŞÜK | ❌ (§14.8) |
| 11 | `slide-media-upload` | ❌ | ✅ | ❌ | kısmi | 🔵 DÜŞÜK | ❌ (§14.8) |
| 12 | `slide-single-ai` | ❌ | ✅ | ❌ | ✅ | 🔵 DÜŞÜK | ❌ (§14.8) |
| 13 | `training-ai` | ❌ | ❌ | ❌ | N/A | 🟡 ORTA | ✅ requireAuth |
| 14 | `training-slides-ai` | ❌ | ✅ | ❌ | ✅ | 🔵 DÜŞÜK | ❌ (§14.8) |

#### KRİTİK ve ORTA Route'ların Uygulama Planı

7 route (2 KRİTİK + 5 ORTA) **Adım 0.5 Parça B** kapsamında düzeltilecek. Detaylı plan §13.2 Parça B'de.

5 DÜŞÜK route (slide-*) **Adım 0.7'ye ertelendi**. Karar ve kontrol listesi §14.8'de.

---

## 13. Adım 0.5 — Acil Güvenlik Düzeltmesi (Fail-Open Admin)

> **Durum:** ⏸ Karar bekleniyor — Mehmet onaylayınca detaylı migration + frontend PR yazılacak (ayrı dosyalar, yine onaya sunulacak).
> **Amaç:** Adım 1'den önce mevcut güvenlik açığını kapatmak.
> **Süre:** 3-4 saat
> **Bağımlılık:** Hiçbir şey — şimdi başlayabilir.

### 13.1 Mevcut Durumun Detaylı Analizi

#### 13.1.1 `profile_roles` Referansları

**Grep sonucu:** Tek dosya, tek hook.

| Dosya | Satır | Not |
|---|---|---|
| `frontend/src/app/(protected)/settings/page.tsx` | 29-41 | `profile_roles` tablosuna sorgu — bu tablo DB'de yok |

Bu dosya **kendi lokal `useIsAdmin` hook'unu** tanımlıyor (satır 17-49), global `@/lib/hooks/use-is-admin.ts`'i **kullanmıyor**. İki paralel mekanizma.

#### 13.1.2 Fail-Open Davranışı — Tam Kod

Mevcut kod (`settings/page.tsx:17-49`):
```ts
function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(true); // ← KATMAN 1: default true

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) { setIsAdmin(true); return; } // ← KATMAN 2: client yok → true

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsAdmin(true); return; } // ← KATMAN 3: user yok → true

        const { data: roles, error } = await supabase
          .from("profile_roles")  // ← TABLO YOK
          .select("role")
          .eq("profile_id", user.id);

        if (error || !roles || roles.length === 0) {
          setIsAdmin(true); // ← KATMAN 4: hata/boş → true
          return;
        }

        setIsAdmin(roles.some((r) => ADMIN_ROLES.includes(r.role)));
      } catch {
        setIsAdmin(true); // ← KATMAN 5: exception → true
      }
    })();
  }, []);

  return isAdmin;
}
```

**Beş katlı fail-open.** Tabloya sorgu her istekte hata dönüyor → her kullanıcı admin.

**Kullanım noktası:** `settings/page.tsx` — "Nova AI" tab'ı (`adminOnly: true`) her kullanıcıya görünür, AdminAITab render edilir.

#### 13.1.3 Email Allow-List — Tam İçerik

`frontend/src/lib/hooks/use-is-admin.ts` (global hook, **fail-CLOSED** — bu iyi):
```ts
const FALLBACK_ADMIN_EMAILS: string[] = [
  "mehmet242306@gmail.com",
];
```

Env var override: `NEXT_PUBLIC_ADMIN_EMAILS` — **şu an `.env.local`'de tanımlı değil**, fallback kullanılıyor.

**Kullanım noktaları (3 yer):**
| Dosya | Satır | Amaç |
|---|---|---|
| `frontend/src/components/layout/protected-shell.tsx` | 270-272 | Digital Twin nav item gating |
| `frontend/src/app/(protected)/companies/[id]/CompanyScanData.tsx` | 39 | Scan/dijital ikiz veri gösterimi |
| `frontend/src/app/(protected)/digital-twin/page.tsx` | 75 | Dijital İkiz sayfası |

**Sorun:** Bu hook fail-CLOSED (iyi), ama sadece email bazlı. `NEXT_PUBLIC_ADMIN_EMAILS` env var build-time'da bundle'a giriyor, sızıntı riski var. Ve backend (API route) tarafında kontrol YOK.

#### 13.1.4 Backend RBAC Analizi — Kritik Bulgu

Toplam 14 API route var: `frontend/src/app/api/`.

**`SUPABASE_SERVICE_ROLE_KEY` kullanan route'lar (RLS bypass):**

| Route | Satır | Auth Kontrolü | Yaptığı |
|---|---|---|---|
| `admin-ai/route.ts` | 10-15 | **Yok** | Tüm tenant verilerini okuyor (firma/personel/olay sayıları); `ai_qa_learning`, `ai_user_interactions` tablolarına insert |
| `admin-ai/learn/route.ts` | — | **Yok** | `ai_knowledge_base`, `ai_learning_sessions` tablolarına insert |

**İçerik özeti (`admin-ai/route.ts:9-15`):**
```ts
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY 
           || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
           || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}
```

**Bu route'lar:**
- Anonim istek bile kabul ediyor (auth kontrolü yok)
- Service role key varsa RLS'i tamamen bypass ediyor
- Tüm tenant'ların verisini sızdırabiliyor
- Belirli tablolara anonim yazma yapabiliyor

**Bu frontend fail-open'dan daha kritik.** Frontend fail-open admin UI'ı sızdırıyor, bu backend route'ları **doğrudan veriyi** sızdırıyor.

**Diğer 12 route** (analyze-risk, document-ai, training-slides-ai, slide-deck-export/import, slide-single-ai, document-import, import-employees, slide-media-upload, training-ai, env-check, debug/runtime-check) — bunları da `SERVICE_ROLE_KEY` kullanıp kullanmadıkları, auth kontrolü yapıp yapmadıkları Adım 0.5 sırasında **hızlı taranacak**. İlk grep sonucu sadece iki admin-ai route'unun service_role kullandığını gösterdi; diğerleri büyük ihtimalle anon key ile RLS üzerinden gidiyor. Yine de doğrulanmalı.

#### 13.1.5 Mevcut Test Hesapları

DB'den çekildi (`public.user_profiles` + `user_roles`):

| # | E-posta | Adı | Org | Mevcut Rol | Adım 0.5 Sonrası |
|---|---|---|---|---|---|
| 1 | `mehmet242306@gmail.com` | Mehmet Yildirim Test | 6cb4ceca-...5768 | `organization_admin` | **`is_super_admin = TRUE` + `super_admin` rolü** |
| 2 | `mehmetyildirim2923@gmail.com` | Test Professional | 6cb4ceca-...5768 | `ohs_specialist` | Normal kullanıcı (is_super_admin = FALSE) |

Her ikisi de aynı organizasyonda. Test senaryoları:
- Mehmet admin olarak admin ekranlarına erişmeli → PASS
- Test Professional admin ekranlarına erişememeli → PASS (şu an FAIL — fail-open yüzünden erişebiliyor)
- Test Professional `admin-ai` API'yi çağırabiliyor mu? → Kontrol et

### 13.2 Uygulama Planı — Dört Parça

#### Parça A: DB Migration — Super Admin Altyapısı

**Dosya:** `supabase/migrations/YYYYMMDDHHMMSS_step05a_super_admin_infra.sql`

**İçerik:**
1. `ALTER TABLE public.user_profiles ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;`
2. `CREATE INDEX idx_user_profiles_super_admin ON public.user_profiles(auth_user_id) WHERE is_super_admin = true;` — partial index, küçük ve hızlı
3. Fonksiyon:
   ```sql
   CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
   RETURNS boolean
   LANGUAGE sql
   STABLE
   SECURITY DEFINER
   SET search_path = public
   AS $$
     SELECT COALESCE(
       (SELECT up.is_super_admin
          FROM public.user_profiles up
         WHERE up.auth_user_id = uid
         LIMIT 1),
       false
     );
   $$;
   ```
4. `ALTER FUNCTION public.is_super_admin(uuid) OWNER TO postgres;`
5. `REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;`
6. `GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;`
7. Mehmet hesabını super admin yap:
   ```sql
   UPDATE public.user_profiles
      SET is_super_admin = true
    WHERE auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d';
   
   INSERT INTO public.user_roles (id, user_profile_id, role_id, assigned_at, assigned_by)
   SELECT gen_random_uuid(), up.id, r.id, now(), NULL
     FROM public.user_profiles up
     CROSS JOIN public.roles r
    WHERE up.auth_user_id = 'f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d'
      AND r.code = 'super_admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur 
         WHERE ur.user_profile_id = up.id AND ur.role_id = r.id
      );
   ```
8. **`current_organization_id()` Güçlendirme (Zamanlanmış Bomba Fix):**
   
   **Gerekçe (migration yorumunda yer alacak):**
   > Mevcut fonksiyon JWT'den `organization_id` claim'i okuyor, fallback olarak `app_metadata.organization_id`'ye bakıyor. Mevcut 3 kullanıcının hepsinde `app_metadata` **manuel** set edilmiş (muhtemelen SQL Editor'dan) ve bu çalışıyor. Ama hiçbir kod (migration, Edge Function, frontend, trigger) bu alanı set etmiyor. Yeni bir kullanıcı signup yaparsa `app_metadata` boş olacak ve fonksiyon NULL dönecek → "sadece `current_organization_id()`" kullanan 52 RLS policy o kullanıcıya sessizce hiçbir satır döndürmeyecek. Bu, yeni kullanıcı için platformu kullanılmaz hale getiren **zamanlanmış bir bombadır**. Bu migration fonksiyona son fallback olarak `user_profiles` JOIN'i ekler: JWT'de yoksa DB'den okunur. Mevcut davranış (JWT dolu kullanıcılar için) değişmez; yalnızca eski davranışın başarısız olduğu kullanıcılar için ek bir güvenlik ağı eklenir.
   
   **Uygulama:**
   ```sql
   CREATE OR REPLACE FUNCTION public.current_organization_id()
   RETURNS uuid
   LANGUAGE plpgsql
   STABLE
   SECURITY DEFINER                                -- eski: SECURITY INVOKER
   SET search_path = public
   AS $$
   DECLARE
     org_id uuid;
   BEGIN
     -- Katman 1: JWT (eski davranış — hızlı yol)
     BEGIN
       org_id := nullif(coalesce(
         auth.jwt() ->> 'organization_id',
         auth.jwt() -> 'app_metadata' ->> 'organization_id',
         auth.jwt() -> 'user_metadata' ->> 'organization_id'
       ), '')::uuid;
     EXCEPTION WHEN OTHERS THEN
       org_id := NULL;
     END;
     
     -- Katman 2: user_profiles fallback (yeni — zamanlanmış bomba fix)
     IF org_id IS NULL AND auth.uid() IS NOT NULL THEN
       SELECT up.organization_id INTO org_id
         FROM public.user_profiles up
        WHERE up.auth_user_id = auth.uid()
          AND up.organization_id IS NOT NULL
        ORDER BY up.created_at DESC NULLS LAST
        LIMIT 1;
     END IF;
     
     RETURN org_id;
   END;
   $$;
   
   -- İzinler (mevcut izinleri koru)
   ALTER FUNCTION public.current_organization_id() OWNER TO postgres;
   REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated, service_role;
   ```
   
   **Desen tutarlılığı:** Bu fonksiyon `is_super_admin()` ile **aynı deseni** kullanır (SECURITY DEFINER + STABLE + SET search_path + user_profiles JOIN). İki fonksiyon birbirinin eşi — biri tenant, diğeri rol.
   
   **Rollback notu:** Eski fonksiyon SQL dilinde ve `SECURITY INVOKER` idi. Rollback script'i eski halini geri yükler:
   ```sql
   CREATE OR REPLACE FUNCTION public.current_organization_id()
   RETURNS uuid LANGUAGE sql STABLE AS $$
     SELECT nullif(coalesce(
       auth.jwt() ->> 'organization_id',
       auth.jwt() -> 'app_metadata' ->> 'organization_id',
       auth.jwt() -> 'user_metadata' ->> 'organization_id'
     ), '')::uuid;
   $$;
   ```

9. **Audit trigger hazırlığı (ertelendi):** `is_super_admin` kolonunda değişiklik olunca her zaman audit'e düşsün — ama audit_logs genişletilmiş şeması Adım 1'de hazır olacak, o yüzden **bu trigger Adım 1'den sonra eklenir**. Adım 0.5'te sadece kolon + fonksiyon + Mehmet ataması + `current_organization_id()` güçlendirmesi.

**Rollback script (Parça A):**
```sql
UPDATE public.user_profiles SET is_super_admin = false;
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP INDEX IF EXISTS public.idx_user_profiles_super_admin;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_super_admin;
DELETE FROM public.user_roles ur
 USING public.roles r
 WHERE ur.role_id = r.id AND r.code = 'super_admin';
```

#### Parça B: Backend API Auth Guard — Genişletilmiş Kapsam (7 route)

**Amaç:** API route taraması sonucu (14 route tarandı) bulunan 2 KRİTİK + 5 ORTA risk route'a auth/RBAC/tenant guard eklemek. Aynı zamanda yeniden kullanılabilir auth helper'ı kurmak.

**Tarama özeti (detay §12.5):**
- 🔴 **KRİTİK (2):** `admin-ai`, `admin-ai/learn` — service_role + auth yok → RLS bypass
- 🟡 **ORTA (5):** `analyze-risk`, `document-ai`, `document-import`, `import-employees`, `training-ai` — auth yok → anonim Anthropic API çağrısı (maliyet) + anonim data insert
- 🔵 **DÜŞÜK (5):** `slide-*` route'ları — auth var, tenant var, sadece ownership check eksik → **Adım 0.7'ye ertelendi**
- ⚪ **TEMİZ/PUBLIC (2):** `debug/runtime-check`, `env-check` — public kalıyor

**B.1 — Yeniden Kullanılabilir Auth Helper Dosyası**

Yeni dosya: `frontend/src/lib/supabase/api-auth.ts`

İçeriği üç ayrı helper:

```ts
import { createClient as createSupabaseServer } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type AuthOk = { ok: true; userId: string; organizationId: string | null };
type AuthFail = { ok: false; response: NextResponse };
type AuthResult = AuthOk | AuthFail;

/** Ortak: JWT'den authenticated kullanıcıyı çek (anon key ile doğrulama) */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token) return { user: null, token: null };
  
  const anonClient = createSupabaseServer(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  return { user, token };
}

/** 1. Sadece authenticated olması yeterli (ORTA route'lar için) */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const { user } = await getAuthenticatedUser(req);
  if (!user) {
    return { 
      ok: false, 
      response: NextResponse.json(
        { error: 'unauthorized', message: 'Bu endpoint için oturum gerekli' }, 
        { status: 401 }
      )
    };
  }
  // organization_id'yi user_profiles'tan çek (service role ile)
  const serviceClient = createSupabaseServer(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('organization_id')
    .eq('auth_user_id', user.id)
    .single();
  return { ok: true, userId: user.id, organizationId: profile?.organization_id ?? null };
}

/** 2. Super admin gerekli (KRİTİK route'lar için) */
export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult;
  
  const serviceClient = createSupabaseServer(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: isSuper, error } = await serviceClient
    .rpc('is_super_admin', { uid: authResult.userId });
  
  if (error || !isSuper) {
    return { 
      ok: false, 
      response: NextResponse.json(
        { error: 'forbidden', message: 'Bu endpoint için süper admin yetkisi gerekli' }, 
        { status: 403 }
      )
    };
  }
  return authResult;
}

/** 3. Belirli organizasyonun üyesi gerekli (import-employees gibi özel durumlar için) */
export async function requireOrgMember(req: NextRequest, targetOrgId: string): Promise<AuthResult> {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult;
  
  if (authResult.organizationId !== targetOrgId) {
    return { 
      ok: false, 
      response: NextResponse.json(
        { error: 'forbidden', message: 'Bu organizasyona erişim yetkiniz yok' }, 
        { status: 403 }
      )
    };
  }
  return authResult;
}
```

**Tasarım kararları:**
- Her helper net `401`/`403` + Türkçe hata mesajı döner (sessiz fail yok)
- `requireAuth` aynı zamanda `organization_id`'yi döner (route'ların ek sorgu yapmasını önler)
- `requireSuperAdmin` önce `requireAuth`'u çağırır (DRY)
- `requireOrgMember` tenant izolasyonu için — `import-employees` gibi özel durumlarda

**B.2 — Route'lara Guard Ekleme**

| # | Route | Guard | Ek Değişiklik |
|---|---|---|---|
| 1 | `admin-ai/route.ts` | `requireSuperAdmin` | Service role key kullanımı kaldır, anon key ile RLS üzerinden çalışsın |
| 2 | `admin-ai/learn/route.ts` | `requireSuperAdmin` | Aynı: service role → anon key |
| 3 | `analyze-risk/route.ts` | `requireAuth` | AI çağrısı authenticated kullanıcılara sınırlanır |
| 4 | `document-ai/route.ts` | `requireAuth` | AI çağrısı authenticated kullanıcılara sınırlanır |
| 5 | `document-import/route.ts` | `requireAuth` | + dosya MIME/boyut validasyonu (ek iyileştirme) |
| 6 | `import-employees/route.ts` | `requireOrgMember(targetOrgId)` | **ÖZEL DİKKAT** (bkz. B.3) |
| 7 | `training-ai/route.ts` | `requireAuth` | AI çağrısı authenticated kullanıcılara sınırlanır |

**B.3 — `import-employees` için Özel Tenant Guard**

**Risk:** Excel/CSV'den toplu personel import ediliyor. Bir kullanıcı kendi org'unun dışında başka bir org'a kayıt eklemeye çalışabilir (özellikle URL parametresi veya form field ile `target_organization_id` geliyorsa).

**Guard stratejisi:**
1. Request body'den hedef `organization_id` çek (veya kullanıcının kendi org'u default)
2. `requireOrgMember(targetOrgId)` ile kullanıcının bu org'a üye olduğunu doğrula
3. Eğer mismatch → `403`
4. Excel'den gelen her satıra `organization_id = targetOrgId` (client'tan gelen org_id değerine **güvenme**; sadece doğrulanmış değer kullanılır)
5. Her satır insert'ten önce tekrar guard edilmez (batch optimizasyonu), ancak toplu insert `.insert([...rows])` içinde her row'un `organization_id` aynı olmalı

**Pseudo-kod:**
```ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const targetOrgId = body.organization_id; // client'tan geliyor
  
  if (!targetOrgId || typeof targetOrgId !== 'string') {
    return NextResponse.json({ error: 'missing_org_id' }, { status: 400 });
  }
  
  const auth = await requireOrgMember(req, targetOrgId);
  if (!auth.ok) return auth.response;
  
  // Burada artık targetOrgId DOĞRULANMIŞ
  const rows = body.rows.map((r: any) => ({
    ...r,
    organization_id: targetOrgId,  // client'tan gelen değer değil, guard'lı değer
  }));
  
  // Insert anon key ile, RLS devreye girer → ekstra güvenlik katmanı
  const sb = createClientAnon();
  await sb.from('personnel').insert(rows);
}
```

**B.4 — Her Route Düzeltmesi İçin Öncesi/Sonrası Diff**

Parça B commit edilmeden önce, her route'un değişikliği Mehmet'e diff olarak sunulacak. Commit etmeden önce onay alınır. Toplu PR değil — route bazlı review:

```
[Review] admin-ai/route.ts değişikliği
[Review] admin-ai/learn/route.ts değişikliği
[Review] analyze-risk/route.ts değişikliği
... (7 review noktası)
```

Veya tek PR + per-file comment review — Mehmet tercih eder.

**Rollback:** `git revert` — backend değişiklikleri kod üzerinden, DB değil. Rollback = eski commit'e dön. **Ama** rollback fail-open'ı geri getirir — forward fix tercih edilir.

#### Parça C: Frontend Fail-Closed Düzeltmesi

**C.1 — `settings/page.tsx` düzeltmesi:**
- Lokal `useIsAdmin` hook'unu **tamamen sil**
- Global `@/lib/hooks/use-is-admin.ts`'i kullan **ama** email-based değil, DB-based hale getir
- `setIsAdmin(true)` fallback'leri **hepsi `setIsAdmin(false)`** olacak

**C.2 — `use-is-admin.ts` yeniden yazımı:**
```ts
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) { if (!cancelled) setIsAdmin(false); return; }
      try {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (cancelled) return;
        if (error || data !== true) { setIsAdmin(false); return; }
        setIsAdmin(true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return isAdmin;
}
```

**C.3 — Email allow-list kaldırma:**
- `FALLBACK_ADMIN_EMAILS` sabiti silinir
- `getAdminEmails()` fonksiyonu silinir
- `NEXT_PUBLIC_ADMIN_EMAILS` env var referansı silinir
- **Geçici backup:** Eski `use-is-admin.ts` dosyası `use-is-admin.ts.bak` olarak commit edilmez, sadece git history'de kalır (rollback git revert ile)

**C.4 — Etkilenen kullanım noktalarının doğrulanması (kod değişikliği gerekmez ama test):**
- `protected-shell.tsx:270` — nav gating
- `CompanyScanData.tsx:39` — scan data göster/gizle
- `digital-twin/page.tsx:75` — sayfa gating
- `settings/page.tsx` — Nova AI tab gating

Bu dosyalar `useIsAdmin()`'i çağırıyor, hook'un davranışı değiştiği için otomatik fail-closed olurlar.

#### Parça D: Geçici Önlemler

**Soru:** Adım 0.5 tamamlanana kadar admin sayfalarını **devre dışı bırakmak** mantıklı mı?

**Değerlendirme:**
- Nova AI (settings/admin_ai tab) — AI ile konuşma, şu an hem frontend hem backend açıkken herkes erişebiliyor. Büyük bir platform sır sızıntı risk yok ama rahatsız edici.
- Digital Twin page — email allow-list ile korumalı (fail-CLOSED), sadece Mehmet erişebiliyor. **Sorun değil**, yerinde kalabilir.
- Company Scan Data — aynı, email allow-list. Sorun değil.

**Önerim:** Geçici önlem gerekmez — Adım 0.5 hızlı yapılabilir (3-4 saat), bu süre boyunca mevcut email allow-list korumalı sayfalar güvende. Tek risk Nova AI tab + admin-ai route'ları, bunları **Parça B + C hemen kapatıyor**.

**Alternatif:** Adım 0.5 başlamadan önce "hızlı band-aid" olarak `settings/page.tsx:18`'de tek satır fix (`useState(true)` → `useState(false)`). 30 saniyelik iş, ama yine de Mehmet'in onayı gerek. **Öneri:** Bu band-aid'i Adım 0.5 Parça C'nin parçası olarak yap, ayrı deploy gerekmez.

### 13.3 Doğrulama Testleri

| # | Test | Beklenen | Pass Kriteri |
|---|---|---|---|
| T1 | Test Professional (ohs_specialist) olarak login, `/settings` → "Nova AI" tab var mı? | Tab **görünmez** | Tab DOM'da yok |
| T2 | Test Professional ile `/digital-twin` → | Unauthorized ekranı | HTTP 200 ama "admin değilsiniz" gösterimi |
| T3 | Test Professional JWT ile `POST /api/admin-ai` | **403 Forbidden** | Response status 403, body `{"error": "forbidden"}` |
| T4 | Anonim (auth header yok) `POST /api/admin-ai` | **401 Unauthorized** | Response status 401 |
| T5 | Mehmet (super_admin) ile `/settings` → "Nova AI" tab | Tab **görünür** ve çalışır | Tab render edilir, AdminAITab çalışır |
| T6 | Mehmet JWT ile `POST /api/admin-ai` | 200 OK + normal cevap | Mevcut davranış değişmemiş |
| T7 | SQL: `SELECT public.is_super_admin('<mehmet_uid>');` | `true` | Fonksiyon doğru dönüyor |
| T8 | SQL: `SELECT public.is_super_admin('<random_uuid>');` | `false` | Yanlış UID için false |
| T9 | SQL: `SELECT public.is_super_admin();` — auth bağlamı yokken | `false` | auth.uid() NULL → fonksiyon false |
| T10 | DB: `SELECT is_super_admin FROM user_profiles WHERE email='mehmet242306@gmail.com';` | `true` | Kolon doğru set |
| T11 | DB: aynı sorgu diğer kullanıcı için | `false` | Default value doğru |
| T12 | Mevcut test hesabıyla normal akışlar (risk analizi oluştur, kaydet, personel ekle) | Etkilenmez | Tüm normal akışlar çalışıyor |

### 13.4 Rollback Planı

**Parça A (DB migration):**
```sql
-- Yukarıdaki rollback script'i tamamen uygula
-- Etki: is_super_admin kolonu gider, fonksiyon gider, Mehmet eski haline döner
-- Yan etki: Parça B/C rollback edilmezse frontend hook'u RPC çağıramayacak, her kullanıcı isAdmin=false olur
```

**Parça B (Backend):**
```
git revert <commit_hash>
# Admin-ai route'ları eski haline döner — BU HALDE FAİL-OPEN GERİ GELİR
# Bu yüzden Parça B rollback'i yapılmaz, sorun çıkarsa ileriye doğru fix
```

**Parça C (Frontend):**
```
git revert <commit_hash>
# Email allow-list geri gelir, settings/page.tsx fail-open geri gelir
# BU ROLLBACK GÜVENLİK AÇIĞINI GERİ GETİRİR — YAPILMAZ
```

**Kural:** Adım 0.5 rollback'i **sadece Parça A DB tarafında** yapılır, o da testler fail ederse. Parça B ve C rollback yok — forward fix.

**Kritik senaryolar:**
| Senaryo | Aksiyon |
|---|---|
| Parça A migration hata verdi | Otomatik rollback (transaction), düzelt, tekrar dene |
| Parça B test T3/T4 fail (forbidden dönmüyor) | Sorun helper kodunda — debug + düzelt, tekrar deploy |
| Parça C test T1 fail (tab hâlâ görünüyor) | Hook çağrısı eski yerde kalmış olabilir, grep + düzelt |
| Mehmet giriş yapamıyor (T5 fail) | is_super_admin fonksiyonu doğru dönmüyor; SQL T7 çalıştır, auth.uid() doğru geliyor mu kontrol et |
| Tüm T'ler pass ama Digital Twin çalışmıyor | protected-shell.tsx'te useIsAdmin hâlâ eski email listesi yakın kontrol ediyor — değişiklik doğru mu bak |

### 13.5 Adım 0.5 Karar Bekleyen Noktalar

1. **"Geçici band-aid" şimdi mi, Parça C içinde mi?** → Önerim: Parça C içinde (ayrı deploy yapmaya değmez)
2. **Diğer 12 API route için tarama kapsamı** → Önerim: Parça B başında 30 dakikalık hızlı tarama, service_role veya auth kontrolü eksik olanlar listelenir, Mehmet'e raporlanır, ayrı PR yapılır (Adım 0.5'in kapsamına girmez, takip edilir)
3. **Mehmet dışında başka super_admin olacak mı?** → Şu an sadece 2 test hesabı var, biri "Test Professional" olarak kalır. İleride ekip üyeleri için super_admin ataması manuel SQL ile yapılır
4. **Super admin olayları audit'e girecek mi (hassas değişiklik)?** → Audit_logs genişletilmiş şeması Adım 1'de, yani bu trigger Adım 1'den sonra eklenebilir. Şimdilik Parça A'nın kendisi (migration) manuel log olarak commit mesajında kalır

---

## 14. Adım 0.7 — Frontend Tenant Hazırlığı (Q5 Düzeltmeleri)

> **Durum:** ⏸ Karar bekleniyor — Adım 0.5 onaylandıktan ve uygulandıktan sonra başlar.
> **Amaç:** Adım 3 Grup 1'de `organization_id` NOT NULL yapılabilmesi için tüm frontend INSERT'lerinin org_id set etmesini sağlamak + savunma için UPDATE guard'ları + hard delete'leri soft delete'e çevirme.
> **Süre:** 4-6 saat
> **Bağımlılık:** Adım 0.5 (Parça A DB migration, çünkü `is_super_admin()` fonksiyonu super admin guard ihtiyaçlarını karşılar).

### 14.1 Kapsam Özeti

42 düzeltme noktası (detaylar §12.3'te):
- **P0 — 13 INSERT org_id eksik** (kritik, Adım 3 öncesi zorunlu)
- **P1 — 21 UPDATE tenant guard eksik** (defense-in-depth, iyi uygulama)
- **P2 — 5 hard delete → soft delete** (pilot sonrası, Adım 3 ile birlikte)

Adım 0.7 **sadece P0 ve P1**'i kapsar. P2 Adım 2/3 ile senkronize yapılır (çünkü soft delete kolonları henüz tablolarda yok).

### 14.2 P0 — INSERT Düzeltmeleri (13 nokta)

| # | Dosya:satır | Tablo | Düzeltme |
|---|---|---|---|
| 1 | `incident-api.ts:485-493` | `incident_witnesses` | Parent `incidents`'tan org_id al, insert'e ekle |
| 2 | `incident-api.ts:674` | `incident_personnel` | Spread sonrası `organization_id: incident.organization_id` override |
| 3 | `incident-api.ts:703` | `incident_personnel` | `.map()` içinde org_id ekle |
| 4 | `document-api.ts:165` | `editor_document_versions` | Parent editor_documents'tan al |
| 5 | `document-api.ts:247` | `document_signatures` | Parent editor_documents'tan al |
| 6 | `survey-api.ts:268` | `survey_questions` | Parent surveys'ten al |
| 7 | `survey-api.ts:283` | `survey_tokens` | Parent surveys'ten al |
| 8 | `survey-api.ts:313` | `survey_responses` | Parent surveys'ten al |
| 9 | `slide-deck-api.ts:296` | `slides` | Parent slide_decks'ten al |
| 10 | `slide-deck-api.ts:357` | `slides` | Parent slide_decks'ten al |
| 11 | `training-slides-ai/route.ts:171` | `slides` | Parent slide_decks'ten al (deck yeni oluşturulmuş, elde org_id var) |
| 12 | `slide-deck-import/route.ts:201` | `slides` | Aynı |
| 13 | `slide-single-ai/route.ts:149` | `slides` | Aynı |
| 14 | `InviteProfessionalModal.tsx:222` | `workspace_invitations` | Parent company_workspaces'ten al |

**Kategori C'ye bağlı 3 nokta** (Mehmet karar verecek):
- `admin-ai/route.ts:151` → `ai_qa_learning` (Kategori C)
- `admin-ai/route.ts:161` → `ai_user_interactions` (Kategori C)
- `admin-ai/learn/route.ts:187` → `ai_learning_sessions` (Kategori C)

`admin-ai/learn/route.ts:164` → `ai_knowledge_base` **GLOBAL** (Kategori B), **düzeltme gerek yok**.

**Yardımcı fonksiyon (DRY):**

`frontend/src/lib/supabase/tenant-helpers.ts` (yeni dosya):
```ts
import { createClient } from '@/lib/supabase/client';

/**
 * Parent tablodan organization_id çözer.
 * Tenant-aware insert'lerde kullanılır.
 */
export async function resolveParentOrgId(
  parentTable: string,
  parentId: string
): Promise<string> {
  const sb = createClient();
  if (!sb) throw new Error('supabase client unavailable');
  const { data, error } = await sb
    .from(parentTable)
    .select('organization_id')
    .eq('id', parentId)
    .single();
  if (error || !data?.organization_id) {
    throw new Error(`parent ${parentTable}/${parentId} org_id resolve failed`);
  }
  return data.organization_id;
}
```

Kullanım:
```ts
const orgId = await resolveParentOrgId('slide_decks', deck_id);
await sb.from('slides').insert({ deck_id, index, content, organization_id: orgId });
```

### 14.3 P1 — UPDATE Tenant Guard (21 nokta)

**Düzeltme deseni:**
```ts
// Öncesi
await sb.from('incidents').update(payload).eq('id', incidentId);

// Sonrası
await sb.from('incidents').update(payload).eq('id', incidentId).eq('organization_id', orgId);
```

**orgId kaynağı:** Mevcut akışta genelde context'ten (`auth.orgId`, props) geliyor. Eğer yoksa önce resolve et:
```ts
const { data: { user } } = await sb.auth.getUser();
const { data: prof } = await sb.from('user_profiles').select('organization_id').eq('auth_user_id', user.id).single();
```

**21 nokta:** §12.3 tablosundan. Dosya bazında gruplanmış:
- `incident-api.ts` — 3 UPDATE (satır 448, 556, 619)
- `personnel-api.ts` — 3 UPDATE (satır 354, 383, 427)
- `document-api.ts` — 4 UPDATE (satır 127, 206, 319, 347)
- `certificate-api.ts` — 1 UPDATE (184)
- `question-bank-api.ts` — 1 UPDATE (117)
- `tracking-api.ts` — 2 UPDATE (201, 316)
- `risk-assessment-api.ts` — 2 UPDATE (649, 828)
- `slide-deck-api.ts` — 2 UPDATE (240, 370)
- `OrganizationPanel` — 3 UPDATE (211, 221, 230)
- `TeamManagementTab` — 1 UPDATE (516)
- `InviteProfessionalModal` — 1 UPDATE (188) — workspace_invitations, guard workspace_id üzerinden

### 14.4 Test Stratejisi

**Frontend build + E2E:**
1. `npm run lint` — hata yok
2. `npm run build` — PASS
3. **Manuel akış testleri (Mehmet + Test Professional):**
   - Risk analizi oluştur → kaydet → düzenle → kaydet
   - Olay oluştur → tanık ekle → personel ekle → DOF/Ishikawa ekle → güncelle
   - Anket oluştur → soru ekle → token oluştur → cevap simüle et
   - Slayt deck oluştur → slayt ekle → güncelle
   - Döküman oluştur → versiyon kaydet → imza ekle
   - İşyeri daveti gönder
4. **Cross-tenant test (iki kullanıcı):**
   - Mehmet bir risk analizi oluşturur (org 6cb4ceca...)
   - Test Professional başka bir org'a aitmiş gibi davranamıyor (aynı org'dalar, bu yetmez — ileride ikinci org oluştur)
   - UPDATE guard'larının gerçekten çalıştığı: Mehmet başkasının id'sini bilse bile o kaydı güncelleyemez (Test Professional için aynı)
5. **SQL denetim:** Tüm yeni INSERT'lerde organization_id gerçekten dolu geliyor mu:
   ```sql
   SELECT count(*) FROM public.incident_witnesses WHERE organization_id IS NULL;
   -- Beklenen: 0
   ```

### 14.5 Adım 1 ile Senkronizasyon

**Önemli:** Adım 0.7 tamamlanmadan Adım 1 başlamamalı çünkü:
- Adım 1'de `audit_trigger_func()` yazılacak ve pilot tabloya bağlanacak (Adım 2)
- Pilot tabloda yeni insert'ler geldiğinde `organization_id` dolu olması lazım
- Eğer Adım 0.7 yoksa, insert'lerden bazıları NULL org_id ile gelebilir → audit_log'a NULL org_id düşer → tenant ayrımı bozulur

**Sıra:**
1. Adım 0.5 Parça A (DB migration) → onay + uygula
2. Adım 0.5 Parça B/C (backend + frontend kod) → onay + deploy
3. Adım 0.5 testler PASS → bir gün bekle
4. Adım 0.7 frontend kod değişiklikleri → onay + deploy
5. Adım 0.7 testler PASS → bir gün bekle
6. Adım 1 DB migration başlar

### 14.6 Rollback

**Frontend-only değişiklikler** — DB migration yok, rollback `git revert <commit>`. Adım 0.5 korunur.

### 14.7 Adım 0.7 Karar Bekleyen Noktalar

1. **21 UPDATE guard'ını tek PR mi ayrı PR'lar mı?** → Önerim: Dosya bazında (9-10 dosya), her biri 1-2 dakikalık review
2. **P1 şimdi mi sonra mı?** → Önerim: Şimdi (Adım 0.7 içinde). Defense-in-depth maliyetsiz eklenir.
3. **P2 (hard delete → soft delete) ne zaman?** → Pilot tablodan sonra Adım 2b, soft delete kolonları orada hazır olur
4. **`resolveParentOrgId` helper'ı kullanılacak mı?** → Önerim: Evet, DRY için. Test yazmak da kolay olur.
5. **Adım 0.7 içinde `is_super_admin` kontrollerini frontend'e eklemek mi?** → Hayır, o Adım 0.5'in işi. Adım 0.7 sadece tenant guard'lar.

### 14.8 Ownership Check Karar Maddesi (DÜŞÜK Risk slide-* Route'ları)

**Bağlam:** §12.5 (API route taraması) sonucunda 5 route "DÜŞÜK" olarak sınıflandırıldı — auth var, tenant izolasyonu var, ama **ownership check yok**:

| Route | Tenant Guard | Ownership Check |
|---|---|---|
| `slide-deck-export` | ✅ deck sorgusu org_id'li | ❌ `created_by` kontrolü yok |
| `slide-deck-import` | ✅ | ❌ |
| `slide-media-upload` (GET) | kısmi (org_id filtresi) | ❌ user_id filtresi yok |
| `slide-single-ai` | ✅ | ❌ |
| `training-slides-ai` | ✅ | ❌ |

**Soru:** Aynı organizasyondaki başka bir kullanıcı (örn. Mehmet'in org'undaki ikinci ISG uzmanı) Mehmet'in oluşturduğu bir slayt deck'ini export edebilmeli mi?

**Mehmet'in ilk düşüncesi (2026-04-11):**
> Org içi paylaşım kasıtlı, ownership check gerekmez, ama "aynı org'da" guard'ı kesinlikle olmalı.

**Karar:** ⏸ **Adım 0.7 sonunda gözden geçirilecek.** Şu an için ownership check eklenmez (tenant guard yeterli kabul edilir). Ancak:
- Her route'da mevcut `org_id` guard'ının gerçekten çalıştığı **doğrulanmalı** (kod okuma + manuel test)
- `slide-media-upload` GET endpoint'inde org_id filtresinin gerçekten olduğu teyit edilmeli (tarama "kısmi" dedi)
- Adım 0.7 bitiminde "ownership check ihtiyacı tespit edildi mi?" olarak bir gözden geçirme

**Gelecek "Özel slayt paylaşım" ihtiyacı doğarsa:**
- Ayrı `slide_deck_shares` tablosu (owner, shared_with_user_id veya shared_with_role)
- Bu Adım 0.5/0.7 kapsamında değil — gelecek feature

**Adım 0.7 tamamlanmadan önce son kontrol listesi:**
- [ ] 5 DÜŞÜK route'un her biri için org_id guard kod seviyesinde doğrulandı
- [ ] `slide-media-upload:108-112` GET endpoint org_id filtresi teyit edildi  
- [ ] "Şu an ownership check gerekmiyor" kararı belgede dondurulduğu an: _____________________
- [ ] Gelecek "özel paylaşım" ihtiyacı için backlog'a not eklendi

---

## 15. Ek — Admin Panel Ekranları (Gelecek)

Bölüm 1 tamamlandığında (Adım 3 sonu) aşağıdaki admin ekranları kurulabilir. Bu **Bölüm 2** kapsamı, şimdi değil:

1. Şema sağlığı (`_audit.audit_tenant_isolation()` çıktısı)
2. Audit log explorer (filtre + export)
3. Çöp kutusu (soft deleted listesi, restore)
4. Performans (pg_stat_statements top 20 slow query)
5. Backup yönetimi (son yedekler, manuel yedek, restore)
6. Migration geçmişi
7. Veri kalitesi raporu
8. Tenant izolasyon denetimi

---

## 16. İlerleme İzleme

| # | Adım | Durum | Notlar |
|---|---|---|---|
| 0 | Bu doküman | ✅ Taslak v2 hazır | Mehmet'in onayı bekleniyor — Q3/4/5/9 + Adım 0.5/0.7 eklendi |
| **0.5** | **Acil güvenlik düzeltmesi** (§13) | **⏸ Bekliyor — ACİL** | **Fail-open + service_role route'lar** |
| **0.7** | **Frontend tenant hazırlığı** (§14) | **⏸ Bekliyor** | **42 düzeltme, P0+P1** |
| 1 | Adım 1 — altyapı | ⏸ Bekliyor | Adım 0.5 + 0.7 tamamlanmalı |
| 2a | Pilot A (team_categories) | ⏸ Bekliyor | |
| 2b | Pilot B (risk_assessment_findings) | ⏸ Bekliyor | |
| 3a | Grup 1 — tenant-core | ⏸ Bekliyor | Q4 Kategori C kararları gerekli |
| 3b | Grup 2 — operational | ⏸ Bekliyor | |
| 3c | Grup 3 — supporting | ⏸ Bekliyor | |
| 4 | JWT org_id claim | ⏸ Bekliyor | Auth Hook |
| 5 | Tiplerin sıkılaştırılması (`ip_address` vs) | ⏸ Sonra | Düşük öncelik |
| 6 | Staging ortamı kurulumu (Gelecek iş) | ⏸ Sonra | Canlı müşteri öncesi |
| **7** | **Yedekleme altyapısı kurulumu** (§17) | **⏸ Adım 2 öncesi** | **Docker veya pg_dump kurulumu** |

---

## 17. Yedekleme Altyapısı (Yapılacak)

**Durum:** ⏸ Karar ve aksiyon bekliyor — Adım 2 (pilot tablo) öncesi tamamlanmalı
**Tarih:** 2026-04-11'de eklendi

### Mevcut Durum

Parça A yedeği için `npx supabase db dump --linked` denendi, **Docker Desktop gerektirdiği** için başarısız oldu (Docker kurulu değil). Windows'ta `pg_dump` ve `psql` de kurulu değil. Bu yüzden Parça A için **mantıksal yedek** (MCP üzerinden SQL snapshot'ları) alındı.

### Risk

Mantıksal yedek bilinen değişiklikleri geri almak için yeterlidir, ancak:

- "Her şeyi geri al" senaryosu (beklenmedik bir şey olursa) mümkün değil — sadece bilinen kolonlar, satırlar ve fonksiyonlar geri alınabilir
- Trigger'lar, indeks'ler, RLS policy'leri, extension'lar, sequence'ler gibi yan efektler otomatik dump'a dahil değil
- Büyük ölçekli migration'lar (pilot tablo → batch rollout) için bu yeterli olmayacak

### Çözüm Seçenekleri

**Seçenek A — Docker Desktop kur**
- Avantaj: `npx supabase db dump --linked` otomatik çalışır, CLI'nin diğer özellikleri de açılır (local dev, seed, migration apply)
- Dezavantaj: Docker Desktop Windows'ta 1-2 GB alan, arka planda sürekli çalışır
- Süre: 30 dk kurulum

**Seçenek B — PostgreSQL client tools kur (pg_dump dahil)**
- Avantaj: Sadece 100-200 MB, arka plan yok, `pg_dump` ile tam dump alınır
- Dezavantaj: Supabase CLI'nin diğer özelliklerine erişim vermez, ayrı bir araç
- Süre: 15 dk kurulum
- İndirme: https://www.postgresql.org/download/windows/ (sadece command-line tools)

**Seçenek C — Ikisi de kur**
- En kapsamlı ama en fazla alan

### Karar Deadline

**Adım 2 (pilot tablo) öncesi** — pilot tablo değişikliği daha geniş kapsamlı olacağı için tam pg_dump şart. Adım 0.5 tamamlandıktan sonra Mehmet ile birlikte karar verilecek.

### Adım 0.5 İçin Tazminat

Bu eksik nedeniyle Adım 0.5 yedek yapısı mantıksal olarak genişletildi:
- `backups/pre_step05a_YYYYMMDD_HHMMSS/` klasörü
- 00-06 numaralı 7 dosya + 99_restore_instructions.md
- Her dosyanın SHA256 hash'i
- Manifest + backup_log.md

Detay: `backups/pre_step05a_*/00_metadata.md`

### Mehmet'e Hatırlatma

Adım 0.5 tamamlandıktan sonra bu konuyu birlikte konuş:
> "Docker Desktop kuralım mı, yoksa PostgreSQL client tools mu? Adım 2 pilotundan önce karar."

Bu belge §16 İlerleme İzleme tablosunda **Adım 7** olarak takip ediliyor.

---

## 18. Tutarlılık İyileştirmeleri Backlog

**Durum:** ⏸ Kayıt altında, şimdi dokunulmuyor (Parça A kapsamı dışı)
**Tarih:** 2026-04-11'de eklendi

### Tespit

Adım 0.5 Parça A öncesi araştırmada, public şemasındaki 5 helper fonksiyonun `SET search_path` ayarında tutarsızlık tespit edildi:

| Fonksiyon | Mevcut `search_path` | Kaynak |
|---|---|---|
| `current_organization_id()` | `''` (boş) | Parça A ile zaten bu standartta |
| `current_user_organization_id()` | `'public'` | `20260318_001_company_identity_workspace_shared_ops.sql` |
| `current_user_email()` | `'public'` | `20260320_002_company_invites_permissions_archive_delete.sql` |
| `is_company_member(uuid)` | `'public'` | `20260318_001_company_identity_workspace_shared_ops.sql` |
| `is_company_approver(uuid)` | `'public'` | `20260318_001_company_identity_workspace_shared_ops.sql` |

### Hedef

Hepsi `SET search_path TO ''` standardına geçsin. Bu, search-path injection saldırılarına karşı daha güçlü koruma sağlar ve fonksiyon içindeki tüm referansların tam şema yolu ile yazılmasını zorunlu kılar.

### Risk

**Düşük.** Mevcut fonksiyonların gövdeleri zaten `public.` prefix'i ile yazılmış (çoğunlukla), yani `= 'public'` → `= ''` değişimi davranışı bozmaz. Değiştirilecek tek şey `SET search_path` değeri. CREATE OR REPLACE ile güvenle güncellenebilir, signature değişmediği için bağlı olan RLS policy'ler ve çağıran kodlar etkilenmez.

**Uyarı:** Fonksiyon gövdesinde schema-qualified olmayan referans varsa (örn. sadece `user_profiles`, `public.user_profiles` değil), `search_path = ''` ile çalışmayı durdurur. Her fonksiyonun gövdesi değişiklik öncesi tek tek denetlenmeli.

### Zamanlama

**Parça B sonrası veya Adım 1 öncesi** bir "süpürge" migration'ı. Parça A'nın success path'i tamamlandıktan sonra, kritik yoldaki işler bitince mini bir cleanup migration'ı:

```
supabase/migrations/YYYYMMDDHHMMSS_stepXX_consistent_search_path.sql
```

### Şu an dokunmuyoruz

Parça A kapsamı dışı, bilinçli erteleme. Bu backlog maddesini Parça B ve Adım 1 arasındaki geçişte hatırla.

### Şimdi Yapılacak (bilgi toplama)

- [ ] Her 4 fonksiyonun gövdesini ayrı ayrı incele — schema-qualified mi?
- [ ] Test senaryosu yaz: fonksiyon güncelleme öncesi/sonrası aynı sonucu dönmeli
- [ ] Migration dosyası taslağını hazırla ama uygulama (§18 → §18a'ya alt madde)

---

## 19. Parça A Sonrası Tespit Edilen Notlar

**Tarih:** 2026-04-11
**Kaynak:** Adım 0.5 Parça A uygulama sonrası edge case testleri

### 19.1 Orphan Auth User

**Tespit:** `auth.users` tablosunda `mehmetyildirim063423@gmail.com` (uid: `5a08e683-3d62-46ee-b2d5-c0ea28164e31`) kaydı mevcut ama `public.user_profiles` tablosunda karşılığı yok.

**Nasıl oluştu?** Muhtemelen kullanıcı Supabase Auth üzerinden kayıt oldu ama frontend veya bir trigger `user_profiles` kaydı oluşturmadı. Signup akışında bu eksiklik sessiz bir bug.

**Parça A için etkisi:** Yok — `current_organization_id()` fonksiyonu Katman 1 (JWT `app_metadata`) üzerinden `6cb4ceca-...` döner, orphan user yine de RLS policy'lerinden geçebilir.

**Kullanıcı oturum açarsa ne olur?**
- `current_organization_id()` → `6cb4ceca-...` (Katman 1)
- RLS policy'leri → çalışır
- Ama uygulamanın çoğu kodu `user_profiles` JOIN yapıp `full_name`, `title`, `avatar_url` vb. okuyor → bu alanlar `null` dönecek
- UI büyük olasılıkla kırılır (undefined reference, null.x hataları)

**Daha büyük sorun — Signup Trigger Eksikliği:**
Projede `auth.users` için `handle_new_user` benzeri bir trigger YOK. Bu yüzden:
- Her yeni kayıt manuel olarak veya frontend kodu tarafından `user_profiles` oluşturmaya bağımlı
- Frontend atlarsa (bug, race condition, hata), orphan user oluşur
- Sistem şu an kırılgan

**Yapılacak:**

**Kısa vadeli (Adım 0.7 sonu veya Adım 1 başı):**
- Orphan user (`5a08e683-...`) için karar: ya manuel `user_profiles` kaydı oluştur, ya da auth.users'dan sil
- Önerim: `user_profiles` kaydı oluştur (veri kaybetmemek için), test kullanıcısı olarak organizasyona bağla

**Uzun vadeli (Adım 1 kapsamı):**
- `auth.users AFTER INSERT` trigger'ı yaz: `handle_new_user()`
- Trigger yeni kullanıcı için otomatik `user_profiles` kaydı oluşturmalı (minimum: `id`, `auth_user_id`, `email`, `organization_id`)
- `organization_id` kaynak nereden? — şimdilik karmaşık, ileride JWT claim veya signup flow'un bir parçası
- Bu trigger Adım 1 altyapısında "standart trigger'lar" kapsamında ele alınacak

**Bu nota Adım 1 planı (§3) içinde hatırlatıcı konulmalı.**

### 19.2 `current_organization_id()` Service Role Davranışı

**Tespit:** Service role ile (Edge Function, backend admin route, MCP SQL Editor) `current_organization_id()` çağrılırsa `NULL` döner.

**Neden?**
- `auth.jwt()` → NULL (JWT yok, service role doğrudan bağlantı)
- Katman 1 → NULL
- `auth.uid()` → NULL
- `WHERE auth_user_id = NULL` → 0 satır → NULL
- `COALESCE(NULL, NULL)` → NULL

**Bu doğru davranıştır, sorun değil.** Service role bağlamında otomatik tenant filtreleme olmamalı — eğer bir service role kodu "aktif kullanıcının org'unu" istiyorsa, kullanıcı kimlik bilgisini açıkça geçirmeli.

### 19.3 Parça B Tasarım Notları (bu bulgulardan türetildi)

Parça B'de `lib/supabase/api-auth.ts` helper'ı yazılırken:

**1. Service role kullanım yeri:**
- `requireAuth()` ve `requireSuperAdmin()` helper'ları kullanıcının JWT'sini **anon key** ile doğrulamalı (`supabase.auth.getUser()` üzerinden)
- Sadece `is_super_admin()` RPC çağrısı için service role kullanılır (kullanıcının doğrulanmış kimliği ile)
- Tenant filtreleme kullanıcı bağlamında yapılmalı, asla service role ile "varsayılan" tenant filtresi uygulanmamalı

**2. `requireOrgMember()` tasarımı:**
- JWT'den `auth.uid()` al (anon key client ile)
- `user_profiles` tablosundan `organization_id`'yi service role ile sorgula (çünkü kullanıcının kendi profiline erişim zaten RLS ile vardır ama service role daha deterministic)
- Fonksiyon parametresi olarak `targetOrgId` verilirse, kullanıcının bu org'a üye olduğunu doğrula
- Verilmezse kullanıcının **kendi** org'unu döndür

**3. `import-employees` için özel davranış:**
- Request body'den gelen `organization_id` değerine **güvenilmez**
- Kullanıcının kendi `organization_id`'si (helper tarafından `user_profiles`'tan çözülmüş) kullanılır
- Eğer request body'de bir `organization_id` varsa ve kullanıcının org'undan farklıysa → `403 Forbidden`
- Yeni personel kayıtlarına **her zaman** helper tarafından çözülmüş `organization_id` yazılır, request body'deki değil

**4. Orphan user durumu:**
- `requireAuth()` çağrısı sırasında user_profiles bulunamazsa → `403` (normal "giriş yapılmamış" değil, "profil eksik" spesifik hatası)
- Hata mesajı: "Kullanıcı profiliniz bulunamadı. Lütfen yönetici ile iletişime geçin."
- Bu durum nadir ama kırılma noktasıdır — silent fail yerine açık hata

Bu üç nokta §13.2 Parça B'deki helper tasarımını güncelledi.

---

> **Not:** §21 (Dependency Çakışmaları Backlog), §23 (rezerve) — bu numaralar ileride doldurulacak.

---

## 20. Test Altyapısı

**Durum:** ✅ Kuruldu (2026-04-11)
**Framework:** Vitest 2.1.x
**Kapsam:** Başlangıçta sadece `frontend/src/lib/supabase/api-auth.ts`, ileride genişleyecek

### Kurulum

```bash
cd frontend
npm i -D vitest @vitest/ui @vitest/coverage-v8
```

### Komutlar

| Komut | Amaç |
|---|---|
| `npm run test` | Tek seferlik çalıştırma (CI için) |
| `npm run test:watch` | Watch mode (geliştirme sırasında) |
| `npm run test:ui` | Görsel web UI ile çalıştırma |
| `npm run test:coverage` | Coverage raporu (v8 provider) |

### Dosya Yapısı

```
frontend/
├── .npmrc                              # legacy-peer-deps=true (web-ifc-three çakışması)
├── vitest.config.ts                    # Vitest konfigürasyonu
├── package.json                        # test scriptleri ekli
└── src/
    └── lib/
        └── supabase/
            ├── api-auth.ts              # Helper (390 satır)
            └── api-auth.test.ts         # 24 unit test
```

### Mock Stratejisi

- `vi.mock("@supabase/supabase-js")` ile `createClient` mock'lanır
- Her test kendi mock davranışını ayarlar (`mockResolvedValue`, `mockImplementation`)
- Environment variables her test için fresh (`vi.stubEnv`, `vi.unstubAllEnvs`)
- `clearMocks: true` ile her testten sonra mock state sıfırlanır
- Query chain'ler için `buildQueryChain()` yardımcısı — `.select().eq()...maybeSingle()` desenini simüle eder

### Coverage Hedefi

| Kod | Hedef |
|---|---|
| `lib/supabase/api-auth.ts` (kritik güvenlik helper'ı) | **%100** |
| Diğer `lib/supabase/*` helper'lar | Pilot sonrası belirlenecek |
| Tüm kod tabanı | Uzun vadede %70+ |

### Mevcut Test Sayıları (2026-04-11)

| Dosya | Suite | Test Sayısı |
|---|---|---|
| `api-auth.test.ts` | requireAuth | 11 |
| `api-auth.test.ts` | requireSuperAdmin | 5 |
| `api-auth.test.ts` | requireOrgMember | 6 |
| `api-auth.test.ts` | timeout protection | 2 |
| **TOPLAM** | | **24** |

### Gelecekte Eklenecek Test Türleri

1. **RLS policy testleri** — Adım 3 batch rollout sırasında, cross-tenant izolasyonu doğrulamak için (pgTAP veya özel fonksiyonlar, Vitest değil)
2. **R₂D hesaplama mantığı** — risk skorlama logic'i unit testleri
3. **Mevzuat eşleşme algoritması** — Solution Center RAG sistemi için
4. **PDF/PPTX/DOCX üretim pipeline'ları** — snapshot testler
5. **API route entegrasyon testleri** — gerçek HTTP çağrıları ile (Parça B sonrası T1-T12 otomatikleştirilmesi)
6. **React bileşen testleri** — Vitest + `@testing-library/react` + jsdom (ileride `environment: "jsdom"`)

### Test Yazma Kuralları

1. **Her testin tek bir amacı olsun** — bir assertion fail olursa test amacını anlatmalı
2. **Mock'lar minimum olsun** — gerçek davranışı yansıtsın, "uydurma" değil
3. **Test adları net açıklayıcı** — `it("returns 401 when token is missing")` gibi
4. **Discriminated union type narrowing** — `if (!result.ok) return;` deseni ile TypeScript hataları engellenir
5. **Flaky test YOK** — zamanlamaya bağlı test varsa `vi.useFakeTimers()` kullanılmalı
6. **Her test izole** — `beforeEach`'te fresh state, `afterEach`'te temizlik

### Karar Bekleyen Noktalar

- **CI entegrasyonu:** Şu an testler lokalden çalıştırılıyor. İleride GitHub Actions workflow ile otomatik test (`.github/workflows/frontend-test.yml` gibi). Canlı öncesi.
- **Coverage threshold:** `vitest.config.ts`'de `coverage.thresholds` ile minimum coverage zorunluluğu. Şu an yok, ileride %80 gibi bir eşik konulabilir.
- **Test parallelization:** Vitest paralel çalıştırır ama bazı testler env stub yüzünden çakışabilir. Şimdi sorun yok, ölçek büyürse `poolOptions.threads.singleThread` gerekebilir.

---

## 22. Bekleyen Pre-existing Değişiklikler — Çözüm Uygulandı

**Tespit:** 2026-04-11, Parça B Vitest kurulumu sırasında `git status`'te 100+ modified dosya bulundu.
**Çözüm uygulandı:** 2026-04-11, worktree + iki ayrı branch yöntemi ile. Hiçbir iş kaybolmadı.

### Başlangıç Durumu

- **Stash:** `stash@{0}` — mesaj: "Puantaj sistemi: Memur bordrosu, Excel/PDF export, arşiv ve ayarlar", baz commit: `f24f284`
- **Working dir:** 32 gerçek content diff (canlı saha analizi), 95 CRLF-only hayalet
- **Çakışma:** İki iş 12 dosyada çakışıyordu (özellikle `company-api.ts`)

### Branch 1: `feature/stash-recovery-pre-step05`

**Commit hash:** `206cdbb`
**Yöntem:** Git worktree üzerinden oluşturuldu (git stash branch çalışma dizini temiz olmadığı için reddetti)

**İçerik — 32 dosya, +3504 / -61 satır:**

Stash mesajı "Puantaj sistemi" diyordu ama **gerçek içerik tamamen farklı**:

**Yeni Dosyalar (12):**
- `frontend/src/lib/mevzuat-scraper.ts` — mevzuat tarama altyapısı
- `frontend/src/lib/mevzuat-search.ts` — mevzuat arama
- `frontend/src/lib/company-directory.ts` — şirket dizini
- `frontend/src/lib/company-types.ts` — tip tanımları
- `frontend/src/app/(protected)/solution-center/` — Çözüm Merkezi sayfaları (SolutionCenterClient, page)
- `frontend/src/app/api/solution-center/` — Çözüm Merkezi API (generate, search)
- `frontend/src/app/api/sync/mevzuat/` — mevzuat sync endpoint'leri (+ embeddings)
- `frontend/src/app/(protected)/settings/MevzuatSyncTab.tsx` — mevzuat senkronizasyon tab'ı
- `frontend/src/components/companies/CompanyRelationshipsTab.tsx` — şirket ilişkileri
- `frontend/src/types/speech-recognition.d.ts`

**Değiştirilmiş Dosyalar (20):** `package.json` (Anthropic SDK + pdf-parse eklemeleri), `package-lock.json`, settings/page, layout dosyaları (auth-shell, protected-shell, public-header), button, globals.css, company-api.ts, 8+ sayfa dosyası

**ÖNEMLI — Bu çok değerli bir iş:** Bu stash **RiskNova'nın çekirdek özelliklerini** içeriyor — mevzuat altyapısı (Resmî Gazete + KVKK vb. mevzuat metinlerinin scrape/search/embed), Çözüm Merkezi (RAG + Citations + generate API), şirket dizini. Mehmet hatırlamasa bile bu iş **yüksek öncelikli inceleme** gerektirir.

### Branch 2: `feature/canli-saha-mobil-web-entegrasyonu`

**Commit hash:** `752bd91`
**Yöntem:** Normal branch + explicit file staging (CRLF hayaletlerini dışarıda tutmak için)

**İçerik — 27 dosya, +736 / -331 satır:**
- `analyze-risk/route.ts` — risk analizi API (Parça B'nin 0.5.B'de düzelteceği dosya!)
- `risk-assessment-api.ts` — risk değerlendirme API helper
- `dashboard/DashboardClient.tsx`, `dashboard/actions.ts`
- `settings/AdminAITab.tsx` — Admin AI tab bileşeni
- `companies/` altında 4 dosya (WorkspaceTabs, OrganizationPanel, TeamManagementTab, InviteProfessionalModal)
- `documents/` altında 4 dosya (ShareModal, SignatureModal, AIAssistantPanel, EditorToolbar)
- `DocumentsClient`, `DocumentEditorClient`, `PersonalDocumentsClient`
- `planner/PlannerClient`, `profile/ProfileClient`, `risk-analysis/RiskAnalysisClient`
- `auth/callback/route.ts`, `login/actions.ts`
- `timesheet/TimesheetClient.tsx` (kaynak belirsiz, Puantaj olabilir)
- `supabase/functions/solution-chat/index.ts` — Edge Function
- `globals.css`

**Mehmet'in aktif yarım işi** — mobil uygulama ile web arasında canlı saha analizi entegrasyonu. TimesheetClient.tsx muhtemelen Puantaj sisteminden artık, Adım 0.7 incelemesi sırasında ayrıştırılmalı.

### Çakışma Yönetimi

**12 ortak dosya** iki işte de değişmişti:
`.claude/settings.local.json`, `frontend/next-env.d.ts`, `frontend/package-lock.json`, `frontend/package.json`, `CompaniesListClient.tsx`, `CompanyWorkspaceClient.tsx`, `PlannerClient.tsx`, `ProfileClient.tsx`, `RiskAnalysisClient.tsx`, `globals.css`, `WorkspaceTabs.tsx`, `company-api.ts`

**Çözüm:** İki branch **farklı baz commit'lerden** oluşturuldu:
- `feature/stash-recovery-pre-step05` → `f24f284` (eski, stash base)
- `feature/canli-saha-mobil-web-entegrasyonu` → `e93d6da` (mevcut main HEAD)

Bu şekilde hiçbir merge conflict yaşanmadı, her iki iş temiz olarak paralel branch'lere taşındı.

### Aksiyon Planı (Adım 0.5 Parça B/C sonrası)

1. 🔴 **YÜKSEK ÖNCELİK:** `feature/stash-recovery-pre-step05` branch'ini incele
   - Mevzuat scraper/search altyapısı hâlâ ihtiyaç mı?
   - Çözüm Merkezi implementasyonu mevcut Çözüm Merkezi ile tutarlı mı?
   - Anthropic SDK + pdf-parse paket sürümleri güncel mi?
2. 🟡 `feature/canli-saha-mobil-web-entegrasyonu` branch'ini incele
   - Mobil-web entegrasyonu ne kadar yakın bitmeye?
   - TimesheetClient.tsx neden burada?
3. İki branch arasındaki 12 dosya çakışmasını dosya dosya çöz (özellikle `company-api.ts` — hem stash +183 satır hem canli saha değişikliği)
4. **Adım 0.7 ile çakışma kontrolü:**
   - `analyze-risk/route.ts` canli-saha branch'inde, Parça B'de değiştirilecek → **çakışma garantili**
   - Parça B uygulandıktan sonra canli-saha branch'i rebase edilmeli
   - Çözüm: Parça B bittiğinde canli-saha'yı main üstüne rebase et, manuel çözüm
5. Sırayla main'e merge (öncelik sırasına göre)

### Yedek Dosyaları

- `backups/stash_files_before_branching.txt` — 20 satır (stash dosya listesi)
- `backups/working_dir_files_before_branching.txt` — 32 satır (working dir dosya listesi)

Bu iki dosya ileride çakışma çözümünde referans olarak kullanılacak.

---

## 24. CRLF Line Ending Anomalisi

**Tespit:** 2026-04-11, branch yönetimi sırasında
**Durum:** ⏸ Kayıt altında, görmezden gelindi (gelecek teknik borç)

### Sorun

Windows ortamında `git status` 127 dosyayı "modified" gösteriyor ama `git diff --name-only` yalnızca 32 gerçek içerik değişikliği buluyor. **Aradaki 95 dosya sadece line ending (CRLF vs LF) farkı içeriyor.**

### Sebep

- Proje `core.autocrlf=true` ayarıyla çalışıyor (Windows default)
- Bazı dosyalar bir noktada LF olarak commit edilmiş
- Windows'ta checkout sırasında Git LF → CRLF dönüşümü yapıyor
- Ama dosyaların **content'i** Git'in beklediği ile aynı → `git diff` boş
- Sadece "working tree ≠ index byte-wise" nedeniyle `git status` modified gösteriyor

### Şu Anki Durum (2026-04-11)

- **Görmezden geliniyor** — Parça B/Adım 0.5 odağını dağıtmamak için
- Gerçek diff dosyaları explicit listeleme ile yönetiliyor (Adım 11'de `git diff --name-only` bazlı stage)
- CRLF hayaletleri `git status`'ta görünmeye devam edecek, `git diff`'te yok
- Commit'lere dahil edilmiyor

### Risk Seviyesi

**Düşük** — fonksiyonel etki yok. Sadece:
- `git status` çıktısı gürültülü (127 dosya vs gerçek 32)
- "temiz working tree" kontrolü yanıltıcı olabilir
- IDE'lerde "changed files" paneli şişkin görünür
- Yeni developer'lar kafa karışıklığı yaşayabilir

### Çözüm Seçenekleri (Gelecek İş)

**Seçenek A — `.gitattributes` dosyası (ÖNERİLEN):**
```gitattributes
* text=auto eol=lf
*.sh text eol=lf
*.bat text eol=crlf
*.ps1 text eol=crlf
```
Line ending kurallarını explicit sabitler. Tüm dosyalar LF olarak depolanır, Windows'a checkout'ta CRLF'e dönüşür (veya eol=lf ile her yerde LF kalır).

**Seçenek B — Tek seferlik normalize:**
```bash
git add --renormalize .
git commit -m "chore: normalize line endings"
```
Mevcut tüm dosyaları tek commit'te normalize eder. Ama **büyük bir diff** oluşur (95+ dosya), code review imkansız.

**Seçenek C — `core.autocrlf` proje ayarı:**
```bash
git config core.autocrlf false  # veya input
```
Projeye özel ayar koyar. `.gitattributes` kadar güçlü değil ama hızlı.

### Önerim

**Seçenek A + Seçenek B kombinasyonu** — önce `.gitattributes` ekle (kural koy), sonra `git add --renormalize .` ile tek seferlik temizlik yap. Ama:
- Commit devasa olur (95+ dosya)
- Blame geçmişi bozulur
- Merge conflict risk'i var (diğer branch'lerle)

**Ne zaman:** Adım 0.5 + 0.7 tamamen bittikten sonra, **ayrı bir "chore: line ending normalization" sprint'inde**. Adım 0.5 sırasında **asla dokunulmaz**.

**Ne zaman YAPMAMAK gerekir:** `feature/stash-recovery-pre-step05` ve `feature/canli-saha-mobil-web-entegrasyonu` branch'leri merge edilmeden önce. Normalize + merge kombinasyonu conflict yaratır.

### Şimdi Yapmama Gerekçesi

- Parça B odağını dağıtmamak
- Toplu normalize 95+ dosyayı etkiler, riskli
- Aktif feature branch'lerle çakışabilir
- Adım 0.5 güvenlik odaklı, "cleanup" odaklı değil

Bu not Parça B tamamlandığında §24 olarak hatırlanmalı ve ayrı bir teknik borç task'ı olarak planlanmalı.

---

**Son söz:** Bu belge bir **harita**, uygulama planı değil. Her adımdan önce durum değerlendirmesi yapılacak, her adımdan sonra bir önceki adımın çıkardığı sürprizler belgeye yansıtılacak. "Plan sabit, gerçek değişken" prensibi.
