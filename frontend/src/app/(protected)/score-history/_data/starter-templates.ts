// =============================================================================
// Saha Denetimi — Başlangıç Şablon Paketi (Starter Pack)
// =============================================================================
// Bir organizasyon ilk kez Saha Denetimi'ni açtığında yüklenebilecek,
// yaygın İSG senaryolarına uygun 6 hazır checklist şablonu.
//
// Tasarım:
// - 10 temel soru bankası (QUESTION_SEEDS)
// - 6 şablon her biri soru bankasından seçilmiş alt küme kullanır
// - Kullanıcı "Başlangıç paketini yükle" ile org'una kopyalar
// - Sonra Nova ile kendi özel şablonlarını üretebilir
// =============================================================================

import type { CreateQuestionInput } from "@/lib/supabase/checklist-api";

export type StarterQuestionSeed = Omit<CreateQuestionInput, "templateId">;

export const QUESTION_SEEDS: StarterQuestionSeed[] = [
  {
    section: "Genel Düzen",
    category: "Düşme / Takılma",
    text: "Yaya yolları, geçiş alanları ve acil tahliye koridorları engelsiz durumda mı?",
    priority: "high",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf, not ve aksiyon zorunludur.",
    ruleUygunsuz: "Tespit oluştur, not ve fotoğraf öner, mevcut risk analizine bağlama ihtimalini araştır.",
    ruleKritik: "Fotoğraf, not, aksiyon, sorumlu ve termin zorunlu; yönetici bildirimi öner.",
    suggestedActionTitle: "Geçiş alanlarındaki engeller kaldırılacak",
    suggestedActionDescription: "Palet, kutu ve geçici stok malzemeleri yaya yollarından uzaklaştırılacak.",
    linkedRiskHint: "Yaya geçişlerinin engellenmesi",
    openActionHint: "Koridor düzeni standardı uygulanacak",
    whySuggested: "Günlük saha ziyaretlerinde tekrar eden düzensizlikler ilk olarak bu kontrolde görünür.",
  },
  {
    section: "Yangın Güvenliği",
    category: "Yangın",
    text: "Yangın çıkış güzergahları açık, işaretli ve erişilebilir durumda mı?",
    priority: "critical",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf ve aksiyon zorunludur.",
    ruleUygunsuz: "Tespit oluştur, fotoğraf öner, açık aksiyon varsa bağla.",
    ruleKritik: "Fotoğraf, not, aksiyon ve sorumlu zorunlu; tekrarda DÖF öner.",
    suggestedActionTitle: "Yangın çıkış güzergahındaki engeller kaldırılacak",
    suggestedActionDescription: "Tahliye hattındaki palet ve geçici stoklar aynı vardiyada temizlenecek.",
    linkedRiskHint: "Acil çıkış yollarının engellenmesi",
    openActionHint: "Yangın çıkış güzergahı boşaltılacak",
    whySuggested: "6331 Md.11 + Binaların Yangından Korunması Hakkında Yönetmelik uyarınca tahliye hattı daima açık tutulmalıdır.",
  },
  {
    section: "Elektrik Güvenliği",
    category: "Elektrik",
    text: "Elektrik panoları önünde en az 1 metre güvenli açıklık korunuyor mu?",
    priority: "high",
    ruleHint: "Uygunsuz cevapta tespit oluşturulur. Kritik cevapta fotoğraf ve acil aksiyon önerilir.",
    ruleUygunsuz: "Tespit oluştur, not eklenmesini öner, elektrik başlıklarındaki mevcut riskleri tara.",
    ruleKritik: "Fotoğraf, not, aksiyon, sorumlu ve termin zorunlu; yeni risk taslağı önerilebilir.",
    suggestedActionTitle: "Elektrik pano önündeki istif alanı temizlenecek",
    suggestedActionDescription: "Pano önündeki tüm malzemeler çizgili alan dışına alınacak.",
    linkedRiskHint: "Elektrik panolarına erişim engeli",
    openActionHint: "Elektrik pano çevresi 5S standardına alınacak",
    whySuggested: "Elektrik İç Tesisler Yönetmeliği panoların erişilebilir tutulmasını zorunlu kılar; müdahale gecikmesi hayati risk yaratır.",
  },
  {
    section: "Makine ve Ekipman",
    category: "Makine",
    text: "Makine koruyucuları devre dışı bırakılmadan ve bypass edilmeden çalışıyor mu?",
    priority: "critical",
    ruleHint: "Kritik cevapta fotoğraf ve aksiyon zorunludur; yönetici bildirimi önerilir.",
    ruleUygunsuz: "Tespit oluştur, not ve fotoğraf öner, mevcut makine risklerini eşleştir.",
    ruleKritik: "Fotoğraf, not, aksiyon, sorumlu ve termin zorunlu; DÖF açılması önerilir.",
    suggestedActionTitle: "Makine koruyucularının bypass kullanımı engellenecek",
    suggestedActionDescription: "Bakım ve üretim ekipleriyle kök neden kontrolü yapılıp kalıcı tedbir tanımlanacak.",
    linkedRiskHint: "Makine koruyucu devre dışı bırakılması",
    openActionHint: "Koruyucu kullanımına yönelik vardiya kontrolü artırılacak",
    whySuggested: "İş Ekipmanları Yönetmeliği Md.5 koruyucuların her zaman aktif olmasını ister; kritik olay kayıtları bypass anlarında yoğunlaşır.",
  },
  {
    section: "KKD",
    category: "KKD",
    text: "Görev alanındaki personel gerekli KKD'leri doğru ve sürekli kullanıyor mu?",
    priority: "medium",
    ruleHint: "Uygunsuz cevapta tespit oluşturulur. Kritik cevapta amir bilgilendirmesi önerilir.",
    ruleUygunsuz: "Tespit oluştur, not öner, tekrar eden sorun varsa eğitim ve aksiyon öner.",
    ruleKritik: "Fotoğraf, not ve aksiyon zorunlu; açık eğitim aksiyonu varsa ilişkilendir.",
    suggestedActionTitle: "KKD kullanımının vardiya bazlı takibi başlatılacak",
    suggestedActionDescription: "Saha sorumlusu vardiya başlangıcında kritik KKD kontrolü yapacak.",
    linkedRiskHint: "Kişisel koruyucu donanım kullanılmaması",
    openActionHint: "KKD farkındalık turu planlanacak",
    whySuggested: "Davranış odaklı saha taramalarında en sık aksayan konu KKD sürekliliğidir.",
  },
  {
    section: "Kimyasal Güvenlik",
    category: "Kimyasal",
    text: "Kimyasal depoda etiketler, SDS dosyaları ve dökülme kiti güncel ve erişilebilir mi?",
    priority: "high",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf ve sorumlu zorunludur.",
    ruleUygunsuz: "Tespit oluştur, fotoğraf öner, benzer kayıtları rapor ve geçmiş tespitlerde tara.",
    ruleKritik: "Fotoğraf, not, aksiyon, sorumlu ve termin zorunlu; yeni risk taslağı önerilebilir.",
    suggestedActionTitle: "Kimyasal depo dokümantasyonu güncellenecek",
    suggestedActionDescription: "Eksik SDS, etiket ve dökülme kitleri aynı hafta içinde tamamlanacak.",
    linkedRiskHint: "Kimyasal bilgi eksikliği",
    openActionHint: "Kimyasal depo gözden geçirme planı uygulanacak",
    whySuggested: "Kimyasalların Güvenlik Bilgi Formları Hakkında Yönetmelik SDS'lerin erişilebilir tutulmasını zorunlu kılar.",
  },
  {
    section: "Acil Durum",
    category: "Acil Durum",
    text: "Acil durum ekipmanları, istasyon planları ve iletişim listeleri güncel mi?",
    priority: "high",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta yönetici bildirimi önerilir.",
    ruleUygunsuz: "Tespit oluştur, not öner, rapor ve tatbikat kayıtlarıyla karşılaştır.",
    ruleKritik: "Fotoğraf/ekran görüntüsü, not, aksiyon ve termin zorunlu.",
    suggestedActionTitle: "Acil durum planları ve listeler güncellenecek",
    suggestedActionDescription: "Plan revizyonu ile iletişim listeleri yeni vardiya düzenine göre yenilenecek.",
    linkedRiskHint: "Acil durum planının güncel olmaması",
    openActionHint: "Acil durum plan revizyonu yayımlanacak",
    whySuggested: "İşyerlerinde Acil Durumlar Hakkında Yönetmelik yıllık gözden geçirme ve güncelleme zorunluluğu getirir.",
  },
  {
    section: "Depolama ve Trafik",
    category: "Trafik / Forklift",
    text: "Forklift-yaya yolları ayrılmış ve yatay/dikey işaretlemeler görünür durumda mı?",
    priority: "critical",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf ve aksiyon zorunludur.",
    ruleUygunsuz: "Tespit oluştur, fotoğraf öner, mevcut trafik aksiyonlarını ara.",
    ruleKritik: "Fotoğraf, not, aksiyon ve sorumlu zorunlu; tekrar varsa DÖF öner.",
    suggestedActionTitle: "Forklift-yaya ayrımı yeniden işaretlenecek",
    suggestedActionDescription: "Kör noktalardaki yönlendirme, bariyer ve yer çizgileri aynı hafta iyileştirilecek.",
    linkedRiskHint: "Forklift-yaya çarpışma riski",
    openActionHint: "Forklift rota iyileştirme aksiyonu açık",
    whySuggested: "Forklift ve yaya etkileşimi, hem saha tespitlerinde hem de geçmiş raporlarda yüksek tekrar gösterir.",
  },
  {
    section: "Ergonomi ve İstasyon",
    category: "Ergonomi",
    text: "Çalışma istasyonlarında uygunsuz zorlanma yaratacak tekrar, eğilme veya uzanma var mı?",
    priority: "medium",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta iyileştirme aksiyonu zorunludur.",
    ruleUygunsuz: "Tespit oluştur, not öner, mevcut ergonomi risklerini eşleştir.",
    ruleKritik: "Not, aksiyon ve termin zorunlu; yeni risk taslağı oluşturma önerisi sun.",
    suggestedActionTitle: "Ergonomi iyileştirme taslağı oluşturulacak",
    suggestedActionDescription: "İstasyon yüksekliği, erişim mesafesi ve yardımcı ekipman ihtiyacı değerlendirilecek.",
    linkedRiskHint: "Tekrarlı zorlanma kaynaklı ergonomi riski",
    whySuggested: "Tekrarlı işlerdeki ergonomi problemleri uzun vadeli meslek hastalığı risklerini artırır.",
  },
  {
    section: "Dökülme ve Hijyen",
    category: "Hijyen",
    text: "Kayma, dökülme ve hijyen kaynaklı hızlı müdahale gerektiren bir durum gözlendi mi?",
    priority: "high",
    ruleHint: "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf ve aksiyon zorunludur.",
    ruleUygunsuz: "Tespit oluştur, fotoğraf öner, açık bakım/temizlik aksiyonlarını araştır.",
    ruleKritik: "Fotoğraf, not, aksiyon ve sorumlu zorunlu; tekrarda DÖF önerisi oluştur.",
    suggestedActionTitle: "Kayma ve dökülme riski aynı vardiyada giderilecek",
    suggestedActionDescription: "Temizlik ve bakım ekibiyle birlikte kök neden değerlendirmesi yapılacak.",
    linkedRiskHint: "Kayma, takılma ve hijyen kaynaklı düşme riski",
    openActionHint: "Zemin bakım aksiyonu açık",
    whySuggested: "Hızlı müdahale gerektiren zemin ve hijyen konuları saha tespitlerinde sık tekrar eder.",
  },
];

