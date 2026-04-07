// ============================================================
// G6 — İşyeri Hekimi (Workplace Physician) Templates
// 10 templates for physician documentation & health surveillance
// ============================================================

import { h, p, table, bullet } from './document-templates-p1';
import type { P1Template } from './document-templates-p1';

const VARS = [
  'firma_adi',
  'firma_adresi',
  'firma_sehir',
  'tehlike_sinifi',
  'personel_sayisi',
  'isyeri_hekimi',
  'hekim_diploma_no',
  'uzman_adi',
  'bugun',
  'ay_yil',
  'yil',
  'bir_yil_sonra',
];

// ============================================================
// 1. Sağlık Gözetimi Raporu
// ============================================================
const HEKIM_GOZETIM_RAPORU: P1Template = {
  id: 'hekim-gozetim-raporu',
  groupKey: 'isyeri-hekimi',
  title: 'Sağlık Gözetimi Raporu',
  description: 'İşçi sağlığı gözetim raporu. Çalışanların sağlık durumu, maruziyetler, tavsiyeler. 6331 Madde 15 referansı.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'SAĞLIK GÖZETİMİ RAPORU'),
      p('{{firma_adi}} — {{bugun}}'),
      { type: 'horizontalRule' },

      h(2, '1. İŞYERİ BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri Unvanı', '{{firma_adi}}'],
          ['Adres', '{{firma_adresi}} / {{firma_sehir}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}} (Diploma No: {{hekim_diploma_no}})'],
          ['Rapor Dönemi', '{{ay_yil}}'],
        ],
      ),

      h(2, '2. YASAL DAYANAK'),
      p('Bu rapor; 6331 sayılı İş Sağlığı ve Güvenliği Kanunu Madde 15 "Sağlık Gözetimi" hükmü ile İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik kapsamında hazırlanmıştır.'),

      h(2, '3. SAĞLIK GÖZETİMİ BULGULARI'),
      table(
        ['Departman', 'Muayene Edilen', 'Sağlıklı', 'Takip Gerektiren', 'Kısıtlı Uygun', 'Sevk Edilen'],
        [
          ['Üretim', '', '', '', '', ''],
          ['Depo / Lojistik', '', '', '', '', ''],
          ['Ofis / İdari', '', '', '', '', ''],
          ['Toplam', '', '', '', '', ''],
        ],
      ),

      h(2, '4. TESPİT EDİLEN MARUZİYETLER'),
      bullet([
        'Gürültü maruziyeti: … dB(A) — etkilenen çalışan sayısı: …',
        'Kimyasal maruziyet: … — etkilenen çalışan sayısı: …',
        'Toz maruziyeti: … — etkilenen çalışan sayısı: …',
        'Ergonomik riskler: … — etkilenen çalışan sayısı: …',
      ]),

      h(2, '5. TAVSİYE VE ÖNERİLER'),
      bullet([
        'Gürültülü ortamlarda çalışan personele yıllık odyometri testi uygulanmalıdır.',
        'Kimyasal madde ile temas eden personelin biyolojik monitorizasyonu yapılmalıdır.',
        'Ergonomik düzenlemeler için iş güvenliği uzmanı ile ortak çalışma yürütülmelidir.',
        'Kronik hastalığı tespit edilen çalışanlar için bireysel sağlık takip planı oluşturulmalıdır.',
      ]),

      h(2, '6. SONUÇ'),
      p('Yukarıda belirtilen bulgular doğrultusunda gerekli önlemlerin alınması ve takip muayenelerinin planlanması önerilmektedir.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 2. Periyodik Muayene Planı
// ============================================================
const HEKIM_PERIYODIK_MUAYENE: P1Template = {
  id: 'hekim-periyodik-muayene',
  groupKey: 'isyeri-hekimi',
  title: 'Periyodik Muayene Planı',
  description: 'Yıllık periyodik muayene takvimi. Aylık tablo (Ocak-Aralık), departman bazlı planlama.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'PERİYODİK MUAYENE PLANI — {{yil}}'),
      p('{{firma_adi}}'),
      { type: 'horizontalRule' },

      h(2, '1. GENEL BİLGİLER'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}}'],
          ['Plan Dönemi', '{{yil}}'],
        ],
      ),

      h(2, '2. YASAL DAYANAK'),
      p('6331 sayılı Kanun Madde 15 gereğince tehlike sınıfına göre periyodik muayene süreleri: Az tehlikeli — 5 yıl, Tehlikeli — 3 yıl, Çok tehlikeli — 1 yıl. İşveren, çalışanların sağlık gözetimini yaptırmakla yükümlüdür.'),

      h(2, '3. AYLIK MUAYENE TAKVİMİ'),
      table(
        ['Ay', 'Departman / Birim', 'Planlanan Kişi Sayısı', 'Yapılacak Tetkikler', 'Durum'],
        [
          ['Ocak', '', '', '', ''],
          ['Şubat', '', '', '', ''],
          ['Mart', '', '', '', ''],
          ['Nisan', '', '', '', ''],
          ['Mayıs', '', '', '', ''],
          ['Haziran', '', '', '', ''],
          ['Temmuz', '', '', '', ''],
          ['Ağustos', '', '', '', ''],
          ['Eylül', '', '', '', ''],
          ['Ekim', '', '', '', ''],
          ['Kasım', '', '', '', ''],
          ['Aralık', '', '', '', ''],
        ],
      ),

      h(2, '4. YAPILACAK TETKİKLER'),
      bullet([
        'Tam kan sayımı (hemogram)',
        'Tam idrar tahlili',
        'Akciğer grafisi (PA)',
        'Odyometri (gürültülü ortam çalışanları)',
        'Solunum fonksiyon testi (toz/kimyasal maruziyeti)',
        'Göz muayenesi (ekranlı araç kullananlar)',
      ]),

      h(2, '5. NOTLAR'),
      p('Muayene sonuçlarına göre uygun/uygun değil/şartlı uygun kararı verilecek ve sonuçlar kişisel sağlık dosyasına işlenecektir.'),

      p(' '),
      table(
        ['Hazırlayan İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 3. İşe Giriş Muayene Formu
// ============================================================
const HEKIM_ISE_GIRIS_MUAYENE: P1Template = {
  id: 'hekim-ise-giris-muayene',
  groupKey: 'isyeri-hekimi',
  title: 'İşe Giriş Muayene Formu',
  description: 'Kişisel bilgiler, özgeçmiş, fizik muayene bulguları, tetkik sonuçları, sonuç (uygun/uygun değil/şartlı uygun).',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'İŞE GİRİŞ MUAYENE FORMU'),
      p('{{firma_adi}} — Tarih: {{bugun}}'),
      { type: 'horizontalRule' },

      h(2, '1. KİŞİSEL BİLGİLER'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['Adı Soyadı', ''],
          ['T.C. Kimlik No', ''],
          ['Doğum Tarihi', ''],
          ['Görevi / Departmanı', ''],
          ['İşe Başlama Tarihi', ''],
          ['Medeni Durumu', ''],
          ['Kan Grubu', ''],
        ],
      ),

      h(2, '2. TIBBİ ÖZGEÇMİŞ'),
      table(
        ['Soru', 'Evet', 'Hayır', 'Açıklama'],
        [
          ['Bilinen kronik hastalık var mı?', '', '', ''],
          ['Sürekli kullandığı ilaç var mı?', '', '', ''],
          ['Geçirilmiş ameliyat var mı?', '', '', ''],
          ['Alerji öyküsü var mı?', '', '', ''],
          ['Sigara kullanıyor mu?', '', '', ''],
          ['Ailede meslek hastalığı öyküsü?', '', '', ''],
        ],
      ),

      h(2, '3. FİZİK MUAYENE BULGULARI'),
      table(
        ['Sistem', 'Normal', 'Anormal', 'Açıklama'],
        [
          ['Genel Durum / Boy / Kilo / VKİ', '', '', ''],
          ['Baş-Boyun', '', '', ''],
          ['Göz (Görme Testi)', '', '', ''],
          ['Kulak (Odyometri)', '', '', ''],
          ['Solunum Sistemi', '', '', ''],
          ['Kardiyovasküler Sistem', '', '', ''],
          ['Kas-İskelet Sistemi', '', '', ''],
          ['Nörolojik Muayene', '', '', ''],
          ['Deri', '', '', ''],
        ],
      ),

      h(2, '4. TETKİK SONUÇLARI'),
      table(
        ['Tetkik', 'Sonuç', 'Referans Aralığı', 'Değerlendirme'],
        [
          ['Hemogram', '', '', ''],
          ['Tam İdrar', '', '', ''],
          ['Akciğer Grafisi', '', '', ''],
          ['SFT', '', '', ''],
          ['Diğer', '', '', ''],
        ],
      ),

      h(2, '5. SONUÇ'),
      table(
        ['Karar', 'İşaret (X)'],
        [
          ['İşe giriş muayenesi UYGUN', ''],
          ['İşe giriş muayenesi ŞARTLI UYGUN (Kısıtlama: …)', ''],
          ['İşe giriş muayenesi UYGUN DEĞİL', ''],
        ],
      ),

      p(' '),
      table(
        ['İşyeri Hekimi', 'Diploma No', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '{{hekim_diploma_no}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 4. Meslek Hastalığı Takip Formu
// ============================================================
const HEKIM_MESLEK_HASTALIGI: P1Template = {
  id: 'hekim-meslek-hastaligi',
  groupKey: 'isyeri-hekimi',
  title: 'Meslek Hastalığı Takip Formu',
  description: 'Şüpheli/kesinleşmiş meslek hastalığı kayıt ve takibi. Tanı, tedavi, iş uyumu.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'MESLEK HASTALIĞI TAKİP FORMU'),
      p('{{firma_adi}} — {{bugun}}'),
      { type: 'horizontalRule' },

      h(2, '1. ÇALIŞAN BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['Adı Soyadı', ''],
          ['T.C. Kimlik No', ''],
          ['Departman / Görev', ''],
          ['İşe Giriş Tarihi', ''],
          ['Maruziyet Süresi (yıl)', ''],
        ],
      ),

      h(2, '2. MARUZİYET BİLGİLERİ'),
      table(
        ['Maruziyet Türü', 'Etmen / Madde', 'Süre', 'Ortam Ölçüm Değeri'],
        [
          ['Fiziksel', '', '', ''],
          ['Kimyasal', '', '', ''],
          ['Biyolojik', '', '', ''],
          ['Ergonomik', '', '', ''],
          ['Psikososyal', '', '', ''],
        ],
      ),

      h(2, '3. TANI VE DEĞERLENDİRME'),
      table(
        ['Bilgi', 'Açıklama'],
        [
          ['Ön Tanı / Kesin Tanı', ''],
          ['ICD-10 Kodu', ''],
          ['Tanı Tarihi', ''],
          ['Tanıyı Koyan Kurum', ''],
          ['Şüpheli / Kesinleşmiş', ''],
        ],
      ),

      h(2, '4. TEDAVİ VE TAKİP'),
      bullet([
        'Uygulanan tedavi: …',
        'Sevk edilen kurum: …',
        'İstirahat süresi: …',
        'Kontrol muayene tarihi: …',
      ]),

      h(2, '5. İŞ UYUMU DEĞERLENDİRMESİ'),
      table(
        ['Karar', 'İşaret (X)'],
        [
          ['Mevcut işinde çalışmaya devam edebilir', ''],
          ['İş değişikliği gereklidir (Önerilen: …)', ''],
          ['Geçici iş göremezlik raporu düzenlendi', ''],
          ['Sürekli iş göremezlik değerlendirmesi gerekli', ''],
        ],
      ),

      h(2, '6. YASAL BİLDİRİM'),
      p('6331 sayılı Kanun Madde 14 ve 5510 sayılı Kanun Madde 14 uyarınca meslek hastalığı bildirimi SGK ve Çalışma ve Sosyal Güvenlik Bakanlığına yapılacaktır.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 5. İlaç ve Sarf Malzeme Takip
// ============================================================
const HEKIM_ILAC_TAKIP: P1Template = {
  id: 'hekim-ilac-takip',
  groupKey: 'isyeri-hekimi',
  title: 'İlaç ve Sarf Malzeme Takip Formu',
  description: 'Revirdeki ilaç ve malzeme stok takibi. İlaç adı, miktar, son kullanma, tedarik.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'İLAÇ VE SARF MALZEME TAKİP FORMU'),
      p('{{firma_adi}} — Revir / Sağlık Birimi'),
      { type: 'horizontalRule' },

      h(2, '1. GENEL BİLGİLER'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Sorumlu Hekim', '{{isyeri_hekimi}}'],
          ['Sayım Tarihi', '{{bugun}}'],
          ['Bir Sonraki Sayım', ''],
        ],
      ),

      h(2, '2. İLAÇ STOK LİSTESİ'),
      table(
        ['Sıra', 'İlaç Adı', 'Etken Madde', 'Form', 'Mevcut Miktar', 'Son Kullanma Tarihi', 'Durum'],
        [
          ['1', 'Parasetamol 500mg', 'Parasetamol', 'Tablet', '', '', ''],
          ['2', 'İbuprofen 400mg', 'İbuprofen', 'Tablet', '', '', ''],
          ['3', 'Kas Gevşetici Krem', 'Miyorelaksan', 'Krem', '', '', ''],
          ['4', 'Antiseptik Solüsyon', 'Povidon İyot', 'Solüsyon', '', '', ''],
          ['5', 'Göz Damlası', 'Suni Gözyaşı', 'Damla', '', '', ''],
          ['6', '', '', '', '', '', ''],
        ],
      ),

      h(2, '3. SARF MALZEME STOK LİSTESİ'),
      table(
        ['Sıra', 'Malzeme Adı', 'Birim', 'Mevcut Miktar', 'Minimum Stok', 'Tedarik Gerekli'],
        [
          ['1', 'Yara Bandı (çeşitli)', 'Kutu', '', '5', ''],
          ['2', 'Gazlı Bez (steril)', 'Paket', '', '10', ''],
          ['3', 'Elastik Bandaj', 'Adet', '', '10', ''],
          ['4', 'Tek Kullanımlık Eldiven', 'Kutu', '', '5', ''],
          ['5', 'Enjektör (çeşitli)', 'Adet', '', '20', ''],
          ['6', 'Tansiyon Aleti Manşonu', 'Adet', '', '2', ''],
        ],
      ),

      h(2, '4. SON KULLANMA TARİHİ GEÇEN / YAKLAŞAN'),
      table(
        ['İlaç / Malzeme', 'Son Kullanma', 'Durum', 'Yapılacak İşlem'],
        [
          ['', '', '', ''],
          ['', '', '', ''],
        ],
      ),

      h(2, '5. TEDARİK TALEPLERİ'),
      p('Aşağıdaki kalemler için tedarik talep edilmektedir:'),
      bullet([
        '…',
        '…',
      ]),

      p(' '),
      table(
        ['Sorumlu İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 6. Reçete Kayıt Formu
// ============================================================
const HEKIM_RECETE_KAYIT: P1Template = {
  id: 'hekim-recete-kayit',
  groupKey: 'isyeri-hekimi',
  title: 'Reçete Kayıt Formu',
  description: 'Hastaya yazılan reçetelerin kaydı. Hasta bilgisi, ilaçlar, doz, süre.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'REÇETE KAYIT FORMU'),
      p('{{firma_adi}} — Sağlık Birimi'),
      { type: 'horizontalRule' },

      h(2, '1. HASTA BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['Adı Soyadı', ''],
          ['T.C. Kimlik No', ''],
          ['Departman / Görev', ''],
          ['Muayene Tarihi', '{{bugun}}'],
          ['Şikayet / Tanı', ''],
        ],
      ),

      h(2, '2. YAZILAN İLAÇLAR'),
      table(
        ['Sıra', 'İlaç Adı', 'Doz', 'Kullanım Şekli', 'Süre', 'Adet'],
        [
          ['1', '', '', '', '', ''],
          ['2', '', '', '', '', ''],
          ['3', '', '', '', '', ''],
          ['4', '', '', '', '', ''],
        ],
      ),

      h(2, '3. HEKIM NOTLARI'),
      bullet([
        'Alerji durumu kontrol edildi: Evet / Hayır',
        'İlaç etkileşimi kontrolü: Evet / Hayır',
        'Hastaya ilaç kullanım bilgisi verildi: Evet / Hayır',
        'Kontrol muayene tarihi: …',
      ]),

      h(2, '4. SEVKİ GEREKTİREN DURUMLAR'),
      p('Sevk gerekli ise: Sevk edilen kurum ve bölüm bilgisi aşağıya yazılacaktır.'),
      table(
        ['Sevk Edilen Kurum', 'Bölüm', 'Sevk Tarihi', 'Sevk Nedeni'],
        [['', '', '', '']],
      ),

      h(2, '5. YASAL UYARI'),
      p('İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik Madde 9 gereğince işyeri hekimi, çalışanların sağlık gözetimini yapmak ve iş sağlığı alanında reçete yazmakla yetkilidir.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'Diploma No', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '{{hekim_diploma_no}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 7. Revir/Muayene Defteri
// ============================================================
const HEKIM_REVIR_DEFTERI: P1Template = {
  id: 'hekim-revir-defteri',
  groupKey: 'isyeri-hekimi',
  title: 'Revir / Muayene Defteri',
  description: 'Günlük muayene kayıtları. Tarih, hasta, şikayet, tanı, tedavi, sevk.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'REVİR / MUAYENE DEFTERİ'),
      p('{{firma_adi}} — {{ay_yil}}'),
      { type: 'horizontalRule' },

      h(2, '1. REVİR BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}}'],
          ['Kayıt Dönemi', '{{ay_yil}}'],
        ],
      ),

      h(2, '2. GÜNLÜK MUAYENE KAYITLARI'),
      table(
        ['Sıra', 'Tarih', 'Saat', 'Hasta Adı Soyadı', 'Departman', 'Şikayet', 'Tanı', 'Tedavi / İşlem', 'Sevk'],
        [
          ['1', '', '', '', '', '', '', '', ''],
          ['2', '', '', '', '', '', '', '', ''],
          ['3', '', '', '', '', '', '', '', ''],
          ['4', '', '', '', '', '', '', '', ''],
          ['5', '', '', '', '', '', '', '', ''],
          ['6', '', '', '', '', '', '', '', ''],
          ['7', '', '', '', '', '', '', '', ''],
          ['8', '', '', '', '', '', '', '', ''],
          ['9', '', '', '', '', '', '', '', ''],
          ['10', '', '', '', '', '', '', '', ''],
        ],
      ),

      h(2, '3. AYLIK İSTATİSTİK'),
      table(
        ['Gösterge', 'Sayı'],
        [
          ['Toplam Muayene', ''],
          ['İlk Başvuru', ''],
          ['Kontrol Muayenesi', ''],
          ['Sevk Edilen', ''],
          ['İstirahat Verilen', ''],
          ['İş Kazası Başvurusu', ''],
        ],
      ),

      h(2, '4. NOTLAR'),
      p('İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik gereğince tüm muayene kayıtları usulüne uygun tutulmalı ve en az 15 yıl saklanmalıdır.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 8. Toplu Sağlık Tarama Raporu
// ============================================================
const HEKIM_SAGLIK_TARAMA: P1Template = {
  id: 'hekim-saglik-tarama',
  groupKey: 'isyeri-hekimi',
  title: 'Toplu Sağlık Tarama Raporu',
  description: 'Tüm çalışanların sağlık tarama sonuçları özeti. İstatistikler, riskli gruplar, öneriler.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'TOPLU SAĞLIK TARAMA RAPORU'),
      p('{{firma_adi}} — {{yil}}'),
      { type: 'horizontalRule' },

      h(2, '1. TARAMA BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Toplam Çalışan Sayısı', '{{personel_sayisi}}'],
          ['Tarama Yapılan Çalışan', ''],
          ['Tarama Oranı (%)', ''],
          ['Tarama Dönemi', '{{yil}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}}'],
        ],
      ),

      h(2, '2. GENEL SAĞLIK İSTATİSTİKLERİ'),
      table(
        ['Parametre', 'Normal', 'Sınırda', 'Anormal', 'Oran (%)'],
        [
          ['Tansiyon', '', '', '', ''],
          ['Kan Şekeri', '', '', '', ''],
          ['Kolesterol', '', '', '', ''],
          ['Hemogram', '', '', '', ''],
          ['Akciğer Grafisi', '', '', '', ''],
          ['Solunum Fonksiyon Testi', '', '', '', ''],
          ['Odyometri', '', '', '', ''],
          ['Görme Testi', '', '', '', ''],
        ],
      ),

      h(2, '3. RİSKLİ GRUPLAR'),
      table(
        ['Risk Grubu', 'Kişi Sayısı', 'Oran (%)', 'Önerilen Takip'],
        [
          ['Hipertansiyon', '', '', ''],
          ['Diyabet / Pre-diyabet', '', '', ''],
          ['Obezite (VKİ > 30)', '', '', ''],
          ['İşitme Kaybı', '', '', ''],
          ['Solunum Fonksiyon Bozukluğu', '', '', ''],
          ['Kas-İskelet Şikayetleri', '', '', ''],
        ],
      ),

      h(2, '4. ÖNERİLER'),
      bullet([
        'Riskli grupta yer alan çalışanlar için bireysel takip programı oluşturulmalıdır.',
        'Obezite prevalansı yüksek olup beslenme danışmanlığı programı başlatılmalıdır.',
        'Gürültüye maruz çalışanlarda işitme kaybı oranı izlenmeli, KKD kullanımı denetlenmelidir.',
        'Solunum fonksiyon bozukluğu tespit edilen çalışanlar ileri tetkike yönlendirilmelidir.',
        'Tüm çalışanlara yönelik sağlıklı yaşam eğitimi düzenlenmelidir.',
      ]),

      h(2, '5. SONUÇ'),
      p('6331 sayılı Kanun Madde 15 uyarınca sağlık gözetimi sonuçları değerlendirilerek yukarıdaki önlemlerin alınması gerekmektedir.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 9. Biyolojik Maruziyet Değerlendirmesi
// ============================================================
const HEKIM_BIYOLOJIK_MARUZIYET: P1Template = {
  id: 'hekim-biolojik-maruziyet',
  groupKey: 'isyeri-hekimi',
  title: 'Biyolojik Maruziyet Değerlendirmesi',
  description: 'Biyolojik etmenlere maruziyet analizi. Etmen, kaynak, risk seviyesi, önlemler.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'BİYOLOJİK MARUZİYET DEĞERLENDİRMESİ'),
      p('{{firma_adi}} — {{bugun}}'),
      { type: 'horizontalRule' },

      h(2, '1. İŞYERİ BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Adres', '{{firma_adresi}} / {{firma_sehir}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['Değerlendirme Tarihi', '{{bugun}}'],
        ],
      ),

      h(2, '2. YASAL DAYANAK'),
      p('Bu değerlendirme; 6331 sayılı İSG Kanunu ve Biyolojik Etkenlere Maruziyet Risklerinin Önlenmesi Hakkında Yönetmelik kapsamında hazırlanmıştır.'),

      h(2, '3. TESPİT EDİLEN BİYOLOJİK ETMENLER'),
      table(
        ['Etmen', 'Risk Grubu (1-4)', 'Kaynak / Faaliyet', 'Maruz Kalan Kişi Sayısı', 'Maruziyet Sıklığı'],
        [
          ['', '', '', '', ''],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
        ],
      ),

      h(2, '4. RİSK DEĞERLENDİRMESİ'),
      table(
        ['Etmen', 'Bulaşma Yolu', 'Risk Seviyesi', 'Mevcut Önlemler', 'İlave Önlemler'],
        [
          ['', '', '', '', ''],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
        ],
      ),

      h(2, '5. ALINMASI GEREKEN ÖNLEMLER'),
      bullet([
        'Kişisel koruyucu donanım (eldiven, maske, gözlük) kullanımı sağlanmalıdır.',
        'El hijyeni eğitimi verilmeli ve el dezenfektanları yaygınlaştırılmalıdır.',
        'Biyolojik atık yönetimi prosedürüne uyulmalıdır.',
        'Risk grubuna göre aşılama programı uygulanmalıdır.',
        'Maruziyet sonrası profilaksi protokolü hazırlanmalıdır.',
      ]),

      h(2, '6. AŞILAMA DURUMU'),
      table(
        ['Aşı', 'Uygulanan Kişi Sayısı', 'Uygulanmayan', 'Planlanan Tarih'],
        [
          ['Hepatit B', '', '', ''],
          ['Tetanos', '', '', ''],
          ['Grip (Mevsimsel)', '', '', ''],
          ['Diğer', '', '', ''],
        ],
      ),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İmza', 'Tarih'],
        [['{{isyeri_hekimi}}', '', '{{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// 10. İşyeri Hekimi Yıllık Değerlendirme Raporu
// ============================================================
const HEKIM_YILLIK_DEGERLENDIRME: P1Template = {
  id: 'hekim-yillik-degerlendirme',
  groupKey: 'isyeri-hekimi',
  title: 'İşyeri Hekimi Yıllık Değerlendirme Raporu',
  description: 'Yıllık faaliyet raporu. Muayene sayıları, sevkler, eğitimler, öneriler.',
  variables: VARS,
  content: {
    type: 'doc',
    content: [
      h(1, 'İŞYERİ HEKİMİ YILLIK DEĞERLENDİRME RAPORU'),
      p('{{firma_adi}} — {{yil}}'),
      { type: 'horizontalRule' },

      h(2, '1. GENEL BİLGİLER'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}} (Diploma No: {{hekim_diploma_no}})'],
          ['İş Güvenliği Uzmanı', '{{uzman_adi}}'],
          ['Değerlendirme Dönemi', '{{yil}}'],
        ],
      ),

      h(2, '2. MUAYENE İSTATİSTİKLERİ'),
      table(
        ['Faaliyet', 'Sayı'],
        [
          ['Toplam Poliklinik Muayenesi', ''],
          ['İşe Giriş Muayenesi', ''],
          ['Periyodik Muayene', ''],
          ['İşten Ayrılış Muayenesi', ''],
          ['İş Kazası Sonrası Muayene', ''],
          ['Kontrol Muayenesi', ''],
          ['Sevk Edilen Çalışan', ''],
          ['İstirahat Raporu Verilen', ''],
        ],
      ),

      h(2, '3. SAĞLIK GÖZETİMİ SONUÇLARI'),
      table(
        ['Sonuç', 'Kişi Sayısı', 'Oran (%)'],
        [
          ['Uygun', '', ''],
          ['Şartlı Uygun', '', ''],
          ['Uygun Değil', '', ''],
          ['Takip Gerektiren', '', ''],
        ],
      ),

      h(2, '4. VERİLEN EĞİTİMLER'),
      table(
        ['Eğitim Konusu', 'Tarih', 'Katılımcı Sayısı', 'Süre (saat)'],
        [
          ['İlk Yardım Eğitimi', '', '', ''],
          ['Hijyen ve Bulaşıcı Hastalıklar', '', '', ''],
          ['Ergonomi ve Doğru Çalışma Pozisyonları', '', '', ''],
          ['Madde Bağımlılığı ve Zararları', '', '', ''],
          ['Sağlıklı Beslenme', '', '', ''],
        ],
      ),

      h(2, '5. MESLEK HASTALIĞI VE İŞ KAZASI DEĞERLENDİRMESİ'),
      bullet([
        'Bildirilen meslek hastalığı şüphesi: … adet',
        'Kesinleşen meslek hastalığı: … adet',
        'İş kazası sonrası değerlendirme: … adet',
        'İş kazası kök neden analizine katılım: … adet',
      ]),

      h(2, '6. ÖNERİLER VE İYİLEŞTİRME PLANI'),
      bullet([
        'Periyodik muayene takviminin aksatılmadan uygulanması gerekmektedir.',
        'Riskli bölgelerde çalışanlara yönelik biyolojik monitorizasyon planı oluşturulmalıdır.',
        'Ergonomik risk değerlendirmesi yapılarak iyileştirme önerileri hayata geçirilmelidir.',
        'Çalışan sağlığının korunması için psikososyal risk faktörleri değerlendirilmelidir.',
        'İş sağlığı ve güvenliği kurulu toplantılarına düzenli katılım sağlanmalıdır.',
      ]),

      h(2, '7. YASAL UYGUNLUK'),
      p('Bu rapor; 6331 sayılı İş Sağlığı ve Güvenliği Kanunu, İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik hükümleri kapsamında hazırlanmıştır.'),

      p(' '),
      table(
        ['İşyeri Hekimi', 'İş Güvenliği Uzmanı', 'İşveren / Vekili'],
        [['{{isyeri_hekimi}}', '{{uzman_adi}}', ''],
         ['İmza:', 'İmza:', 'İmza:'],
         ['Tarih: {{bugun}}', 'Tarih: {{bugun}}', 'Tarih: {{bugun}}']],
      ),
    ],
  },
};

// ============================================================
// Export
// ============================================================
export const GROUP21_TEMPLATES: P1Template[] = [
  HEKIM_GOZETIM_RAPORU,
  HEKIM_PERIYODIK_MUAYENE,
  HEKIM_ISE_GIRIS_MUAYENE,
  HEKIM_MESLEK_HASTALIGI,
  HEKIM_ILAC_TAKIP,
  HEKIM_RECETE_KAYIT,
  HEKIM_REVIR_DEFTERI,
  HEKIM_SAGLIK_TARAMA,
  HEKIM_BIYOLOJIK_MARUZIYET,
  HEKIM_YILLIK_DEGERLENDIRME,
];
