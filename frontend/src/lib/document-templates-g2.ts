// ============================================================
// Group 3: Egitim — 7 sablon (egitim-katilim-formu, egitim-sertifika P1'de)
// Group 4: Risk — 7 sablon (risk-raporu, tespit-oneri-defteri P1'de)
// Group 5: Acil Durum — 9 sablon (acil-durum-plani P1'de)
// ============================================================

import { h, p, table, bullet } from './document-templates-p1';
import type { P1Template } from './document-templates-p1';

// ============================================================
// GROUP 3 — EGiTiM
// ============================================================

export const GROUP3_TEMPLATES: P1Template[] = [
  // 3-1 Yillik Egitim Plani
  {
    id: 'egitim-yillik-plan',
    groupKey: 'egitim',
    title: 'Yıllık Eğitim Planı',
    description: '6331 sayılı Kanun kapsamında yıllık İSG eğitim takvimi',
    variables: ['firma_adi', 'uzman_adi', 'yil', 'tehlike_sinifi', 'personel_sayisi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'YILLIK İSG EĞİTİM PLANI — {{yil}}'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. GENEL BİLGİLER'),
        table(['Bilgi', 'Değer'], [
          ['İşyeri Unvanı', '{{firma_adi}}'],
          ['Tehlike Sınıfı', '{{tehlike_sinifi}}'],
          ['Toplam Çalışan Sayısı', '{{personel_sayisi}}'],
          ['Plan Dönemi', '{{yil}}'],
          ['Hazırlayan', '{{uzman_adi}}'],
        ]),
        h(2, '2. YASAL DAYANAK'),
        bullet([
          '6331 sayılı İş Sağlığı ve Güvenliği Kanunu Madde 17',
          'Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik',
          'Az tehlikeli: 8 saat/yıl, Tehlikeli: 12 saat/yıl, Çok tehlikeli: 16 saat/yıl',
        ]),
        h(2, '3. AYLIK EĞİTİM TAKVİMİ'),
        table(
          ['Ay', 'Eğitim Konusu', 'Süre', 'Eğitimci', 'Hedef Kitle', 'Yöntem'],
          [
            ['Ocak', 'Genel İSG kuralları ve mevzuat', '2 saat', '{{uzman_adi}}', 'Tüm çalışanlar', 'Sınıf içi'],
            ['Şubat', 'Kişisel koruyucu donanım (KKD) kullanımı', '2 saat', '{{uzman_adi}}', 'Üretim personeli', 'Uygulamalı'],
            ['Mart', 'Yangın güvenliği ve söndürme teknikleri', '2 saat', 'Sivil Savunma Uzmanı', 'Tüm çalışanlar', 'Tatbikat'],
            ['Nisan', 'Ergonomi ve doğru çalışma pozisyonları', '1 saat', '{{uzman_adi}}', 'Ofis personeli', 'Sınıf içi'],
            ['Mayıs', 'Kimyasal madde güvenliği ve MSDS', '2 saat', '{{uzman_adi}}', 'Üretim personeli', 'Sınıf içi'],
            ['Haziran', 'Elektrik güvenliği', '1 saat', '{{uzman_adi}}', 'Teknik personel', 'Sınıf içi'],
            ['Temmuz', 'Sıcak ortamda çalışma ve sıvı tüketimi', '1 saat', '{{uzman_adi}}', 'Saha personeli', 'Sınıf içi'],
            ['Ağustos', 'İlkyardım temel uygulamaları', '2 saat', 'Sertifikalı İlkyardımcı', 'Tüm çalışanlar', 'Uygulamalı'],
            ['Eylül', 'İş kazası bildirim süreci ve ramak kala', '1 saat', '{{uzman_adi}}', 'Tüm çalışanlar', 'Sınıf içi'],
            ['Ekim', 'Yüksekte çalışma güvenliği', '2 saat', '{{uzman_adi}}', 'Teknik personel', 'Uygulamalı'],
            ['Kasım', 'Acil durum ve tahliye tatbikatı', '2 saat', '{{uzman_adi}}', 'Tüm çalışanlar', 'Tatbikat'],
            ['Aralık', 'Yıl sonu değerlendirme ve genel tekrar', '2 saat', '{{uzman_adi}}', 'Tüm çalışanlar', 'Sınıf içi'],
          ]
        ),
        h(2, '4. ONAY'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}}', ''],
          ['İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 3-2 Egitim Ihtiyac Analizi
  {
    id: 'egitim-ihtiyac-analizi',
    groupKey: 'egitim',
    title: 'Eğitim İhtiyaç Analizi',
    description: 'Çalışan bazlı İSG eğitim ihtiyaç değerlendirme formu',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'yil'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM İHTİYAÇ ANALİZİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('Bu form, 6331 sayılı İSG Kanunu Madde 17 kapsamında çalışanların eğitim ihtiyaçlarının belirlenmesi ve yıllık eğitim planına girdi sağlanması amacıyla hazırlanmıştır.'),
        h(2, '2. ANALİZ KRİTERLERİ'),
        bullet([
          'İş kazası ve ramak kala olay istatistikleri',
          'Risk değerlendirme sonuçları',
          'Denetim ve kontrol bulguları',
          'Çalışan geri bildirimleri',
          'Yasal zorunluluklar ve mevzuat değişiklikleri',
          'Yeni ekipman / proses / teknoloji değişiklikleri',
        ]),
        h(2, '3. DEPARTMAN BAZLI İHTİYAÇ MATRİSİ'),
        table(
          ['Departman', 'Mevcut Eğitim Durumu', 'Eksik Konular', 'Öncelik', 'Önerilen Süre'],
          [
            ['Üretim', '', '', 'Yüksek / Orta / Düşük', ''],
            ['Depo / Lojistik', '', '', 'Yüksek / Orta / Düşük', ''],
            ['Teknik / Bakım', '', '', 'Yüksek / Orta / Düşük', ''],
            ['Ofis / İdari', '', '', 'Yüksek / Orta / Düşük', ''],
            ['Taşeron', '', '', 'Yüksek / Orta / Düşük', ''],
          ]
        ),
        h(2, '4. BİREYSEL İHTİYAÇ BELİRLEME'),
        table(
          ['Çalışan Adı', 'Departman', 'Eksik Eğitim', 'Son Eğitim Tarihi', 'Planlanan Tarih'],
          [
            ['', '', '', '', ''],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
          ]
        ),
        h(2, '5. DEĞERLENDİRME VE SONUÇ'),
        p('Analiz sonucunda belirlenen eğitim ihtiyaçları {{yil}} yıllık eğitim planına yansıtılacaktır.'),
        p(''),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 3-3 Egitim Degerlendirme Formu
  {
    id: 'egitim-degerlendirme',
    groupKey: 'egitim',
    title: 'Eğitim Değerlendirme Formu',
    description: 'Eğitim sonrası katılımcı değerlendirme anketi',
    variables: ['firma_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM DEĞERLENDİRME FORMU'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, 'EĞİTİM BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Eğitim Konusu', ''],
          ['Eğitim Tarihi', '{{bugun}}'],
          ['Eğitim Süresi', ''],
          ['Eğitimci', ''],
          ['Eğitim Yeri', ''],
        ]),
        h(2, 'KATILIMCI DEĞERLENDİRMESİ'),
        p('Lütfen aşağıdaki ifadeleri 1 (Çok Kötü) ile 5 (Çok İyi) arasında puanlayınız.'),
        table(
          ['Değerlendirme Kriteri', '1', '2', '3', '4', '5'],
          [
            ['Eğitim içeriği ihtiyaçlarıma uygundu', '☐', '☐', '☐', '☐', '☐'],
            ['Eğitimci konuya hakimdi', '☐', '☐', '☐', '☐', '☐'],
            ['Anlatım açık ve anlaşılırdı', '☐', '☐', '☐', '☐', '☐'],
            ['Eğitim materyalleri yeterliydi', '☐', '☐', '☐', '☐', '☐'],
            ['Eğitim süresi yeterliydi', '☐', '☐', '☐', '☐', '☐'],
            ['Eğitim ortamı uygundu', '☐', '☐', '☐', '☐', '☐'],
            ['Öğrendiklerimi işimde uygulayabilirim', '☐', '☐', '☐', '☐', '☐'],
          ]
        ),
        h(2, 'AÇIK UÇLU SORULAR'),
        p('Eğitimde en faydalı bulduğunuz konu neydi?'),
        p(''),
        p('Eğitimde geliştirilmesi gereken yönler nelerdir?'),
        p(''),
        p('Ek eğitim ihtiyacınız var mı? Belirtiniz:'),
        p(''),
        h(2, 'KATILIMCI BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Adı Soyadı', ''],
          ['Departman', ''],
          ['Tarih', '{{bugun}}'],
          ['İmza', ''],
        ]),
      ],
    },
  },

  // 3-4 Egitim Icerik Dokumani
  {
    id: 'egitim-icerik',
    groupKey: 'egitim',
    title: 'Eğitim İçerik Dokümanı',
    description: 'Eğitim müfredatı ve içerik planı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM İÇERİK DOKÜMANI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, 'EĞİTİM TANIMI'),
        table(['Bilgi', 'Değer'], [
          ['Eğitim Adı', ''],
          ['Eğitim Kodu', ''],
          ['Hedef Kitle', ''],
          ['Eğitim Süresi', ''],
          ['Eğitim Yöntemi', 'Sınıf içi / Uygulamalı / E-öğrenme'],
          ['Eğitimci', '{{uzman_adi}}'],
          ['Revizyon Tarihi', '{{bugun}}'],
        ]),
        h(2, 'AMAÇ VE KAZANIMLAR'),
        p('Bu eğitimin tamamlanmasının ardından katılımcılar aşağıdaki kazanımlara ulaşacaktır:'),
        bullet([
          'İşyerindeki tehlike ve riskleri tanımlayabilecektir.',
          'Güvenli çalışma yöntemlerini uygulayabilecektir.',
          'Acil durumlarda doğru müdahale yapabilecektir.',
        ]),
        h(2, 'EĞİTİM MÜFREDATI'),
        table(
          ['Bölüm', 'Konu Başlığı', 'Süre', 'Yöntem', 'Materyal'],
          [
            ['1', 'Giriş ve tanışma', '15 dk', 'Sunum', 'Slayt'],
            ['2', 'Yasal mevzuat bilgilendirme', '30 dk', 'Anlatım', 'Slayt + Doküman'],
            ['3', 'Tehlike tanımlama ve örnekler', '30 dk', 'Anlatım + Görsel', 'Fotoğraf / Video'],
            ['4', 'Uygulamalı çalışma', '30 dk', 'Uygulama', 'Ekipman'],
            ['5', 'Soru-cevap ve değerlendirme', '15 dk', 'Tartışma', 'Test formu'],
          ]
        ),
        h(2, 'DEĞERLENDİRME YÖNTEMİ'),
        bullet([
          'Eğitim sonu yazılı test (en az 70 puan başarı)',
          'Uygulamalı değerlendirme (gözlem formu)',
          'Katılımcı memnuniyet anketi',
        ]),
        p(''),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },

  // 3-5 Egitim Etkinlik Olcum Formu
  {
    id: 'egitim-etkinlik',
    groupKey: 'egitim',
    title: 'Eğitim Etkinlik Ölçüm Formu',
    description: 'Verilen eğitimin sahada etkinliğinin ölçümü',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM ETKİNLİK ÖLÇÜM FORMU'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, 'EĞİTİM BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Eğitim Konusu', ''],
          ['Eğitim Tarihi', ''],
          ['Katılımcı Sayısı', ''],
          ['Ölçüm Tarihi', '{{bugun}}'],
          ['Ölçümü Yapan', '{{uzman_adi}}'],
        ]),
        h(2, 'ETKİNLİK KRİTERLERİ'),
        p('Her kriter 1 (Yetersiz) – 5 (Mükemmel) arasında puanlanır.'),
        table(
          ['Kriter', 'Puan (1-5)', 'Açıklama'],
          [
            ['Bilgi düzeyindeki artış', '', 'Eğitim öncesi/sonrası test karşılaştırması'],
            ['Davranış değişikliği', '', 'Sahada güvenli davranış gözlemi'],
            ['Kural ve prosedürlere uyum', '', 'Uygunsuzluk sayısındaki değişim'],
            ['İş kazası oranı etkisi', '', 'Eğitim sonrası kaza istatistikleri'],
            ['KKD kullanım oranı', '', 'Saha gözlem sonuçları'],
            ['Çalışan memnuniyeti', '', 'Anket sonuçları'],
          ]
        ),
        h(2, 'GENEL DEĞERLENDİRME'),
        p('Eğitim etkinlik düzeyi: ☐ Etkili  ☐ Kısmen Etkili  ☐ Etkisiz'),
        p('Tekrar eğitim gerekli mi: ☐ Evet  ☐ Hayır'),
        p('Açıklama:'),
        p(''),
        table(['Değerlendiren', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 3-6 Egitim Talep Formu
  {
    id: 'egitim-talep',
    groupKey: 'egitim',
    title: 'Eğitim Talep Formu',
    description: 'Departman veya çalışan bazlı eğitim talep belgesi',
    variables: ['firma_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM TALEP FORMU'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, 'TALEP EDEN BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Adı Soyadı', ''],
          ['Departman', ''],
          ['Görevi', ''],
          ['Talep Tarihi', '{{bugun}}'],
        ]),
        h(2, 'TALEP EDİLEN EĞİTİM'),
        table(['Bilgi', 'Değer'], [
          ['Eğitim Konusu', ''],
          ['Eğitim Gerekçesi', ''],
          ['Katılımcı Sayısı', ''],
          ['Tercih Edilen Tarih', ''],
          ['Tercih Edilen Yöntem', 'Sınıf içi / Uygulamalı / E-öğrenme'],
        ]),
        h(2, 'GEREKÇE DETAYI'),
        bullet([
          '☐ Yasal zorunluluk',
          '☐ Risk değerlendirme sonucu',
          '☐ İş kazası / ramak kala sonrası',
          '☐ Yeni ekipman / proses',
          '☐ Çalışan talebi',
          '☐ Denetim bulgusu',
          '☐ Diğer: ___________',
        ]),
        h(2, 'ONAY'),
        table(['', 'Talep Eden', 'Birim Amiri', 'İSG Uzmanı'], [
          ['Ad Soyad', '', '', ''],
          ['Tarih', '{{bugun}}', '', ''],
          ['İmza', '', '', ''],
          ['Onay Durumu', '', '☐ Uygun  ☐ Uygun Değil', '☐ Uygun  ☐ Uygun Değil'],
        ]),
      ],
    },
  },

  // 3-7 Egitim Ozet Raporu
  {
    id: 'egitim-ozet-raporu',
    groupKey: 'egitim',
    title: 'Eğitim Özet Raporu',
    description: 'Dönemsel İSG eğitim faaliyetleri özet raporu',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'yil'],
    content: {
      type: 'doc',
      content: [
        h(1, 'EĞİTİM ÖZET RAPORU'),
        p('{{firma_adi}} — {{yil}}'),
        { type: 'horizontalRule' },
        h(2, '1. GENEL BİLGİLER'),
        table(['Bilgi', 'Değer'], [
          ['Rapor Dönemi', '{{yil}}'],
          ['Hazırlayan', '{{uzman_adi}}'],
          ['Rapor Tarihi', '{{bugun}}'],
        ]),
        h(2, '2. EĞİTİM İSTATİSTİKLERİ'),
        table(
          ['Gösterge', 'Hedef', 'Gerçekleşen', 'Oran'],
          [
            ['Toplam eğitim sayısı', '', '', ''],
            ['Toplam eğitim saati', '', '', ''],
            ['Katılımcı sayısı (toplam)', '', '', ''],
            ['Kişi başı ortalama eğitim saati', '', '', ''],
            ['Eğitim tamamlama oranı', '%100', '', ''],
          ]
        ),
        h(2, '3. EĞİTİM KONULARINA GÖRE DAĞILIM'),
        table(
          ['Eğitim Konusu', 'Sayı', 'Katılımcı', 'Süre (saat)'],
          [
            ['Genel İSG', '', '', ''],
            ['Yangın güvenliği', '', '', ''],
            ['İlkyardım', '', '', ''],
            ['KKD kullanımı', '', '', ''],
            ['Kimyasal güvenlik', '', '', ''],
            ['Acil durum tatbikatı', '', '', ''],
            ['Diğer', '', '', ''],
          ]
        ),
        h(2, '4. DEĞERLENDİRME VE ÖNERİLER'),
        bullet([
          'Eğitim hedeflerine ulaşma durumu değerlendirilmelidir.',
          'Katılımı düşük olan departmanlar için ek eğitim planlanmalıdır.',
          'Eğitim etkinlik ölçüm sonuçları göz önünde bulundurulmalıdır.',
        ]),
        p(''),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },
];

