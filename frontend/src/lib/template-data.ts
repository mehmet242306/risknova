export type TemplateCategory =
  | "Risk"
  | "Acil Durum"
  | "Denetim"
  | "Aksiyon"
  | "E?itim"
  | "Kurul"
  | "Talimat"
  | "Sa?l?k";

export type TemplateTarget =
  | "Genel"
  | "Bak?m Merkezi"
  | "Fabrika"
  | "Ofis"
  | "E?itim Kurumu"
  | "Sa?l?k Kurumu";

export type TemplateStatus = "Haz?r" | "Uyarlanabilir" | "Geli?mekte";

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
    title: "Risk De?erlendirmesi Ana ?ablonu",
    category: "Risk",
    target: "Genel",
    status: "Haz?r",
    summary: "Genel i?yerleri i?in risk de?erlendirme omurgas?.",
    includes: ["Tehlike tan?m?", "Risk puanlama", "Kontrol tedbirleri", "Sorumlu ve termin"],
    recommendedFor: ["T?m sekt?rler", "Temel risk de?erlendirmesi ihtiyac?"],
    aiReady: true,
  },
  {
    id: 2,
    title: "Acil Durum Eylem Plan? ?ablonu",
    category: "Acil Durum",
    target: "Genel",
    status: "Haz?r",
    summary: "Acil durum plan?n?n temel ba?l?klar?n? i?eren ?ablon.",
    includes: ["Senaryolar", "Toplanma alan?", "Destek ekipleri", "Tahliye mant???"],
    recommendedFor: ["T?m kurumlar", "Acil durum plan? g?ncellemesi"],
    aiReady: true,
  },
  {
    id: 3,
    title: "Saha Denetim ve Tespit Formu",
    category: "Denetim",
    target: "Genel",
    status: "Haz?r",
    summary: "Sahada uygunsuzluk ve ?neri kayd? i?in kullan?l?r.",
    includes: ["Bulgu ba?l???", "Foto?raf alan?", "Risk seviyesi", "Mevzuat etiketi"],
    recommendedFor: ["Saha denetimleri", "Aylik ziyaretler"],
    aiReady: true,
  },
  {
    id: 4,
    title: "DOF / D?zeltici Faaliyet Formu",
    category: "Aksiyon",
    target: "Genel",
    status: "Haz?r",
    summary: "Aksiyon a?ma ve takip mant??? i?in standart form.",
    includes: ["Kaynak", "Sorumlu", "Termin", "Do?rulama"],
    recommendedFor: ["Uygunsuzluk y?netimi", "Tatbikat bulgular?", "Denetim eksikleri"],
    aiReady: true,
  },
  {
    id: 5,
    title: "Yang?n Tatbikat Tutana??",
    category: "Acil Durum",
    target: "Genel",
    status: "Haz?r",
    summary: "Tatbikat sonu bulgu ve iyile?tirme kayd? i?in kullan?l?r.",
    includes: ["Senaryo", "Kat?l?mc?", "Eksikler", "?yile?tirme ba?l?klar?"],
    recommendedFor: ["Y?ll?k tatbikatlar", "Acil durum mod?l?"],
    aiReady: true,
  },
  {
    id: 6,
    title: "Bak?m Merkezi Ozel Kontrol Formu",
    category: "Denetim",
    target: "Bak?m Merkezi",
    status: "Uyarlanabilir",
    summary: "Ya?am evleri, mutfak, ?ama??rhane ve ortak alanlara odaklanan kontrol formu.",
    includes: ["Elektrik", "Yang?n", "Davran??sal risk", "Bak?m alanlar?"],
    recommendedFor: ["Ya?am merkezleri", "Rehabilitasyon birimleri"],
    aiReady: true,
  },
  {
    id: 7,
    title: "Fabrika S?cak ?? ve Kaynak Kontrol Formu",
    category: "Denetim",
    target: "Fabrika",
    status: "Uyarlanabilir",
    summary: "Kaynak, kesim, pres ve ?retim risklerine odakl? saha formu.",
    includes: ["KKD", "Makine koruyucu", "Yang?n", "S?cak i? kontrol?"],
    recommendedFor: ["Metal", "?malat", "At?lye"],
    aiReady: true,
  },
  {
    id: 8,
    title: "Kurul Toplant? Tutana??",
    category: "Kurul",
    target: "Genel",
    status: "Haz?r",
    summary: "Kurul kararlar?n?n kayd? ve izlenmesi i?in kullan?l?r.",
    includes: ["Toplant? ba?l?klar?", "Kararlar", "Sorumlular", "Terminler"],
    recommendedFor: ["Kurul toplant?lar?", "Ayl?k de?erlendirme"],
    aiReady: true,
  },
  {
    id: 9,
    title: "E?itim Katilim Formu",
    category: "E?itim",
    target: "Genel",
    status: "Haz?r",
    summary: "E?itim katilimi ve imza takibi icin temel form.",
    includes: ["Kat?l?mc? listesi", "E?itim konusu", "Tarih", "?mza alan?"],
    recommendedFor: ["T?m e?itimler", "Y?ll?k plan uygulamas?"],
    aiReady: false,
  },
  {
    id: 10,
    title: "Tahliye Talimati",
    category: "Talimat",
    target: "Ofis",
    status: "Haz?r",
    summary: "Ofis ve idari alanlar i?in tahliye ad?mlar?n? i?erir.",
    includes: ["Alarm davran???", "??k?? g?zergah?", "Toplanma noktas?", "Sorumlular"],
    recommendedFor: ["Ofisler", "?dari binalar"],
    aiReady: true,
  },
  {
    id: 11,
    title: "Sa?l?k Gozetimi Yillik Plan Taslagi",
    category: "Sa?l?k",
    target: "Genel",
    status: "Geli?mekte",
    summary: "Sa?l?k yonetimi modulu ile entegre olacak yillik plan taslagi.",
    includes: ["Muayene takvimi", "?zel izlem", "Bildirim alanlar?"],
    recommendedFor: ["??yeri hekimi", "DSP"],
    aiReady: false,
  }
];