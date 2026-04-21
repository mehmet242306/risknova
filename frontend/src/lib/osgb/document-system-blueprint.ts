export type OsgbAuditPackageSection = {
  key: string;
  title: string;
  description: string;
  groupKeys: string[];
};

export type OsgbIntegrationLane = {
  key: string;
  title: string;
  pattern: string;
  examples: string;
  productAction: string;
  dataShape: string;
};

export type OsgbArchiveGuarantee = {
  key: string;
  title: string;
  description: string;
};

export const OSGB_AUDIT_PACKAGE_SECTIONS: OsgbAuditPackageSection[] = [
  {
    key: "core-compliance",
    title: "Cekirdek uyum paketi",
    description: "Risk, acil durum, kurul ve yillik ISG ciktilari.",
    groupKeys: ["risk-degerlendirme", "acil-durum", "kurul-kayitlari", "yillik-degerlendirme"],
  },
  {
    key: "people-and-training",
    title: "Personel ve egitim paketi",
    description: "Personel ozluk, oryantasyon, egitim ve temsilci zinciri.",
    groupKeys: ["personel-ozluk", "is-giris-oryantasyon", "egitim-dosyasi", "calisan-temsilcisi"],
  },
  {
    key: "health-and-exposure",
    title: "Saglik ve maruziyet paketi",
    description: "Isyeri hekimi, saglik gozetimi ve maruziyet baglantili kayitlar.",
    groupKeys: ["isyeri-hekimi", "diger-kayitlar"],
  },
  {
    key: "incidents-and-actions",
    title: "Olay ve DOF paketi",
    description: "Kaza, ramak kala, kok neden ve DOF kapanis zinciri.",
    groupKeys: ["kaza-olay", "risk-degerlendirme"],
  },
  {
    key: "technical-controls",
    title: "Olcum ve teknik kontrol paketi",
    description: "Periyodik kontroller, ekipman ve ortam olcumleri.",
    groupKeys: ["periyodik-kontrol", "arac-makine", "diger-kayitlar"],
  },
];

export const OSGB_DOCUMENT_INTEGRATION_LANES: OsgbIntegrationLane[] = [
  {
    key: "web-service-adapter",
    title: "Dogrudan web servis adaptoru",
    pattern: "Makineye bagli ve duzenli senkron akisi",
    examples: "IBYS, SGK 4A, vizite",
    productAction: "Senkron gunlugu, zaman damgasi, durum uyarisi ve otomatik belge kaydi",
    dataShape: "JSON/API cevabi + kanit kaydi",
  },
  {
    key: "operator-assisted-portal",
    title: "Operator destekli kamu portali akisi",
    pattern: "Insan yonlendirmeli, kanit dosyasi olusturan akisi",
    examples: "ISG-KATIP, SGK is kazasi e-bildirimleri",
    productAction: "Adim adim kontrol listesi, portal kaniti, basvuru no ve PDF cikti",
    dataShape: "PDF + basvuru metadata + durum notlari",
  },
  {
    key: "standard-file-import",
    title: "Standart dosya ice aktarma",
    pattern: "Tedarikci ve laboratuvar odakli belge yukleme kanali",
    examples: "Laboratuvar raporlari, PDF/A raporlar, JSON/CSV metadata",
    productAction: "Yukleme kuyrugu, metadata cikarimi, format kontrolu ve arsiv paketi baglantisi",
    dataShape: "PDF/A + JSON/CSV metadata",
  },
];

export const OSGB_ARCHIVE_GUARANTEES: OsgbArchiveGuarantee[] = [
  {
    key: "version-lock",
    title: "Surum kilidi",
    description: "Guncel belge canli kalir, eski surumler ezilmeden audit iziyle korunur.",
  },
  {
    key: "hash-and-metadata",
    title: "Hash ve metadata kaydi",
    description: "Ham dosya, yayin ciktisi ve belgeye ait metadata ayri izlenir.",
  },
  {
    key: "role-based-visibility",
    title: "Yetki temelli erisim",
    description: "OSGB yonetimi firma portfoyunu, profesyonel ise yalnizca atandigi firma kayitlarini gorur.",
  },
  {
    key: "legal-hold",
    title: "Hukuki bekletme disiplini",
    description: "Silme yerine bekletme ve arsiv akisi tercih edilir; saglik ve olay dosyalari daha uzun korunur.",
  },
];
