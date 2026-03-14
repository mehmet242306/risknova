export type DocumentType =
  | "Risk Degerlendirmesi"
  | "Acil Durum Plani"
  | "DOF Formu"
  | "Tespit ve Oneri"
  | "Yillik Calisma Plani"
  | "Kurul Tutanagi"
  | "Egitim Formu"
  | "Tatbikat Tutangi"
  | "Talimat"
  | "Is Izin Formu";

export type DocumentStatus = "Guncel" | "Revizyon Gerekli" | "Taslak" | "Onay Bekliyor";
export type OutputType = "PDF" | "Word" | "Excel";

export type ManagedDocument = {
  id: number;
  companyId: number;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  version: string;
  lastUpdated: string;
  nextReviewDate: string;
  preparedBy: string;
  approvedBy: string;
  outputCount: number;
};

export type DocumentOutput = {
  id: number;
  documentId: number;
  outputType: OutputType;
  createdAt: string;
  createdBy: string;
  note: string;
};

export const managedDocuments: ManagedDocument[] = [
  {
    id: 1,
    companyId: 1,
    title: "2026 Risk Degerlendirmesi",
    type: "Risk Degerlendirmesi",
    status: "Guncel",
    version: "v2.1",
    lastUpdated: "2026-03-01",
    nextReviewDate: "2026-09-01",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "Isveren Vekili",
    outputCount: 3,
  },
  {
    id: 2,
    companyId: 1,
    title: "Acil Durum Eylem Plani",
    type: "Acil Durum Plani",
    status: "Revizyon Gerekli",
    version: "v1.4",
    lastUpdated: "2026-01-05",
    nextReviewDate: "2026-04-01",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "Kurum Muduru",
    outputCount: 2,
  },
  {
    id: 3,
    companyId: 2,
    title: "Kaynak Bolumu Tespit ve Oneri Formu",
    type: "Tespit ve Oneri",
    status: "Taslak",
    version: "v0.8",
    lastUpdated: "2026-03-08",
    nextReviewDate: "2026-03-20",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "-",
    outputCount: 0,
  },
  {
    id: 4,
    companyId: 2,
    title: "2026 Yillik Calisma Plani",
    type: "Yillik Calisma Plani",
    status: "Guncel",
    version: "v1.0",
    lastUpdated: "2026-01-10",
    nextReviewDate: "2026-12-01",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "Isveren",
    outputCount: 1,
  },
  {
    id: 5,
    companyId: 3,
    title: "Yangin Tatbikat Tutanagi",
    type: "Tatbikat Tutangi",
    status: "Onay Bekliyor",
    version: "v1.0",
    lastUpdated: "2026-02-22",
    nextReviewDate: "2027-02-22",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "-",
    outputCount: 1,
  },
  {
    id: 6,
    companyId: 4,
    title: "Ofis Tahliye Talimati",
    type: "Talimat",
    status: "Guncel",
    version: "v1.3",
    lastUpdated: "2026-02-01",
    nextReviewDate: "2026-08-01",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "Kurum Amiri",
    outputCount: 4,
  },
  {
    id: 7,
    companyId: 4,
    title: "Kurul Toplanti Tutanagi - Mart 2026",
    type: "Kurul Tutanagi",
    status: "Taslak",
    version: "v0.3",
    lastUpdated: "2026-03-09",
    nextReviewDate: "2026-03-15",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "-",
    outputCount: 0,
  },
  {
    id: 8,
    companyId: 3,
    title: "Personel Egitim Katilim Formu",
    type: "Egitim Formu",
    status: "Guncel",
    version: "v1.1",
    lastUpdated: "2026-02-15",
    nextReviewDate: "2026-08-15",
    preparedBy: "Mehmet Yildirim",
    approvedBy: "Kurum Yetkilisi",
    outputCount: 2,
  }
];

export const documentOutputs: DocumentOutput[] = [
  { id: 1, documentId: 1, outputType: "PDF", createdAt: "2026-03-01 10:10", createdBy: "Mehmet Yildirim", note: "Resmi dagitim icin cikti alindi." },
  { id: 2, documentId: 1, outputType: "Word", createdAt: "2026-02-28 18:20", createdBy: "Mehmet Yildirim", note: "Revizyon oncesi duzenleme kopyasi." },
  { id: 3, documentId: 2, outputType: "PDF", createdAt: "2026-01-05 16:00", createdBy: "Mehmet Yildirim", note: "Ilk yayinlanan plan." },
  { id: 4, documentId: 4, outputType: "Excel", createdAt: "2026-01-10 09:40", createdBy: "Mehmet Yildirim", note: "Yillik plan calisma tablosu." },
  { id: 5, documentId: 5, outputType: "Word", createdAt: "2026-02-22 14:05", createdBy: "Mehmet Yildirim", note: "Onay icin gonderilen taslak." },
  { id: 6, documentId: 6, outputType: "PDF", createdAt: "2026-02-01 11:15", createdBy: "Mehmet Yildirim", note: "Panolara asim icin cikti." },
  { id: 7, documentId: 8, outputType: "PDF", createdAt: "2026-02-15 17:10", createdBy: "Mehmet Yildirim", note: "Egitim dosyasina eklendi." }
];