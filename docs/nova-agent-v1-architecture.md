# Nova Agent V1 Architecture

Tarih: 13.04.2026

Bu not, RiskNova icindeki mevcut sohbet / Cozum Merkezi yapisinin tek bir profesyonel ajan deneyimine donusmesi icin teknik mimari omurgayi tanimlar.

Amac:

- `Nova` adli tek bir kurumsal ajan deneyimi kurmak
- mevcut `solution-chat` beyin katmanini korumak
- sahte / demo rehber bot mantigini kaldirmak
- kullaniciyi sadece bilgilendiren degil, isi baslatan ve sonucu takip eden bir ajan kurmak
- Hermes Agent'ten ilham almak ama birebir altyapi tasimamak

## Temel Ilkeler

- Nova bir `chatbot` degil, `operasyon ajani` olacaktir.
- Nova cevap vermekle yetinmeyecek, uygun durumda aksiyon alacaktir.
- Mevzuat sorularinda hafizadan degil, `RAG + kaynak` ile cevap verecektir.
- Nova ogrenecek ama kontrolsuz sekilde kendini degistirmeyecektir.
- Ogrenen bilgiler geri alinabilir, loglanabilir ve denetlenebilir olacaktir.
- Kritik aksiyonlar ya rol bazli yetkiyle ya da kullanici onayi ile calisacaktir.

## Mevcut Yapi Icinde Korunacak Parcalar

Asagidaki mevcut parcalar Nova'nin omurgasi olarak korunur:

- `supabase/functions/solution-chat/index.ts`
  - ana ajan beyni
  - tool use
  - mevzuat arama
  - sayfa yonlendirme
  - kaynak / cevap uretimi

- `frontend/src/components/chat/ChatWidget.tsx`
  - site geneli ajan giris noktasi

- `frontend/src/app/(protected)/solution-center/page.tsx`
  - zengin ajan oturumu
  - kaynak, navigasyon, dokuman ciktisi

- `frontend/src/app/(protected)/solution-center/history/page.tsx`
  - sorgu hafizasi / gecmis

- `frontend/src/app/(protected)/solution-center/documents/page.tsx`
  - ajan tarafindan olusturulan dokumanlar

- mevcut altyapilar:
  - KVKK
  - RBAC
  - task queue
  - self-healing
  - error / audit / security loglari

## Hermes Agent'ten Alinacak Fikirler

Hermes'ten birebir altyapi almak yerine, asagidaki fikirler benimsenir:

### 1. Tool-first ajan mantigi

Nova once `tool` dusunur:

- veri lazimsa sorgular
- belge lazimsa olusturur
- sayfa lazimsa yonlendirir
- plan gerekiyorsa kayit acar

Yani serbest metin ureten bot degil, arac kullanan kurumsal ajan olur.

### 2. Katmanli hafiza

Nova'nin hafizasi 4 katmanda tutulur:

- `oturum hafizasi`
- `kullanici hafizasi`
- `firma hafizasi`
- `onayli ogrenilmis bilgi`

### 3. Uzun isler icin kuyruk

Uzun suren isler aninda cevap vermek yerine kuyruga birakilir:

- AI rapor uretimi
- egitim plani dagitimi
- toplu bildirim
- dokuman seti uretimi

### 4. Uzmanlasmis ajan yetenekleri

Tek ajan arayuzu icinde alt uzmanliklar olur:

- `Mevzuat`
- `Dokuman`
- `Planlama`
- `Risk`
- `Egitim`
- `Takip / Gorev`

Bu uzmanliklar UI'da ayrik botlar olarak degil, tek Nova altinda toolset olarak calisir.

### 5. Kalici kullanici modeli

Nova kullaniciyi tanir:

- tercih ettigi dil
- kisa / uzun cevap tercihi
- sik kullandigi moduller
- operasyon aliskanliklari

Ancak bu kullanici modeli sadece yardimci davranis icin kullanilir; hukuki / mevzuat cevabinin kendisi buradan turetilmez.

## Hermes'ten Alinmayacak Parcalar

Asagidaki konular RiskNova icin uygun degildir:

- kontrolsuz self-improving skill generation
- canli ortamda otonom skill yazma
- laptop / terminal merkezli calisma paradigmasi
- serbest terminal ajanligi
- denetimsiz cross-session davranis degisikligi

RiskNova'da ogrenen her sey:

- loglanmali
- insan tarafindan gozden gecirilebilir olmali
- geri alinabilir olmali

## Nova V1 Hedefi

Nova V1 ile hedeflenen davranis:

