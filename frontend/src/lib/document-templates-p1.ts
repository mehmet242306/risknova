// ============================================================
// P1 Priority Templates — 5 ready-to-use ISG document templates
// Each template returns TipTap-compatible JSON content
// ============================================================

import type { JSONContent } from '@tiptap/react';

export interface P1Template {
  id: string;
  groupKey: string;
  title: string;
  description: string;
  variables: string[];
  content: JSONContent;
}

export function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

export function h(level: 1 | 2 | 3, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

export function bold(text: string): JSONContent['content'] {
  return [{ type: 'text', marks: [{ type: 'bold' }], text }];
}

export function bullet(items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map((t) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
    })),
  };
}

export function table(headers: string[], rows: string[][]): JSONContent {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headers.map((h) => ({
          type: 'tableHeader',
          content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: h }] }],
        })),
      },
      ...rows.map((row) => ({
        type: 'tableRow',
        content: row.map((cell) => ({
          type: 'tableCell',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: cell }] }],
        })),
      })),
    ],
  };
}

// ============================================================
// 1. Risk Değerlendirme Raporu
// ============================================================
export const RISK_RAPORU: P1Template = {
  id: 'risk-raporu',
  groupKey: 'risk-degerlendirme',
  title: 'Risk Değerlendirme Raporu',
  description: '6331 sayılı İSG Kanunu kapsamında risk değerlendirme raporu',
  variables: ['firma_adi', 'firma_adresi', 'firma_sehir', 'tehlike_sinifi', 'nace_kodu', 'sektor', 'personel_sayisi', 'uzman_adi', 'uzman_sinifi', 'isyeri_hekimi', 'rapor_tarihi', 'bir_yil_sonra', 'toplam_risk_sayisi', 'yuksek_risk_sayisi', 'orta_risk_sayisi', 'dusuk_risk_sayisi'],
  content: {
    type: 'doc',
    content: [
      h(1, 'RİSK DEĞERLENDİRME RAPORU'),
      p('{{firma_adi}}'),
      { type: 'horizontalRule' },

      h(2, '1. İŞYERİ BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri Unvanı', '{{firma_adi}}'],
          ['Adres', '{{firma_adresi}}, {{firma_sehir}}'],
          ['Sektör', '{{sektor}}'],
          ['NACE Kodu', '{{nace_kodu}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['İSG Uzmanı', '{{uzman_adi}} ({{uzman_sinifi}})'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}}'],
          ['Rapor Tarihi', '{{rapor_tarihi}}'],
          ['Geçerlilik', '{{rapor_tarihi}} – {{bir_yil_sonra}}'],
        ]
      ),

      h(2, '2. AMAÇ VE KAPSAM'),
      p('Bu rapor, 6331 sayılı İş Sağlığı ve Güvenliği Kanunu ve İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği gereğince hazırlanmıştır. İşyerinde mevcut ve olası tehlikelerin belirlenmesi, risklerin değerlendirilmesi ve kontrol tedbirlerinin planlanması amacıyla düzenlenmiştir.'),

      h(2, '3. RİSK DEĞERLENDİRME EKİBİ'),
      p('Risk değerlendirmesi aşağıdaki ekip tarafından gerçekleştirilmiştir:'),
      table(
        ['Ad Soyad', 'Unvan', 'Görev'],
        [
          ['{{uzman_adi}}', '{{uzman_sinifi}} İSG Uzmanı', 'Ekip Başkanı'],
          ['{{isyeri_hekimi}}', 'İşyeri Hekimi', 'Ekip Üyesi'],
          ['', 'İşveren Temsilcisi', 'Ekip Üyesi'],
          ['', 'Çalışan Temsilcisi', 'Ekip Üyesi'],
        ]
      ),

      h(2, '4. KULLANILAN YÖNTEM'),
      p('Risk değerlendirmesinde aşağıdaki yöntemler kullanılmıştır:'),
      bullet([
        'Fine-Kinney Yöntemi (Olasılık × Frekans × Şiddet)',
        'Matris Yöntemi (L Tipi 5×5)',
        'R²D (RiskNova Risk Değerlendirme) Skoru',
      ]),

      h(2, '5. RİSK DEĞERLENDİRME SONUÇLARI'),
      table(
        ['Risk Seviyesi', 'Sayı', 'Oran'],
        [
          ['Yüksek (Kabul Edilemez)', '{{yuksek_risk_sayisi}}', ''],
          ['Orta (Dikkate Değer)', '{{orta_risk_sayisi}}', ''],
          ['Düşük (Kabul Edilebilir)', '{{dusuk_risk_sayisi}}', ''],
          ['TOPLAM', '{{toplam_risk_sayisi}}', '%100'],
        ]
      ),
      p('Detaylı risk analiz tablosu EK-1\'de sunulmuştur.'),

      h(2, '6. GENEL DEĞERLENDİRME VE ÖNERİLER'),
      p('İşyerinde yapılan incelemeler sonucunda belirlenen tehlikeler ve riskler değerlendirilmiş, her bir risk için kontrol tedbirleri önerilmiştir. Yüksek riskli alanlar için acil önlem alınması gerekmektedir.'),
      bullet([
        'Yüksek riskli alanlar için düzeltici faaliyetler ivedilikle başlatılmalıdır.',
        'Tüm çalışanlara risk değerlendirme sonuçları hakkında bilgilendirme eğitimi verilmelidir.',
        'Risk değerlendirmesi yılda en az bir kez yenilenmelidir.',
        'İş kazası veya meslek hastalığı durumunda risk değerlendirmesi güncellenerek yenilenmelidir.',
      ]),

      h(2, '7. İMZA'),
      table(
        ['Hazırlayan', 'Onaylayan'],
        [
          ['{{uzman_adi}}', ''],
          ['{{uzman_sinifi}} İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{rapor_tarihi}}', 'Tarih: {{rapor_tarihi}}'],
        ]
      ),
    ],
  },
};

