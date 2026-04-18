export type VersionStatus = "Yay?nland?" | "Taslak" | "Revize Edildi" | "Ar?ivlendi";
export type ArchiveReason = "Yeni S?r?m" | "D?nem Sonu" | "Yasal Saklama" | "?ptal";

export type DocumentVersionRecord = {
  id: number;
  documentId: number;
  companyId: number;
  title: string;
  version: string;
  status: VersionStatus;
  changedAt: string;
  changedBy: string;
  revisionReason: string;
  summary: string;
};

export type ArchivedDocumentRecord = {
  id: number;
  documentId: number;
  companyId: number;
  title: string;
  archivedAt: string;
  archivedBy: string;
  archiveReason: ArchiveReason;
  lastVersion: string;
  outputType: "PDF" | "Word" | "Excel";
  note: string;
};

export const documentVersionRecords: DocumentVersionRecord[] = [
  {
    id: 1,
    documentId: 1,
    companyId: 1,
    title: "2026 Risk De?erlendirmesi",
    version: "v1.0",
    status: "Yay?nland?",
    changedAt: "2026-01-12 09:10",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "?lk yay?n",
    summary: "Ana risk ba?l?klar? ve kontrol tedbirleri olu?turuldu."
  },
  {
    id: 2,
    documentId: 1,
    companyId: 1,
    title: "2026 Risk De?erlendirmesi",
    version: "v2.0",
    status: "Revize Edildi",
    changedAt: "2026-02-15 16:40",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Saha denetimi sonras? revizyon",
    summary: "Elektrik ve yang?n ba?l?klar? g?ncellendi."
  },
  {
    id: 3,
    documentId: 1,
    companyId: 1,
    title: "2026 Risk De?erlendirmesi",
    version: "v2.1",
    status: "Yay?nland?",
    changedAt: "2026-03-01 10:00",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Termin ve sorumlu d?zeltmesi",
    summary: "Aksiyon sat?rlar? ve sorumlular netle?tirildi."
  },
  {
    id: 4,
    documentId: 2,
    companyId: 1,
    title: "Acil Durum Eylem Plan?",
    version: "v1.0",
    status: "Yay?nland?",
    changedAt: "2026-01-05 15:10",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Plan ilk s?r?m?",
    summary: "Toplanma alan? ve destek ekipleri tan?mland?."
  },
  {
    id: 5,
    documentId: 2,
    companyId: 1,
    title: "Acil Durum Eylem Plan?",
    version: "v1.4",
    status: "Taslak",
    changedAt: "2026-03-08 11:20",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Tatbikat bulgusu sonras? d?zenleme",
    summary: "Vardiya kapsam? ve tahliye ad?mlar? g?ncelleniyor."
  },
  {
    id: 6,
    documentId: 4,
    companyId: 2,
    title: "2026 Y?ll?k ?al??ma Plan?",
    version: "v1.0",
    status: "Yay?nland?",
    changedAt: "2026-01-10 09:00",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Plan ilk s?r?m?",
    summary: "Y?ll?k ziyaret, e?itim ve kontrol takvimi olu?turuldu."
  },
  {
    id: 7,
    documentId: 5,
    companyId: 3,
    title: "Yang?n Tatbikat Tutana??",
    version: "v0.9",
    status: "Taslak",
    changedAt: "2026-02-22 14:00",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Onay ?ncesi taslak",
    summary: "Eksikler ve iyile?tirme ba?l?klar? girildi."
  },
  {
    id: 8,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimat?",
    version: "v1.1",
    status: "Ar?ivlendi",
    changedAt: "2026-01-02 08:40",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Yeni surum yayinlandi",
    summary: "Eski tahliye talimat? ar?ive al?nd?."
  },
  {
    id: 9,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimat?",
    version: "v1.3",
    status: "Yay?nland?",
    changedAt: "2026-02-01 11:15",
    changedBy: "Mehmet Y?ld?r?m",
    revisionReason: "Y?nlendirme ve sorumlu g?ncellemesi",
    summary: "Tahliye sorumlular? ve y?nlendirme noktas? g?ncellendi."
  }
];

export const archivedDocumentRecords: ArchivedDocumentRecord[] = [
  {
    id: 1,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimat?",
    archivedAt: "2026-02-01 11:10",
    archivedBy: "Mehmet Y?ld?r?m",
    archiveReason: "Yeni S?r?m",
    lastVersion: "v1.1",
    outputType: "PDF",
    note: "Yeni talimat yay?nland??? i?in ?nceki s?r?m ar?ivlendi."
  },
  {
    id: 2,
    documentId: 8,
    companyId: 3,
    title: "Personel Egitim Katilim Formu",
    archivedAt: "2026-02-20 16:25",
    archivedBy: "Mehmet Y?ld?r?m",
    archiveReason: "D?nem Sonu",
    lastVersion: "v1.0",
    outputType: "PDF",
    note: "Subat donemi egitim formu kapatildi ve arsive alindi."
  },
  {
    id: 3,
    documentId: 4,
    companyId: 2,
    title: "2026 Y?ll?k ?al??ma Plan?",
    archivedAt: "2026-01-12 10:15",
    archivedBy: "Mehmet Y?ld?r?m",
    archiveReason: "Yasal Saklama",
    lastVersion: "v0.9",
    outputType: "Excel",
    note: "Ilk calisma dosyasi saklama amacli ayrildi."
  }
];