export type VersionStatus = "Yayinlandi" | "Taslak" | "Revize Edildi" | "Arsivlendi";
export type ArchiveReason = "Yeni Surum" | "Donem Sonu" | "Yasal Saklama" | "Iptal";

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
    title: "2026 Risk Degerlendirmesi",
    version: "v1.0",
    status: "Yayinlandi",
    changedAt: "2026-01-12 09:10",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Ilk yayin",
    summary: "Ana risk basliklari ve kontrol tedbirleri olusturuldu."
  },
  {
    id: 2,
    documentId: 1,
    companyId: 1,
    title: "2026 Risk Degerlendirmesi",
    version: "v2.0",
    status: "Revize Edildi",
    changedAt: "2026-02-15 16:40",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Saha denetimi sonrasi revizyon",
    summary: "Elektrik ve yangin basliklari guncellendi."
  },
  {
    id: 3,
    documentId: 1,
    companyId: 1,
    title: "2026 Risk Degerlendirmesi",
    version: "v2.1",
    status: "Yayinlandi",
    changedAt: "2026-03-01 10:00",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Termin ve sorumlu duzeltmesi",
    summary: "Aksiyon satirlari ve sorumlular netlestirildi."
  },
  {
    id: 4,
    documentId: 2,
    companyId: 1,
    title: "Acil Durum Eylem Plani",
    version: "v1.0",
    status: "Yayinlandi",
    changedAt: "2026-01-05 15:10",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Plan ilk surumu",
    summary: "Toplanma alani ve destek ekipleri tanimlandi."
  },
  {
    id: 5,
    documentId: 2,
    companyId: 1,
    title: "Acil Durum Eylem Plani",
    version: "v1.4",
    status: "Taslak",
    changedAt: "2026-03-08 11:20",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Tatbikat bulgusu sonrasi duzenleme",
    summary: "Vardiya kapsami ve tahliye adimlari guncelleniyor."
  },
  {
    id: 6,
    documentId: 4,
    companyId: 2,
    title: "2026 Yillik Calisma Plani",
    version: "v1.0",
    status: "Yayinlandi",
    changedAt: "2026-01-10 09:00",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Plan ilk surumu",
    summary: "Yillik ziyaret, egitim ve kontrol takvimi olusturuldu."
  },
  {
    id: 7,
    documentId: 5,
    companyId: 3,
    title: "Yangin Tatbikat Tutanagi",
    version: "v0.9",
    status: "Taslak",
    changedAt: "2026-02-22 14:00",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Onay oncesi taslak",
    summary: "Eksikler ve iyilestirme basliklari girildi."
  },
  {
    id: 8,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimati",
    version: "v1.1",
    status: "Arsivlendi",
    changedAt: "2026-01-02 08:40",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Yeni surum yayinlandi",
    summary: "Eski tahliye talimati arsive alindi."
  },
  {
    id: 9,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimati",
    version: "v1.3",
    status: "Yayinlandi",
    changedAt: "2026-02-01 11:15",
    changedBy: "Mehmet Yildirim",
    revisionReason: "Yonlendirme ve sorumlu guncellemesi",
    summary: "Tahliye sorumlulari ve yonlendirme noktasi guncellendi."
  }
];

export const archivedDocumentRecords: ArchivedDocumentRecord[] = [
  {
    id: 1,
    documentId: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimati",
    archivedAt: "2026-02-01 11:10",
    archivedBy: "Mehmet Yildirim",
    archiveReason: "Yeni Surum",
    lastVersion: "v1.1",
    outputType: "PDF",
    note: "Yeni talimat yayinlandigi icin onceki surum arsivlendi."
  },
  {
    id: 2,
    documentId: 8,
    companyId: 3,
    title: "Personel Egitim Katilim Formu",
    archivedAt: "2026-02-20 16:25",
    archivedBy: "Mehmet Yildirim",
    archiveReason: "Donem Sonu",
    lastVersion: "v1.0",
    outputType: "PDF",
    note: "Subat donemi egitim formu kapatildi ve arsive alindi."
  },
  {
    id: 3,
    documentId: 4,
    companyId: 2,
    title: "2026 Yillik Calisma Plani",
    archivedAt: "2026-01-12 10:15",
    archivedBy: "Mehmet Yildirim",
    archiveReason: "Yasal Saklama",
    lastVersion: "v0.9",
    outputType: "Excel",
    note: "Ilk calisma dosyasi saklama amacli ayrildi."
  }
];