// ============================================================
// 2. İSG Kurul Toplantı Tutanağı
// ============================================================
export const KURUL_TUTANAGI: P1Template = {
  id: 'kurul-tutanagi',
  groupKey: 'kurul-kayitlari',
  title: 'İSG Kurul Toplantı Tutanağı',
  description: 'İSG Kurul toplantılarının resmi kaydı',
  variables: ['firma_adi', 'firma_adresi', 'bugun', 'uzman_adi', 'isyeri_hekimi', 'personel_sayisi'],
  content: {
    type: 'doc',
    content: [
      h(1, 'İŞ SAĞLIĞI VE GÜVENLİĞİ KURUL TOPLANTI TUTANAĞI'),
      { type: 'horizontalRule' },

      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Toplantı Tarihi', '{{bugun}}'],
          ['Toplantı No', ''],
          ['Toplantı Saati', ''],
          ['Toplantı Yeri', ''],
        ]
      ),

      h(2, 'KATILIMCILAR'),
      table(
        ['Ad Soyad', 'Unvan', 'İmza'],
        [
          ['', 'İşveren / İşveren Vekili (Başkan)', ''],
          ['{{uzman_adi}}', 'İSG Uzmanı', ''],
          ['{{isyeri_hekimi}}', 'İşyeri Hekimi', ''],
          ['', 'İnsan Kaynakları Temsilcisi', ''],
          ['', 'Çalışan Temsilcisi', ''],
          ['', 'Destek Elemanı', ''],
        ]
      ),

      h(2, 'GÜNDEM MADDELERİ'),
      p('1. Açılış ve yoklama'),
      p('2. Önceki toplantı kararlarının değerlendirilmesi'),
      p('3. İş kazası ve ramak kala olaylarının değerlendirilmesi'),
      p('4. Risk değerlendirme sonuçlarının gözden geçirilmesi'),
      p('5. Eğitim faaliyetlerinin değerlendirilmesi'),
      p('6. Yeni tehlikeler ve önlemler'),
      p('7. Dilek ve temenniler'),
      p('8. Kapanış'),

      h(2, 'GÖRÜŞMELER'),
      p('(Gündem maddelerine göre yapılan görüşmeler burada detaylandırılır.)'),

      h(2, 'ALINAN KARARLAR'),
      table(
        ['No', 'Karar', 'Sorumlu', 'Termin'],
        [
          ['1', '', '', ''],
          ['2', '', '', ''],
          ['3', '', '', ''],
        ]
      ),

      h(2, 'ÖNCEKİ TOPLANTI KARARLARI TAKİBİ'),
      table(
        ['No', 'Karar', 'Durum', 'Açıklama'],
        [
          ['1', '', 'Tamamlandı / Devam Ediyor', ''],
        ]
      ),

      p('Bir sonraki toplantı tarihi: ___/___/______'),
      p(''),
      p('Tutanağı Hazırlayan: {{uzman_adi}} — İSG Uzmanı'),
    ],
  },
};