// -----------------------------------------------------------------------------
// 6 HAZIR ŞABLON — QUESTION_SEEDS indekslerinden oluşturulur
// -----------------------------------------------------------------------------

export type StarterTemplate = {
  slug: string;
  title: string;
  description: string;
  mode: "quick" | "standard" | "detailed";
  questionIndexes: number[];
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    slug: "starter-ortam-gozetimi",
    title: "Ortam Gözetimi Turu",
    description:
      "Günlük saha ziyaretlerinde eksikleri hızlı yakalayan, davranış ve fiziksel uygunsuzlukları aynı akışta toplayan temel tur.",
    mode: "quick",
    questionIndexes: [0, 1, 4, 9],
  },
  {
    slug: "starter-yangin-guvenligi",
    title: "Yangın Güvenliği Kontrolü",
    description: "Yangın çıkışları, söndürme ekipmanı ve acil durum hazırlığını odaklı biçimde denetler.",
    mode: "quick",
    questionIndexes: [1, 6, 9],
  },
  {
    slug: "starter-elektrik-pano",
    title: "Elektrik Pano Kontrolü",
    description: "Elektrik panoları, erişim açıklığı ve müdahale hazırlığını tarar.",
    mode: "quick",
    questionIndexes: [2, 6, 0],
  },
  {
    slug: "starter-kkd-kullanim",
    title: "KKD Kullanım Kontrolü",
    description: "Davranış odaklı saha turu ile KKD devamlılığını ve vardiya disiplini yakalar.",
    mode: "quick",
    questionIndexes: [4, 8, 0],
  },
  {
    slug: "starter-makine-emniyeti",
    title: "Makine Emniyeti Kontrolü",
    description: "Makine koruyucuları, acil stoplar ve ekipman müdahale disiplinini inceler.",
    mode: "quick",
    questionIndexes: [3, 2, 8],
  },
  {
    slug: "starter-kimyasal-depo",
    title: "Kimyasal Depo Kontrolü",
    description: "SDS, etiketleme, dökülme kiti ve depo hazırlığını tek akışta toplar.",
    mode: "quick",
    questionIndexes: [5, 9, 6],
  },
];

export const STARTER_PACK_VERSION = 1;
export const STARTER_PACK_META_KEY = "starter_pack_version";
