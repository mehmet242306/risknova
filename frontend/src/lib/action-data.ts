export type ActionStatus = "Acik" | "Devam Ediyor" | "Tamamlandi" | "Gecikti";
export type ActionPriority = "Dusuk" | "Orta" | "Yuksek" | "Kritik";
export type ActionSource =
  | "Saha Denetimi"
  | "Risk Analizi"
  | "Dokuman"
  | "Tatbikat"
  | "Mevzuat"
  | "Diger";

export type ActionItem = {
  id: number;
  companyId: number;
  title: string;
  description: string;
  source: ActionSource;
  status: ActionStatus;
  priority: ActionPriority;
  responsible: string;
  dueDate: string;
  createdAt: string;
  evidenceNote: string;
  closeNote: string;
  verificationNeeded: boolean;
};

export const initialActions: ActionItem[] = [
  {
    id: 1,
    companyId: 1,
    title: "Elektrik panosu onunun bosaltilmasi",
    description: "Pano onunde bulunan malzemeler kaldirilmali ve erisim alani serbest tutulmali.",
    source: "Saha Denetimi",
    status: "Acik",
    priority: "Kritik",
    responsible: "Mustafa Kara",
    dueDate: "2026-03-15",
    createdAt: "2026-03-09 09:10",
    evidenceNote: "",
    closeNote: "",
    verificationNeeded: true,
  },
  {
    id: 2,
    companyId: 2,
    title: "Kaynak bolumunde KKD denetimi",
    description: "Kaynak maskesi ve eldiven kullanimi vardiya bazinda kontrol edilmeli.",
    source: "Risk Analizi",
    status: "Devam Ediyor",
    priority: "Yuksek",
    responsible: "Mehmet Aydin",
    dueDate: "2026-03-18",
    createdAt: "2026-03-08 14:20",
    evidenceNote: "Ilk kontrol yapildi, tekrar saha dogrulamasi bekleniyor.",
    closeNote: "",
    verificationNeeded: true,
  },
  {
    id: 3,
    companyId: 3,
    title: "Islak zemin uyari levhalari",
    description: "Koridor ve giris alanlarinda kayma riskine karsi uyari levhalari yerlesitirilmeli.",
    source: "Saha Denetimi",
    status: "Tamamlandi",
    priority: "Orta",
    responsible: "Burak Yildiz",
    dueDate: "2026-03-10",
    createdAt: "2026-03-05 10:45",
    evidenceNote: "Fotograf eklendi.",
    closeNote: "Levhalar yerlestirildi, alan duzeni saglandi.",
    verificationNeeded: true,
  },
  {
    id: 4,
    companyId: 4,
    title: "Arsiv ust raf duzeni",
    description: "Dusme riskini azaltmak icin ust raf istif yuksekligi yeniden duzenlenmeli.",
    source: "Dokuman",
    status: "Gecikti",
    priority: "Orta",
    responsible: "Ayten Yalcin",
    dueDate: "2026-03-07",
    createdAt: "2026-03-01 16:30",
    evidenceNote: "",
    closeNote: "",
    verificationNeeded: false,
  },
];