// ============================================================
// 3. Eğitim Katılım Formu
// ============================================================
export const EGITIM_KATILIM_FORMU: P1Template = {
  id: 'egitim-katilim-formu',
  groupKey: 'egitim-dosyasi',
  title: 'Eğitim Katılım Formu',
  description: 'İSG eğitimlerine katılım kaydı ve imza çizelgesi',
  variables: ['firma_adi', 'bugun', 'uzman_adi', 'personel_sayisi'],
  content: {
    type: 'doc',
    content: [
      h(1, 'İSG EĞİTİM KATILIM FORMU'),
      { type: 'horizontalRule' },

      h(2, 'EĞİTİM BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri', '{{firma_adi}}'],
          ['Eğitim Tarihi', '{{bugun}}'],
          ['Eğitim Saati', ''],
          ['Eğitim Süresi', ''],
          ['Eğitim Yeri', ''],
          ['Eğitim Konusu', ''],
          ['Eğitim Türü', 'Temel İSG / Mesleki / Yenileme'],
          ['Eğitmen', '{{uzman_adi}}'],
          ['Eğitim Yöntemi', 'Yüz yüze / Uzaktan / Uygulamalı'],
        ]
      ),

      h(2, 'EĞİTİM İÇERİĞİ'),
      bullet([
        'İş Sağlığı ve Güvenliği mevzuatı',
        'İşyerinde karşılaşılabilecek tehlikeler ve riskler',
        'Risk değerlendirme sonuçları',
        'Kişisel koruyucu donanım (KKD) kullanımı',
        'Acil durum prosedürleri',
        'İş kazası ve meslek hastalıkları bildirimi',
      ]),

      h(2, 'KATILIMCI LİSTESİ'),
      table(
        ['No', 'Ad Soyad', 'TC Kimlik No', 'Departman', 'İmza'],
        [
          ['1', '', '', '', ''],
          ['2', '', '', '', ''],
          ['3', '', '', '', ''],
          ['4', '', '', '', ''],
          ['5', '', '', '', ''],
          ['6', '', '', '', ''],
          ['7', '', '', '', ''],
          ['8', '', '', '', ''],
          ['9', '', '', '', ''],
          ['10', '', '', '', ''],
        ]
      ),

      p('Toplam Katılımcı Sayısı: ____'),
      p(''),

      h(2, 'EĞİTMEN ONAYI'),
      p('Yukarıda belirtilen eğitim, belirtilen tarih ve saatte verilmiştir.'),
      p(''),
      table(
        ['Eğitmen', 'İşveren / Vekili'],
        [
          ['{{uzman_adi}}', ''],
          ['İmza:', 'İmza:'],
          ['Tarih: {{bugun}}', 'Tarih: {{bugun}}'],
        ]
      ),
    ],
  },
};