- kullanicinin sorusunu anlamak
- bunu `bilgi`, `yonlendirme`, `islem`, `olusturma`, `planlama`, `takip` gibi siniflara ayirmak
- gerekli tool'lari cagirarak isi tamamlamak
- sonucu kullaniciya yazili olarak donmek
- gerekiyorsa ilgili sayfaya goturmek

Ornek:

Kullanici:

- `25 Haziran'a egitim planla`

Nova:

1. aktif firma baglamini bulur
2. hangi egitimin planlanacagini kontrol eder
3. eksik veri varsa sorar
4. planner / training tarafinda kayit olusturur
5. sonucu acik yazar
6. gerekirse ilgili sayfayi acmayi teklif eder

## Nova V1 Mimari Katmanlari

### A. Nova Shell

Tek bir ajan arayuzu:

- site geneli widget
- genisletilebilir panel
- tam ekran calisma modu

Uzun vadede ayri `Cozum Merkezi` menusu zorunlu olmayabilir; ama ilk fazda arka plan mantigi korunur.

### B. Intent Router

Ilk karar katmani:

- `question`
- `navigate`
- `read`
- `create`
- `plan`
- `summarize`
- `follow_up`

Bu katman, her istegi dogrudan buyuk modele yuklemek yerine once niyeti siniflandirir.

### C. Action Layer

Nova'nin ilk hedef tool'lari:

- `search_legislation`
- `navigate_to_page`
- `get_personnel_count`
- `get_recent_assessments`
- `create_training_plan`
- `create_planner_task`
- `create_document_draft`
- `create_incident_draft`
- `get_active_workflows`
- `complete_workflow_step`
- `list_open_tasks`
- `list_due_trainings`
- `open_company_context`

Ilk 4 madde zaten kismen mevcut. Digerleri eklenmelidir.

### D. Memory Layer

Onerilen yeni tablolar:

- `nova_sessions`
- `nova_messages`
- `nova_user_preferences`
- `nova_company_memory`
- `nova_memory_facts`
- `nova_feedback`
- `nova_action_runs`

Ilk uygulama fazinda bunun hafifletilmis karsiliklari:

- `nova_memories`
- `nova_memory_profiles`
- `nova_feedback`
- `nova_action_runs`
- `nova_workflow_runs`
- `nova_workflow_steps`

Kurallar:

- mevzuat / hukuk bilgisi buraya kaydedilmez
- sadece tercih, baglam, aliskanlik ve onayli operasyon bilgisi kaydedilir

### E. RAG Layer

Nova'nin mevzuat becerisi sadece embedding uzerinden degil, metadata ile de guclendirilmelidir.

Her kaynakta hedef alanlar:

- `jurisdiction`
- `source_type`
- `document_kind`
- `effective_date`
- `revision_date`
- `binding_level`
- `topic_tags`
- `source_language`

Nova cevap uretirken bunlari ayirmalidir:

- `kesin kaynak`
- `yorum`
- `onerilen aksiyon`

### F. Execution Model

Aksiyonlar iki sinifa ayrilir:

- `hemen yap`
  - ornek: sorgu, sayfa acma, listeleme, kaynak bulma

- `onayla sonra yap`
  - ornek: planlama, kayit acma, toplu atama, toplu bildirim, silme

Bu model hem guvenlik hem kullanici guveni icin zorunludur.

## Mevcut Nova V1 Durumu

Su an repoda aktif olan Nova omurgasi:

- `nova_memories`
  - kullanici ve firma notlari
- `nova_memory_profiles`
  - uzun donem kullanici/firma operasyon profilleri
- `nova_feedback`
  - yararli / eksik geri bildirimi
- `nova_action_runs`
  - onay bekleyen kritik aksiyonlar
- `nova_workflow_runs`
  - tamamlanmis veya aktif operasyon akislari
- `nova_workflow_steps`
  - workflow icindeki tekil takip adimlari

Bu sayede Nova:

- egitim / planner / olay / dokuman aksiyonlarini onayla-calistir modelinde yurutebilir
- bir aksiyon tamamlandiktan sonra sonraki adimlari `follow_up_actions` olarak dondurebilir
- kullaniciyi ekranlar arasinda daha aktif yonlendirebilir
- tekrar eden operasyon kaliplarini uzun donem hafizaya alabilir
- `nova_learning_signals` ile olumlu / olumsuz operasyon sinyallerini toplayabilir
- benzer akislar icin daha derin takip zincirleri onerebilir
- `get_proactive_operations` ile acik workflow, yaklasan gorev, egitim, olay ve dokumanlari tek briefing icinde sunabilir

## Son Eklenen Nova V1 Paketleri