// ============================================================
// GROUP 4 — RİSK
// ============================================================

export const GROUP4_TEMPLATES: P1Template[] = [
  // 4-1 Tehlike ve Risk Envanteri
  {
    id: 'risk-envanter',
    groupKey: 'risk-degerlendirme',
    title: 'Tehlike ve Risk Envanteri',
    description: 'İşyeri genelinde tehlike tanımlama ve risk sınıflandırma envanteri',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'rapor_tarihi'],
    content: {
      type: 'doc',
      content: [
        h(1, 'TEHLİKE VE RİSK ENVANTERİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('6331 sayılı İSG Kanunu ve İSG Risk Değerlendirmesi Yönetmeliği kapsamında işyerinde mevcut ve potansiyel tehlikelerin sistematik olarak envanterinin çıkarılması.'),
        h(2, '2. TEHLİKE ENVANTERİ'),
        table(
          ['No', 'Faaliyet / Alan', 'Tehlike', 'Risk', 'Etkilenen Kişiler', 'Olasılık', 'Şiddet', 'Risk Skoru', 'Risk Seviyesi'],
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
          ]
        ),
        h(2, '3. RİSK SEVİYE AÇIKLAMASI'),
        table(['Skor Aralığı', 'Seviye', 'Açıklama'], [
          ['1-5', 'Düşük (Kabul Edilebilir)', 'Mevcut kontroller yeterli'],
          ['6-12', 'Orta (Dikkate Değer)', 'İyileştirme planlanmalı'],
          ['13-25', 'Yüksek (Kabul Edilemez)', 'Acil önlem alınmalı'],
        ]),
        p(''),
        table(['Hazırlayan', 'Kontrol Eden'], [
          ['{{uzman_adi}} — İSG Uzmanı', ''],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 4-2 Risk Aksiyon Plani
  {
    id: 'risk-aksiyon-plani',
    groupKey: 'risk-degerlendirme',
    title: 'Risk Aksiyon Planı',
    description: 'Risk azaltma faaliyetleri, sorumlular ve termin takibi',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'RİSK AKSİYON PLANI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('Risk değerlendirme sonuçlarına göre belirlenen önlemlerin planlanması, sorumlulukların atanması ve termin tarihlerinin takibi amacıyla hazırlanmıştır.'),
        h(2, '2. AKSİYON PLANI'),
        table(
          ['No', 'Tehlike / Risk', 'Mevcut Risk Skoru', 'Alınacak Önlem', 'Sorumlu', 'Termin', 'Hedef Risk Skoru', 'Durum'],
          [
            ['1', '', '', '', '', '', '', '☐ Açık'],
            ['2', '', '', '', '', '', '', '☐ Açık'],
            ['3', '', '', '', '', '', '', '☐ Açık'],
            ['4', '', '', '', '', '', '', '☐ Açık'],
            ['5', '', '', '', '', '', '', '☐ Açık'],
            ['6', '', '', '', '', '', '', '☐ Açık'],
            ['7', '', '', '', '', '', '', '☐ Açık'],
            ['8', '', '', '', '', '', '', '☐ Açık'],
          ]
        ),
        h(2, '3. ÖNLEMLERİN HİYERARŞİSİ'),
        bullet([
          '1. Eliminasyon — Tehlikenin tamamen ortadan kaldırılması',
          '2. Substitüsyon — Daha az tehlikeli olanla değiştirilmesi',
          '3. Mühendislik kontrolleri — Koruma bariyerleri, havalandırma vb.',
          '4. İdari kontroller — Prosedür, eğitim, işaret, rotasyon',
          '5. KKD — Kişisel koruyucu donanım kullanımı',
        ]),
        h(2, '4. ONAY'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 4-3 Kaza Sonrasi Risk Guncelleme
  {
    id: 'is-kazasi-risk',
    groupKey: 'risk-degerlendirme',
    title: 'Kaza Sonrası Risk Güncelleme',
    description: 'İş kazası sonrası risk değerlendirme güncelleme raporu',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'KAZA SONRASI RİSK DEĞERLENDİRME GÜNCELLEMESİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. KAZA BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Kaza Tarihi', ''],
          ['Kaza Yeri', ''],
          ['Kazazede(ler)', ''],
          ['Kaza Türü', ''],
          ['Yaralanma Durumu', ''],
          ['İş Günü Kaybı', ''],
        ]),
        h(2, '2. MEVCUT RİSK DEĞERLENDİRME BİLGİSİ'),
        table(['Parametre', 'Kaza Öncesi', 'Kaza Sonrası'], [
          ['Tehlike Tanımı', '', ''],
          ['Risk Skoru', '', ''],
          ['Risk Seviyesi', '', ''],
          ['Mevcut Kontroller', '', ''],
        ]),
        h(2, '3. KÖK NEDEN ANALİZİ SONUCU'),
        p('Kazanın temel nedenleri:'),
        bullet([
          'Güvensiz davranış: ',
          'Güvensiz durum: ',
          'Yönetim sistemi eksikliği: ',
        ]),
        h(2, '4. GÜNCELLENEN RİSK VE YENİ ÖNLEMLER'),
        table(
          ['Yeni/Güncellenen Risk', 'Yeni Skor', 'Ek Önlem', 'Sorumlu', 'Termin'],
          [
            ['', '', '', '', ''],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
          ]
        ),
        h(2, '5. ONAY'),
        p('6331 sayılı Kanun Madde 10/4: İş kazası sonrasında risk değerlendirmesi yenilenmelidir.'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 4-4 Risk Haritasi Dokumani
  {
    id: 'risk-haritasi',
    groupKey: 'risk-degerlendirme',
    title: 'Risk Haritası Dokümanı',
    description: 'İşyeri bölgelerine göre risk haritası ve tehlike dağılımı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'RİSK HARİTASI DOKÜMANI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('İşyeri bölgelerine göre tehlike ve risklerin görsel olarak haritalanması, yüksek riskli alanların belirlenmesi amacıyla hazırlanmıştır.'),
        h(2, '2. BÖLGE BAZLI RİSK DAĞILIMI'),
        table(
          ['Bölge / Alan', 'Yüksek Risk', 'Orta Risk', 'Düşük Risk', 'Toplam', 'Genel Seviye'],
          [
            ['Üretim alanı', '', '', '', '', ''],
            ['Depo alanı', '', '', '', '', ''],
            ['Ofis alanı', '', '', '', '', ''],
            ['Teknik / bakım alanı', '', '', '', '', ''],
            ['Açık alan / park', '', '', '', '', ''],
            ['Yemekhane / sosyal alan', '', '', '', '', ''],
            ['Laboratuvar', '', '', '', '', ''],
          ]
        ),
        h(2, '3. YÜKSEK RİSKLİ ALANLAR'),
        table(['Alan', 'Başlıca Tehlikeler', 'Mevcut Önlemler', 'Ek Önlem Gereksinimi'], [
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ]),
        h(2, '4. RENK KODLARI'),
        table(['Renk', 'Anlam', 'Aksiyon'], [
          ['Kırmızı', 'Yüksek risk — Kabul edilemez', 'Acil önlem gerekli'],
          ['Sarı', 'Orta risk — Dikkate değer', 'Planlı iyileştirme'],
          ['Yeşil', 'Düşük risk — Kabul edilebilir', 'Mevcut kontrol yeterli'],
        ]),
        p('Not: Risk haritası yerleşim planı krokisi üzerinde ek olarak işaretlenecektir.'),
        p(''),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },

  // 4-5 Risk Izleme Raporu
  {
    id: 'risk-izleme-raporu',
    groupKey: 'risk-degerlendirme',
    title: 'Risk İzleme Raporu',
    description: 'Periyodik risk izleme ve önlem takip raporu',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'ay_yil'],
    content: {
      type: 'doc',
      content: [
        h(1, 'RİSK İZLEME RAPORU'),
        p('{{firma_adi}} — {{ay_yil}}'),
        { type: 'horizontalRule' },
        h(2, '1. DÖNEM BİLGİSİ'),
        table(['Bilgi', 'Değer'], [
          ['Rapor Dönemi', '{{ay_yil}}'],
          ['Hazırlayan', '{{uzman_adi}}'],
          ['Rapor Tarihi', '{{bugun}}'],
        ]),
        h(2, '2. RİSK DURUM ÖZETİ'),
        table(['Gösterge', 'Önceki Dönem', 'Bu Dönem', 'Değişim'], [
          ['Toplam risk sayısı', '', '', ''],
          ['Yüksek riskli madde sayısı', '', '', ''],
          ['Tamamlanan aksiyon sayısı', '', '', ''],
          ['Geciken aksiyon sayısı', '', '', ''],
          ['Yeni tespit edilen tehlike', '', '', ''],
        ]),
        h(2, '3. AKSİYON TAKİP'),
        table(
          ['Aksiyon No', 'Açıklama', 'Sorumlu', 'Termin', 'Durum', 'Açıklama'],
          [
            ['', '', '', '', '☐ Tamamlandı / ☐ Devam / ☐ Gecikti', ''],
            ['', '', '', '', '☐ Tamamlandı / ☐ Devam / ☐ Gecikti', ''],
            ['', '', '', '', '☐ Tamamlandı / ☐ Devam / ☐ Gecikti', ''],
          ]
        ),
        h(2, '4. DEĞERLENDİRME'),
        p('Risk izleme dönemi boyunca yapılan gözlem ve değerlendirmeler:'),
        p(''),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 4-6 Risk Iletisim Formu
  {
    id: 'risk-iletisim-formu',
    groupKey: 'risk-degerlendirme',
    title: 'Risk İletişim Formu',
    description: 'Çalışanlara risk değerlendirme sonuçlarının bildirilmesi',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'RİSK İLETİŞİM FORMU'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('6331 sayılı Kanun Madde 16 gereğince, risk değerlendirme sonuçları ve alınması gereken önlemler hakkında çalışanların bilgilendirilmesi.'),
        h(2, '2. İLETİŞİM BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Bilgilendirme Tarihi', '{{bugun}}'],
          ['Bilgilendiren', '{{uzman_adi}}'],
          ['Bilgilendirme Yöntemi', '☐ Toplantı  ☐ Yazılı  ☐ Pano  ☐ E-posta'],
          ['Hedef Kitle', ''],
        ]),
        h(2, '3. BİLDİRİLEN RİSKLER'),
        table(
          ['No', 'Çalışma Alanı', 'Tehlike', 'Risk Seviyesi', 'Alınacak Önlem'],
          [
            ['1', '', '', '', ''],
            ['2', '', '', '', ''],
            ['3', '', '', '', ''],
            ['4', '', '', '', ''],
            ['5', '', '', '', ''],
          ]
        ),
        h(2, '4. ÇALIŞAN BEYANI'),
        p('Yukarıda belirtilen riskler ve alınması gereken önlemler tarafıma bildirilmiştir.'),
        table(['Sıra', 'Ad Soyad', 'Departman', 'İmza', 'Tarih'], [
          ['1', '', '', '', '{{bugun}}'],
          ['2', '', '', '', '{{bugun}}'],
          ['3', '', '', '', '{{bugun}}'],
          ['4', '', '', '', '{{bugun}}'],
          ['5', '', '', '', '{{bugun}}'],
        ]),
      ],
    },
  },

  // 4-7 Risk Metodoloji Belgesi
  {
    id: 'risk-metodoloji',
    groupKey: 'risk-degerlendirme',
    title: 'Risk Metodoloji Belgesi',
    description: 'Risk değerlendirmede kullanılan yöntemlerin tanımı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'RİSK DEĞERLENDİRME METODOLOJİ BELGESİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('İşyerinde uygulanan risk değerlendirme yöntemlerinin, puanlama kriterlerinin ve karar mekanizmalarının tanımlanması amacıyla hazırlanmıştır.'),
        h(2, '2. YASAL DAYANAK'),
        bullet([
          '6331 sayılı İş Sağlığı ve Güvenliği Kanunu Madde 10',
          'İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği',
          'TS ISO 31000 Risk Yönetimi Standardı',
        ]),
        h(2, '3. KULLANILAN YÖNTEMLER'),
        h(3, '3.1 Matris Yöntemi (L Tipi 5×5)'),
        p('Risk Skoru = Olasılık × Şiddet'),
        table(['', '1 - Çok Hafif', '2 - Hafif', '3 - Orta', '4 - Ciddi', '5 - Çok Ciddi'], [
          ['5 - Çok Yüksek', '5', '10', '15', '20', '25'],
          ['4 - Yüksek', '4', '8', '12', '16', '20'],
          ['3 - Orta', '3', '6', '9', '12', '15'],
          ['2 - Düşük', '2', '4', '6', '8', '10'],
          ['1 - Çok Düşük', '1', '2', '3', '4', '5'],
        ]),
        h(3, '3.2 Fine-Kinney Yöntemi'),
        p('Risk Skoru = Olasılık × Frekans × Şiddet'),
        table(['Parametre', 'Açıklama', 'Değer Aralığı'], [
          ['Olasılık (O)', 'Tehlikeli olayın gerçekleşme ihtimali', '0.1 – 10'],
          ['Frekans (F)', 'Tehlikeye maruz kalma sıklığı', '0.5 – 10'],
          ['Şiddet (Ş)', 'Olası sonucun büyüklüğü', '1 – 100'],
        ]),
        h(2, '4. RİSK SEVİYELERİ VE KARAR KRİTERLERİ'),
        table(['Skor', 'Seviye', 'Karar', 'Süre'], [
          ['1-5', 'Düşük', 'Kabul edilebilir — izle', 'Yıllık gözden geçirme'],
          ['6-12', 'Orta', 'Dikkate değer — planla', '3-6 ay içinde önlem'],
          ['13-25', 'Yüksek', 'Kabul edilemez — acil', 'Derhal önlem'],
        ]),
        p(''),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },
];

// ============================================================
// GROUP 5 — ACİL DURUM
// ============================================================

export const GROUP5_TEMPLATES: P1Template[] = [
  // 5-1 Acil Durum Ekip Listesi
  {
    id: 'acil-durum-ekip',
    groupKey: 'acil-durum',
    title: 'Acil Durum Ekip Listesi',
    description: 'Acil durum ekipleri ve görev dağılımı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM EKİP LİSTESİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. YASAL DAYANAK'),
        p('6331 sayılı Kanun Madde 11 ve İşyerlerinde Acil Durumlar Hakkında Yönetmelik gereğince acil durum ekipleri oluşturulmuştur.'),
        h(2, '2. SÖNDÜRME EKİBİ'),
        table(['Sıra', 'Ad Soyad', 'Departman', 'Telefon', 'Eğitim Tarihi'], [
          ['1 (Ekip Başı)', '', '', '', ''],
          ['2', '', '', '', ''],
          ['3', '', '', '', ''],
          ['4', '', '', '', ''],
        ]),
        h(2, '3. KURTARMA EKİBİ'),
        table(['Sıra', 'Ad Soyad', 'Departman', 'Telefon', 'Eğitim Tarihi'], [
          ['1 (Ekip Başı)', '', '', '', ''],
          ['2', '', '', '', ''],
          ['3', '', '', '', ''],
          ['4', '', '', '', ''],
        ]),
        h(2, '4. KORUMA EKİBİ'),
        table(['Sıra', 'Ad Soyad', 'Departman', 'Telefon', 'Eğitim Tarihi'], [
          ['1 (Ekip Başı)', '', '', '', ''],
          ['2', '', '', '', ''],
          ['3', '', '', '', ''],
        ]),
        h(2, '5. İLKYARDIM EKİBİ'),
        table(['Sıra', 'Ad Soyad', 'Departman', 'Telefon', 'Sertifika No', 'Geçerlilik'], [
          ['1 (Ekip Başı)', '', '', '', '', ''],
          ['2', '', '', '', '', ''],
          ['3', '', '', '', '', ''],
        ]),
        h(2, '6. ONAY'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 5-2 Tahliye Plani
  {
    id: 'tahliye-plani',
    groupKey: 'acil-durum',
    title: 'Tahliye Planı',
    description: 'İşyeri tahliye usul ve esasları',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'personel_sayisi'],
    content: {
      type: 'doc',
      content: [
        h(1, 'TAHLİYE PLANI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('Acil durumlarda tüm çalışanların güvenli ve düzenli bir şekilde tahliye edilmesine ilişkin usul ve esasları belirlemek.'),
        h(2, '2. KAPSAM'),
        p('{{firma_adi}} bünyesindeki tüm çalışanlar, ziyaretçiler ve taşeron personeli (toplam: {{personel_sayisi}} kişi) kapsar.'),
        h(2, '3. TAHLİYE UYARI SİSTEMİ'),
        table(['Uyarı Türü', 'Açıklama', 'Konum'], [
          ['Yangın alarm butonu', '', ''],
          ['Sesli alarm sistemi', '', ''],
          ['Anons sistemi', '', ''],
        ]),
        h(2, '4. TAHLİYE GÜZERGAHLARI'),
        table(['Bölge', 'Birincil Çıkış', 'İkincil Çıkış', 'Toplanma Noktası'], [
          ['Üretim alanı', '', '', ''],
          ['Ofis katı', '', '', ''],
          ['Depo', '', '', ''],
          ['Yemekhane', '', '', ''],
        ]),
        h(2, '5. TAHLİYE PROSEDÜRÜ'),
        bullet([
          'Alarm verildiğinde tüm faaliyetler derhal durdurulur.',
          'Makineler ve ekipmanlar güvenli konuma alınır (mümkünse).',
          'Asansör kullanılmaz, merdivenler kullanılır.',
          'Tahliye yönlendirme işaretleri takip edilir.',
          'Ekip başları personel sayımı yapar.',
          'Toplanma noktasında yoklama alınır.',
          'Yetkili kişi tahliyenin tamamlandığını onaylar.',
        ]),
        h(2, '6. ONAY'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 5-3 Tatbikat Raporu
  {
    id: 'tatbikat-raporu',
    groupKey: 'acil-durum',
    title: 'Tatbikat Raporu',
    description: 'Acil durum tatbikatı sonuç raporu',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'personel_sayisi'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM TATBİKAT RAPORU'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. TATBİKAT BİLGİLERİ'),
        table(['Bilgi', 'Değer'], [
          ['Tatbikat Tarihi', '{{bugun}}'],
          ['Tatbikat Saati', ''],
          ['Tatbikat Türü', '☐ Yangın  ☐ Deprem  ☐ Kimyasal Kazgı  ☐ Genel Tahliye'],
          ['Tatbikat Koordinatörü', '{{uzman_adi}}'],
          ['Toplam Çalışan Sayısı', '{{personel_sayisi}}'],
          ['Katılımcı Sayısı', ''],
        ]),
        h(2, '2. TATBİKAT SONUÇLARI'),
        table(['Kriter', 'Süre / Sonuç', 'Değerlendirme'], [
          ['Alarmın duyulması', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
          ['Tahliye süresi', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
          ['Toplanma noktası', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
          ['Yoklama süreci', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
          ['Ekip koordinasyonu', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
          ['İlkyardım müdahalesi', '', '☐ İyi  ☐ Orta  ☐ Yetersiz'],
        ]),
        h(2, '3. TESPİT VE ÖNERİLER'),
        table(['No', 'Tespit', 'Öneri', 'Sorumlu', 'Termin'], [
          ['1', '', '', '', ''],
          ['2', '', '', '', ''],
          ['3', '', '', '', ''],
        ]),
        h(2, '4. ONAY'),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 5-4 Acil Durum Telefon Listesi
  {
    id: 'acil-durum-tel',
    groupKey: 'acil-durum',
    title: 'Acil Durum Telefon Listesi',
    description: 'Acil durumlarda aranacak kurum ve kişi telefonları',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM TELEFON LİSTESİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, 'RESMİ KURUMLAR'),
        table(['Kurum', 'Telefon', 'Not'], [
          ['İtfaiye', '110', ''],
          ['Ambulans / 112 Acil', '112', ''],
          ['Polis İmdat', '155', ''],
          ['Jandarma', '156', ''],
          ['Doğalgaz Acil', '187', ''],
          ['Elektrik Arıza', '186', ''],
          ['Su Arıza', '185', ''],
          ['AFAD', '122', ''],
          ['Zehir Danışma', '114', ''],
        ]),
        h(2, 'İŞYERİ İÇİ ACİL İLETİŞİM'),
        table(['Görev', 'Ad Soyad', 'Dahili', 'Cep Telefonu'], [
          ['Acil Durum Koordinatörü', '', '', ''],
          ['İSG Uzmanı', '{{uzman_adi}}', '', ''],
          ['İşyeri Hekimi', '', '', ''],
          ['Söndürme Ekip Başı', '', '', ''],
          ['Kurtarma Ekip Başı', '', '', ''],
          ['İlkyardım Ekip Başı', '', '', ''],
          ['Güvenlik Amiri', '', '', ''],
          ['İşveren / Vekili', '', '', ''],
        ]),
        h(2, 'DIŞ HİZMET SAĞLAYICILAR'),
        table(['Hizmet', 'Firma', 'Telefon', 'İletişim Kişisi'], [
          ['OSGB', '', '', ''],
          ['Yangın tesisat bakım', '', '', ''],
          ['Asansör bakım', '', '', ''],
          ['Sigorta şirketi', '', '', ''],
        ]),
        p(''),
        p('Bu liste görünür bir yere asılmalı ve güncel tutulmalıdır. Güncelleme: {{bugun}}'),
      ],
    },
  },

  // 5-5 Acil Durum Talimati
  {
    id: 'acil-durum-talimat',
    groupKey: 'acil-durum',
    title: 'Acil Durum Talimatı',
    description: 'Genel acil durum müdahale talimatı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM TALİMATI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('Acil durumlarda (yangın, deprem, patlama, kimyasal kazgı vb.) uygulanacak genel müdahale kurallarını belirlemek.'),
        h(2, '2. YANGIN DURUMUNDA'),
        bullet([
          'Panik yapmayın, sakin olun.',
          'Yangın alarm butonuna basın.',
          'Küçük yangınlarda en yakın yangın söndürücüyü kullanın.',
          'Büyük yangınlarda tahliye edin ve 110 İtfaiye\'yi arayın.',
          'Asansör kesinlikle kullanılmaz.',
          'Duman varsa eğilerek ilerleyin.',
          'Kapalı kapı sıcaksa açmayın.',
          'Toplanma noktasına gidin.',
        ]),
        h(2, '3. DEPREM DURUMUNDA'),
        bullet([
          'ÇÖK-KAPAN-TUTUN pozisyonunu alın.',
          'Masa, sıra gibi sağlam mobilya altına sığının.',
          'Pencere, cam ve ağır eşyalardan uzak durun.',
          'Sarsıntı bitene kadar bulunduğunuz yerde kalın.',
          'Sarsıntı bittikten sonra binayı derhal terk edin.',
          'Asansör kullanılmaz.',
          'Hasar görmüş binalara girmeyin.',
        ]),
        h(2, '4. KİMYASAL KAZA / SIZINTI DURUMUNDA'),
        bullet([
          'Sızıntı bölgesini terk edin ve rüzgar üstüne geçin.',
          'KKD\'nizi takın (eldiven, maske, gözlük).',
          'Dökülme setini kullanarak sızıntıyı sınırlayın.',
          'Bölgeyi kordon altına alın.',
          'İSG uzmanını ve yönetimi bilgilendirin.',
          'MSDS formunu kontrol edin.',
        ]),
        h(2, '5. GENEL KURALLAR'),
        bullet([
          'Acil çıkış yollarını ve toplanma noktasını bilin.',
          'Yılda en az 1 kez tatbikata katılın.',
          'Ekip görevlilerine yardım edin.',
          'Yetkisiz kişiler basın açıklaması yapmaz.',
        ]),
        p(''),
        p('6331 sayılı Kanun Madde 11-12 gereğince düzenlenmiştir.'),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },

  // 5-6 Toplanma Alani Krokisi
  {
    id: 'toplanma-alani',
    groupKey: 'acil-durum',
    title: 'Toplanma Alanı Krokisi',
    description: 'Toplanma alanı belirleme ve bilgilendirme dokümanı',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'TOPLANMA ALANI KROKİSİ VE BİLGİLENDİRME'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('Acil durumlarda personelin güvenli bir şekilde toplanacağı alanların belirlenmesi ve bilgilendirilmesi.'),
        h(2, '2. TOPLANMA ALANLARI'),
        table(['No', 'Toplanma Noktası', 'Konum Tarifi', 'Kapasite', 'Sorumlu Kişi'], [
          ['1', 'Ana Toplanma Noktası', '', '', ''],
          ['2', 'Alternatif Toplanma Noktası', '', '', ''],
        ]),
        h(2, '3. TOPLANMA ALANI KRİTERLERİ'),
        bullet([
          'Bina yıkılma mesafesi dışında (bina yüksekliğinin 1.5 katı)',
          'Araç trafiğinden uzak, güvenli alan',
          'Acil araçların erişimine engel olmayan konum',
          'Tüm çalışanların toplanabileceği yeterli alan',
          'İşaretlenmiş ve aydınlatılmış',
          'Tüm çalışanlar tarafından bilinen konum',
        ]),
        h(2, '4. KROKİ'),
        p('[Bu alana işyeri yerleşim planı üzerinde toplanma alanlarını gösteren kroki eklenecektir.]'),
        p(''),
        h(2, '5. YOKLAMA PROSEDÜRÜ'),
        p('Toplanma noktasına ulaşıldığında her birim sorumlusu kendi personelinin yoklamasını alır ve sonucu acil durum koordinatörüne bildirir.'),
        p(''),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },

  // 5-7 Acil Durum Egitim Plani
  {
    id: 'acil-durum-egitim',
    groupKey: 'acil-durum',
    title: 'Acil Durum Eğitim Planı',
    description: 'Acil durum ekipleri ve personel eğitim planı',
    variables: ['firma_adi', 'uzman_adi', 'bugun', 'yil'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM EĞİTİM PLANI — {{yil}}'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('6331 sayılı Kanun Madde 11 gereğince acil durum ekiplerinin ve tüm çalışanların acil durum eğitimlerinin planlanması.'),
        h(2, '2. EĞİTİM PROGRAMI'),
        table(
          ['Eğitim Konusu', 'Hedef Kitle', 'Süre', 'Periyot', 'Eğitimci'],
          [
            ['Yangın söndürme teknikleri', 'Söndürme ekibi', '4 saat', 'Yılda 1', 'Sivil Savunma Uzmanı'],
            ['Arama kurtarma', 'Kurtarma ekibi', '4 saat', 'Yılda 1', 'AFAD / Uzman Eğitimci'],
            ['İlkyardım eğitimi', 'İlkyardım ekibi', '16 saat', '3 yılda 1', 'Sertifikalı Eğitimci'],
            ['Tahliye tatbikatı', 'Tüm çalışanlar', '2 saat', 'Yılda 1', '{{uzman_adi}}'],
            ['Deprem güvenliği', 'Tüm çalışanlar', '1 saat', 'Yılda 1', '{{uzman_adi}}'],
            ['Kimyasal kazgı müdahale', 'İlgili birimler', '2 saat', 'Yılda 1', '{{uzman_adi}}'],
          ]
        ),
        h(2, '3. TATBİKAT TAKVİMİ'),
        table(['Tatbikat', 'Planlanan Tarih', 'Katılımcılar', 'Durum'], [
          ['Yangın tahliye tatbikatı', '', 'Tüm çalışanlar', '☐ Planlandı'],
          ['Deprem tatbikatı', '', 'Tüm çalışanlar', '☐ Planlandı'],
          ['Kimyasal kazgı tatbikatı', '', 'İlgili birimler', '☐ Planlandı'],
        ]),
        p(''),
        table(['Hazırlayan', 'Onaylayan'], [
          ['{{uzman_adi}} — İSG Uzmanı', 'İşveren / İşveren Vekili'],
          ['Tarih: {{bugun}}', 'Tarih:'],
          ['İmza:', 'İmza:'],
        ]),
      ],
    },
  },

  // 5-8 Acil Durum Ekipman Envanteri
  {
    id: 'acil-durum-envanter',
    groupKey: 'acil-durum',
    title: 'Acil Durum Ekipman Envanteri',
    description: 'Acil durum ekipmanlarının envanter ve kontrol listesi',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM EKİPMAN ENVANTERİ'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. YANGIN SÖNDÜRME EKİPMANLARI'),
        table(
          ['No', 'Ekipman Türü', 'Konum', 'Adet', 'Son Kontrol', 'Sonraki Kontrol', 'Durum'],
          [
            ['1', 'ABC Kuru Kimyevi Toz (6 kg)', '', '', '', '', '☐ Uygun'],
            ['2', 'CO₂ Söndürücü', '', '', '', '', '☐ Uygun'],
            ['3', 'Yangın dolabı', '', '', '', '', '☐ Uygun'],
            ['4', 'Yangın alarm butonu', '', '', '', '', '☐ Uygun'],
            ['5', 'Duman dedektörü', '', '', '', '', '☐ Uygun'],
          ]
        ),
        h(2, '2. İLKYARDIM EKİPMANLARI'),
        table(['No', 'Ekipman', 'Konum', 'Adet', 'Son Kontrol', 'Durum'], [
          ['1', 'İlkyardım çantası', '', '', '', '☐ Uygun'],
          ['2', 'Sedye', '', '', '', '☐ Uygun'],
          ['3', 'Göz duşu', '', '', '', '☐ Uygun'],
          ['4', 'AED (Otomatik Defibrilatör)', '', '', '', '☐ Uygun'],
        ]),
        h(2, '3. ACİL AYDINLATMA VE YÖNLENDİRME'),
        table(['No', 'Ekipman', 'Konum', 'Adet', 'Durum'], [
          ['1', 'Acil çıkış levhası', '', '', '☐ Uygun'],
          ['2', 'Acil aydınlatma armatürü', '', '', '☐ Uygun'],
          ['3', 'Yönlendirme işaretleri', '', '', '☐ Uygun'],
        ]),
        p(''),
        p('Kontrol eden: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },

  // 5-9 Acil Durum Senaryolari
  {
    id: 'acil-durum-senaryo',
    groupKey: 'acil-durum',
    title: 'Acil Durum Senaryoları',
    description: 'Olası acil durum senaryoları ve müdahale planları',
    variables: ['firma_adi', 'uzman_adi', 'bugun'],
    content: {
      type: 'doc',
      content: [
        h(1, 'ACİL DURUM SENARYOLARI'),
        p('{{firma_adi}}'),
        { type: 'horizontalRule' },
        h(2, '1. AMAÇ'),
        p('İşyerinde meydana gelebilecek acil durumların senaryolaştırılması ve her senaryo için müdahale adımlarının belirlenmesi.'),
        h(2, 'SENARYO 1 — YANGIN'),
        table(['Adım', 'Faaliyet', 'Sorumlu', 'Süre'], [
          ['1', 'Yangın tespit edilir, alarm butonuna basılır', 'Tespit eden kişi', 'Anında'],
          ['2', 'Söndürme ekibi müdahale eder', 'Söndürme ekibi', '0-3 dk'],
          ['3', 'Tahliye başlatılır', 'Koruma ekibi', '0-5 dk'],
          ['4', 'İtfaiye aranır (110)', 'Koordinatör', '0-2 dk'],
          ['5', 'Toplanma noktasında yoklama', 'Ekip başları', '5-10 dk'],
        ]),
        h(2, 'SENARYO 2 — DEPREM'),
        table(['Adım', 'Faaliyet', 'Sorumlu', 'Süre'], [
          ['1', 'ÇÖK-KAPAN-TUTUN pozisyonu alınır', 'Tüm personel', 'Sarsıntı süresince'],
          ['2', 'Sarsıntı sonrası tahliye başlar', 'Ekip başları', '0-3 dk'],
          ['3', 'Hasar tespiti yapılır', 'Kurtarma ekibi', '10-20 dk'],
          ['4', 'Toplanma noktasında yoklama', 'Ekip başları', '5-10 dk'],
          ['5', 'Gerekirse 112/AFAD aranır', 'Koordinatör', 'Gerektiğinde'],
        ]),
        h(2, 'SENARYO 3 — KİMYASAL SIZINTI'),
        table(['Adım', 'Faaliyet', 'Sorumlu', 'Süre'], [
          ['1', 'Sızıntı tespit edilir, bölge terk edilir', 'Tespit eden kişi', 'Anında'],
          ['2', 'KKD giyilir, MSDS kontrol edilir', 'Söndürme ekibi', '0-5 dk'],
          ['3', 'Sızıntı sınırlandırılır', 'Müdahale ekibi', '5-15 dk'],
          ['4', 'Bölge havalandırılır', 'Teknik personel', '15-30 dk'],
          ['5', 'Dekontaminasyon yapılır', 'Müdahale ekibi', '30-60 dk'],
        ]),
        h(2, 'SENARYO 4 — İŞ KAZASI (AĞIR YARALANMA)'),
        table(['Adım', 'Faaliyet', 'Sorumlu', 'Süre'], [
          ['1', '112 Acil Sağlık aranır', 'Tespit eden kişi', 'Anında'],
          ['2', 'İlkyardım müdahalesi yapılır', 'İlkyardım ekibi', '0-5 dk'],
          ['3', 'Olay yeri güvene alınır', 'Kurtarma ekibi', '0-5 dk'],
          ['4', 'İSG uzmanı ve yönetim bilgilendirilir', 'Birim amiri', '0-10 dk'],
          ['5', 'SGK bildirim süreci başlatılır', 'İK / İSG', '3 iş günü içinde'],
        ]),
        p(''),
        p('6331 sayılı Kanun Madde 11-12 gereğince düzenlenmiştir.'),
        p('Hazırlayan: {{uzman_adi}} — Tarih: {{bugun}}'),
      ],
    },
  },
];