// ============================================================
// 4. Acil Durum Planı
// ============================================================
export const ACIL_DURUM_PLANI: P1Template = {
  id: 'acil-durum-plani',
  groupKey: 'acil-durum',
  title: 'Acil Durum Planı',
  description: 'İşyeri acil durum eylem planı',
  variables: ['firma_adi', 'firma_adresi', 'firma_sehir', 'tehlike_sinifi', 'personel_sayisi', 'uzman_adi', 'isyeri_hekimi', 'rapor_tarihi', 'bir_yil_sonra'],
  content: {
    type: 'doc',
    content: [
      h(1, 'ACİL DURUM PLANI'),
      p('{{firma_adi}}'),
      { type: 'horizontalRule' },

      h(2, '1. AMAÇ'),
      p('Bu plan, {{firma_adi}} işyerinde meydana gelebilecek acil durumlarda (yangın, deprem, patlama, kimyasal kazalar, iş kazaları vb.) çalışanların güvenliğini sağlamak, can ve mal kaybını en aza indirmek amacıyla hazırlanmıştır.'),

      h(2, '2. KAPSAM'),
      p('Bu plan, {{firma_adi}} bünyesindeki tüm çalışanları, ziyaretçileri, taşeron firma çalışanlarını ve işyerinde bulunan tüm kişileri kapsar.'),

      h(2, '3. YASAL DAYANAK'),
      bullet([
        '6331 sayılı İş Sağlığı ve Güvenliği Kanunu',
        'İşyerlerinde Acil Durumlar Hakkında Yönetmelik',
        'Binaların Yangından Korunması Hakkında Yönetmelik',
        'İlkyardım Yönetmeliği',
      ]),

      h(2, '4. İŞYERİ BİLGİLERİ'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri Adı', '{{firma_adi}}'],
          ['Adres', '{{firma_adresi}}, {{firma_sehir}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Çalışan Sayısı', '{{personel_sayisi}}'],
          ['İSG Uzmanı', '{{uzman_adi}}'],
          ['İşyeri Hekimi', '{{isyeri_hekimi}}'],
          ['Plan Geçerlilik', '{{rapor_tarihi}} – {{bir_yil_sonra}}'],
        ]
      ),

      h(2, '5. ACİL DURUM TÜRLERİ'),
      bullet([
        'Yangın',
        'Deprem',
        'Patlama',
        'Kimyasal madde sızıntısı/dökülmesi',
        'İş kazası (ağır yaralanma)',
        'Doğal afetler (sel, fırtına)',
        'Sabotaj / Bomba ihbarı',
        'Elektrik arızası / Enerji kesintisi',
      ]),

      h(2, '6. ACİL DURUM EKİPLERİ'),
      table(
        ['Ekip', 'Ekip Başkanı', 'Üye Sayısı'],
        [
          ['Söndürme Ekibi', '', ''],
          ['Kurtarma Ekibi', '', ''],
          ['Koruma Ekibi', '', ''],
          ['İlkyardım Ekibi', '', ''],
          ['Tahliye Ekibi', '', ''],
        ]
      ),

      h(2, '7. TAHLİYE PROSEDÜRÜ'),
      p('Acil durum alarmı verildiğinde:'),
      bullet([
        'Tüm çalışanlar sakin bir şekilde en yakın acil çıkışa yönelir.',
        'Asansör kesinlikle kullanılmaz.',
        'Toplanma alanında ekip başkanları yoklama yapar.',
        'Eksik personel varsa derhal acil durum koordinatörüne bildirilir.',
        'Acil durum ekipleri görev yerlerine geçer.',
        'Durum güvenli hale gelene kadar toplanma alanında beklenir.',
      ]),

      h(2, '8. ACİL DURUM TELEFON NUMARALARI'),
      table(
        ['Birim', 'Telefon'],
        [
          ['Ambulans', '112'],
          ['İtfaiye', '110'],
          ['Polis', '155'],
          ['Jandarma', '156'],
          ['AFAD', '122'],
          ['Zehir Danışma', '114'],
          ['İSG Uzmanı', ''],
          ['İşyeri Hekimi', ''],
          ['Genel Müdür', ''],
        ]
      ),

      h(2, '9. ONAY'),
      table(
        ['Hazırlayan', 'Onaylayan'],
        [
          ['{{uzman_adi}}', ''],
          ['İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{rapor_tarihi}}', 'Tarih: {{rapor_tarihi}}'],
        ]
      ),
    ],
  },
};