Asagidaki yetenekler ilk Nova paketlerinde sisteme eklenmistir:

- sahte public bilgi katmani kaldirildi, tek ajan kimligi `Nova` olarak netlestirildi
- operasyon tool'lari eklendi:
  - `create_training_plan`
  - `create_planner_task`
  - `create_incident_draft`
  - `create_document_draft`
- onayli aksiyon akisi eklendi:
  - `confirm_pending_action`
  - `cancel_pending_action`
- kalici hafiza katmanlari eklendi:
  - `nova_memories`
  - `nova_memory_profiles`
  - `nova_learning_signals`
  - `nova_feedback`
- is akisi ve takip katmani eklendi:
  - `nova_workflow_runs`
  - `nova_workflow_steps`
- proaktif brief eklendi:
  - kullanici Nova'yi actiginda aktif workflow'lari, yaklasan gorevleri ve siradaki adimlari gorebilir

Bu durum Nova'yi klasik sohbet arayuzunden cikarip, takip yapan ve dogru anda eylem onerisi sunan bir operasyon ajani seviyesine tasimistir.

## Dil ve Global Destek

Nova global urun mantigiyla kurulmalidir.

Gerekli alanlar:

- `answer_language`
- `source_language`
- `jurisdiction`
- `locale`

Davranis:

- kullanicinin dilinde cevap verir
- kaynagin orijinal dilini korur
- gerekirse mevzuati tercumeli aciklar
- ama hukuki baglayicilik icin orijinal kaynagi referans gosterir

## API Bagimliligini Azaltma Stratejisi

Nova zamanla daha ekonomik hale gelmelidir.

Asamali yol:

1. cache ve semantic cache
2. intent routing ile gereksiz buyuk model kullanimini azaltma
3. tool-first veri cevaplari
4. RAG kalitesini artirma
5. sik operasyonlar icin daha hafif karar katmani
6. geri bildirim destekli retrieval iyilestirme

Ama tam model bagimsiz calisma hedefi ilk faz icin gercekci degildir.

## V1 Uygulama Asamalari

### Faz 1 - Duruest ve Tekil Nova Girisi

- sahte public bilgi botunu kapat
- widget'i `Nova` giris kapisi yap
- authenticated kullanicida gercek ajan akisini koru
- `Cozum Merkezi` aklini koru

### Faz 2 - Intent ve Action Katmani

- niyet siniflandirma
- planlama / olusturma tool'lari
- onayli aksiyon akisi

### Faz 3 - Hafiza

- kullanici / firma / oturum hafizasi
- feedback kaydi
- memory retrieval
- olumlu geri bildirimlerden ogrenme havuzunu guclendirme
- aktif dil ve niyet icin daha akilli yonlendirme

### Faz 4 - RAG 2.0

- jurisdiction aware retrieval
- metadata aware ranking
- yorum / kaynak / aksiyon ayrimi

### Faz 5 - Nova as Primary UI

- `solution-center` sayfasini bagimsiz mod olmak yerine Nova'nin genis gorunumu yap
- widget + full panel + history + docs tek agent urunu gibi calissin

## Bu Repoda Ilk Dokunulacak Dosyalar

- `frontend/src/components/chat/ChatWidget.tsx`
- `frontend/src/components/chat/PublicChatWidget.tsx`
- `frontend/src/app/(protected)/solution-center/page.tsx`
- `frontend/src/app/(protected)/solution-center/layout.tsx`
- `frontend/src/components/layout/protected-shell.tsx`
- `supabase/functions/solution-chat/index.ts`

Olası yeni alanlar:

- `frontend/src/lib/nova/*`
- `supabase/functions/_shared/nova-*`

## V1 Basari Kriterleri

Nova V1 basarili sayilmasi icin:

- kullanici ayri rehber bot ile karsilasmamali
- kullaniciya gercek / durust sistem yaniti donmeli
- yonlendirme ve kaynak gosterme tutarli olmali
- en az bir operasyonel aksiyon (ornek: egitim planlama taslagi) ajandan calisabilmeli
- kullanici gecmisi ve belge ciktisi korunmali

## Son Not

Hermes Agent bize dogrudan alinacak bir urun degil, ama guclu bir referans mimaridir.

RiskNova icin dogru yol:

- Hermes'in `tool-first`, `memory`, `queue`, `specialist` fikirlerini almak
- bunlari mevcut `solution-chat + Supabase + Next.js` omurgasina yerlestirmek
- Nova'yi kontrollu, loglu, KVKK uyumlu ve operasyon yapan bir kurumsal ajan haline getirmek
