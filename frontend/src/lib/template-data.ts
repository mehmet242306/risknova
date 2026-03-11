export type TemplateCategory =
  | "Risk"
  | "Acil Durum"
  | "Denetim"
  | "Aksiyon"
  | "Egitim"
  | "Kurul"
  | "Talimat"
  | "Saglik";

export type TemplateTarget =
  | "Genel"
  | "Bakim Merkezi"
  | "Fabrika"
  | "Ofis"
  | "Egitim Kurumu"
  | "Saglik Kurumu";

export type TemplateStatus = "Hazir" | "Uyarlanabilir" | "Gelismekte";

export type DocumentTemplate = {
  id: number;
  title: string;
  category: TemplateCategory;
  target: TemplateTarget;
  status: TemplateStatus;
  summary: string;
  includes: string[];
  recommendedFor: string[];
  aiReady: boolean;
};

export const documentTemplates: DocumentTemplate[] = [
  {
    id: 1,
    title: "Risk Degerlendirmesi Ana Sablonu",
    category: "Risk",
    target: "Genel",
    status: "Hazir",
    summary: "Genel isyerleri icin risk degerlendirme omurgasi.",
    includes: ["Tehlike tanimi", "Risk puanlama", "Kontrol tedbirleri", "Sorumlu ve termin"],
    recommendedFor: ["Tum sektorler", "Temel risk degerlendirmesi ihtiyaci"],
    aiReady: true,
  },
  {
    id: 2,
    title: "Acil Durum Eylem Plani Sablonu",
    category: "Acil Durum",
    target: "Genel",
    status: "Hazir",
    summary: "Acil durum planinin temel basliklarini iceren sablon.",
    includes: ["Senaryolar", "Toplanma alani", "Destek ekipleri", "Tahliye mantigi"],
    recommendedFor: ["Tum kurumlar", "Acil durum plani guncellemesi"],
    aiReady: true,
  },
  {
    id: 3,
    title: "Saha Denetim ve Tespit Formu",
    category: "Denetim",
    target: "Genel",
    status: "Hazir",
    summary: "Sahada uygunsuzluk ve oneri kaydi icin kullanilir.",
    includes: ["Bulgu basligi", "Fotograf alani", "Risk seviyesi", "Mevzuat etiketi"],
    recommendedFor: ["Saha denetimleri", "Aylik ziyaretler"],
    aiReady: true,
  },
  {
    id: 4,
    title: "DOF / Duzeltici Faaliyet Formu",
    category: "Aksiyon",
    target: "Genel",
    status: "Hazir",
    summary: "Aksiyon acma ve takip mantigi icin standart form.",
    includes: ["Kaynak", "Sorumlu", "Termin", "Dogrulama"],
    recommendedFor: ["Uygunsuzluk yonetimi", "Tatbikat bulgulari", "Denetim eksikleri"],
    aiReady: true,
  },
  {
    id: 5,
    title: "Yangin Tatbikat Tutanagi",
    category: "Acil Durum",
    target: "Genel",
    status: "Hazir",
    summary: "Tatbikat sonu bulgu ve iyilestirme kaydi icin kullanilir.",
    includes: ["Senaryo", "Katilimci", "Eksikler", "Iyilestirme basliklari"],
    recommendedFor: ["Yillik tatbikatlar", "Acil durum modulu"],
    aiReady: true,
  },
  {
    id: 6,
    title: "Bakim Merkezi Ozel Kontrol Formu",
    category: "Denetim",
    target: "Bakim Merkezi",
    status: "Uyarlanabilir",
    summary: "Yasam evleri, mutfak, camasirhane ve ortak alanlara odaklanan kontrol formu.",
    includes: ["Elektrik", "Yangin", "Davranissal risk", "Bakim alanlari"],
    recommendedFor: ["Yasam merkezleri", "Rehabilitasyon birimleri"],
    aiReady: true,
  },
  {
    id: 7,
    title: "Fabrika Sicak Is ve Kaynak Kontrol Formu",
    category: "Denetim",
    target: "Fabrika",
    status: "Uyarlanabilir",
    summary: "Kaynak, kesim, pres ve uretim risklerine odakli saha formu.",
    includes: ["KKD", "Makine koruyucu", "Yangin", "Sicak is kontrolu"],
    recommendedFor: ["Metal", "Imalat", "Atolye"],
    aiReady: true,
  },
  {
    id: 8,
    title: "Kurul Toplanti Tutanagi",
    category: "Kurul",
    target: "Genel",
    status: "Hazir",
    summary: "Kurul kararlarinin kaydi ve izlenmesi icin kullanilir.",
    includes: ["Toplanti basliklari", "Kararlar", "Sorumlular", "Terminler"],
    recommendedFor: ["Kurul toplantilari", "Aylik degerlendirme"],
    aiReady: true,
  },
  {
    id: 9,
    title: "Egitim Katilim Formu",
    category: "Egitim",
    target: "Genel",
    status: "Hazir",
    summary: "Egitim katilimi ve imza takibi icin temel form.",
    includes: ["Katilimci listesi", "Egitim konusu", "Tarih", "Imza alani"],
    recommendedFor: ["Tum egitimler", "Yillik plan uygulamasi"],
    aiReady: false,
  },
  {
    id: 10,
    title: "Tahliye Talimati",
    category: "Talimat",
    target: "Ofis",
    status: "Hazir",
    summary: "Ofis ve idari alanlar icin tahliye adimlarini icerir.",
    includes: ["Alarm davranisi", "Cikis guzergahi", "Toplanma noktasi", "Sorumlular"],
    recommendedFor: ["Ofisler", "Idari binalar"],
    aiReady: true,
  },
  {
    id: 11,
    title: "Saglik Gozetimi Yillik Plan Taslagi",
    category: "Saglik",
    target: "Genel",
    status: "Gelismekte",
    summary: "Saglik yonetimi modulu ile entegre olacak yillik plan taslagi.",
    includes: ["Muayene takvimi", "Ozel izlem", "Bildirim alanlari"],
    recommendedFor: ["Isyeri hekimi", "DSP"],
    aiReady: false,
  }
];