// ============================================================
// 5. Tespit ve Öneri Defteri
// ============================================================
export const TESPIT_ONERI_DEFTERI: P1Template = {
  id: 'tespit-oneri-defteri',
  groupKey: 'risk-degerlendirme',
  title: 'Tespit ve Öneri Defteri',
  description: 'İSG uzmanı ve işyeri hekimi tespit ve önerileri',
  variables: ['firma_adi', 'bugun', 'uzman_adi', 'uzman_sinifi', 'uzman_belge_no', 'isyeri_hekimi'],
  content: {
    type: 'doc',
    content: [
      h(1, 'İŞ SAĞLIĞI VE GÜVENLİĞİ TESPİT VE ÖNERİ DEFTERİ'),
      p('{{firma_adi}}'),
      { type: 'horizontalRule' },

      h(2, 'GENEL BİLGİLER'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['İşyeri Unvanı', '{{firma_adi}}'],
          ['Defter No', ''],
          ['Sayfa No', ''],
        ]
      ),

      h(2, 'TESPİT VE ÖNERİ KAYDI'),
      table(
        ['Bilgi', 'Değer'],
        [
          ['Tarih', '{{bugun}}'],
          ['Tespit Eden', '{{uzman_adi}}'],
          ['Unvan', '{{uzman_sinifi}} İSG Uzmanı'],
          ['Belge No', '{{uzman_belge_no}}'],
        ]
      ),

      h(3, 'TESPİTLER'),
      p('İşyerinde yapılan inceleme sonucunda aşağıdaki hususlar tespit edilmiştir:'),
      p(''),
      p('1. '),
      p('2. '),
      p('3. '),

      h(3, 'ÖNERİLER'),
      p('Tespit edilen hususlarla ilgili aşağıdaki önlemler önerilmektedir:'),
      p(''),
      table(
        ['No', 'Öneri', 'Öncelik', 'Termin'],
        [
          ['1', '', 'Acil / Öncelikli / Normal', ''],
          ['2', '', '', ''],
          ['3', '', '', ''],
        ]
      ),

      h(3, 'YASAL DAYANAK'),
      p('6331 sayılı İSG Kanunu Madde 8 - İş güvenliği uzmanlarının görev, yetki ve yükümlülükleri kapsamında bu tespitler ve öneriler kaydedilmiştir.'),

      p(''),
      h(2, 'İMZALAR'),
      table(
        ['Tespit Eden', 'İşveren / Vekili'],
        [
          ['{{uzman_adi}}', ''],
          ['İSG Uzmanı', 'Ad Soyad:'],
          ['İmza:', 'İmza:'],
          ['Tarih: {{bugun}}', 'Tarih:'],
        ]
      ),

      p('Not: İşveren, iş güvenliği uzmanı tarafından bildirilen eksiklik ve aksaklıkları acil durumlar veya hayati tehlike arz eden hususlarda derhal, diğer hususlarda makul süre içinde yerine getirmek zorundadır. (6331 sayılı Kanun, Md. 8/2)'),
    ],
  },
};

// All P1 Templates (original 5)
export const P1_TEMPLATES: P1Template[] = [
  RISK_RAPORU,
  KURUL_TUTANAGI,
  EGITIM_KATILIM_FORMU,
  ACIL_DURUM_PLANI,
  TESPIT_ONERI_DEFTERI,
];

// Lazy-loaded full template registry (all 101 templates)
let _allTemplates: P1Template[] | null = null;

async function loadAllTemplates(): Promise<P1Template[]> {
  if (_allTemplates) return _allTemplates;

  const [g1, g2, g3, g4, g5, g6] = await Promise.all([
    import('./document-templates-g1'),
    import('./document-templates-g2'),
    import('./document-templates-g3'),
    import('./document-templates-g4'),
    import('./document-templates-g5'),
    import('./document-templates-g6'),
  ]);

  _allTemplates = [
    ...P1_TEMPLATES,
    ...g1.GROUP1_TEMPLATES, ...g1.GROUP2_TEMPLATES,
    ...g2.GROUP3_TEMPLATES, ...g2.GROUP4_TEMPLATES, ...g2.GROUP5_TEMPLATES,
    ...g3.GROUP6_TEMPLATES, ...g3.GROUP7_TEMPLATES, ...g3.GROUP8_TEMPLATES, ...g3.GROUP9_TEMPLATES, ...g3.GROUP10_TEMPLATES,
    ...g4.GROUP11_TEMPLATES, ...g4.GROUP12_TEMPLATES, ...g4.GROUP13_TEMPLATES, ...g4.GROUP14_TEMPLATES, ...g4.GROUP15_TEMPLATES,
    ...g5.GROUP16_TEMPLATES, ...g5.GROUP17_TEMPLATES, ...g5.GROUP18_TEMPLATES, ...g5.GROUP19_TEMPLATES, ...g5.GROUP20_TEMPLATES,
    ...g6.GROUP21_TEMPLATES,
  ];
  return _allTemplates;
}

// Sync: search P1 first (fast), fallback returns undefined
export function getP1Template(id: string): P1Template | undefined {
  return P1_TEMPLATES.find((t) => t.id === id);
}

// Async: search ALL templates including lazy-loaded groups
export async function getTemplate(id: string): Promise<P1Template | undefined> {
  // Check P1 first (no import needed)
  const p1 = P1_TEMPLATES.find((t) => t.id === id);
  if (p1) return p1;

  // Load all templates
  const all = await loadAllTemplates();
  return all.find((t) => t.id === id);
}
