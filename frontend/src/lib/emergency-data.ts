export type EmergencyTeamType = "Sondurme" | "Kurtarma" | "Koruma" | "Ilk Yardim";
export type RecordStatus = "Guncel" | "Kismen" | "Eksik";

export type EmergencyPlan = {
  companyId: number;
  version: string;
  preparedDate: string;
  validUntil: string;
  nextReviewDate: string;
  approvedBy: string;
  assemblyPoint: string;
  nearestHospital: string;
  communicationMethod: string;
  scenarios: string[];
  externalEffects: string[];
  shutoffPoints: {
    electric: string;
    gas: string;
  };
  evacuationPlanNote: string;
  emergencyContacts: string[];
};

export type EmergencyTeam = {
  companyId: number;
  type: EmergencyTeamType;
  leader: string;
  members: string[];
  backups: string[];
  trainingStatus: RecordStatus;
  equipmentStatus: RecordStatus;
  shiftCoverage: "Tam" | "Kismi" | "Yetersiz";
};

export type EmergencyTraining = {
  id: number;
  companyId: number;
  title: string;
  date: string;
  targetGroup: string;
  trainer: string;
  renewalDate: string;
  status: RecordStatus;
};

export type DrillRecord = {
  id: number;
  companyId: number;
  date: string;
  type: string;
  scenario: string;
  participants: number;
  findings: string[];
  improvements: string[];
  nextDrillDate: string;
};

export const emergencyPlans: EmergencyPlan[] = [
  {
    companyId: 1,
    version: "ADP-2026-01",
    preparedDate: "2026-01-05",
    validUntil: "2028-01-05",
    nextReviewDate: "2027-12-20",
    approvedBy: "Isveren Vekili",
    assemblyPoint: "Ana bahce kuzey toplanma alani",
    nearestHospital: "Elazig Egitim ve Arastirma Hastanesi",
    communicationMethod: "Dahili telefon + cep telefonu + 112",
    scenarios: ["Yangin", "Deprem", "Elektrik kaynakli acil durum", "Tahliye gerektiren olay"],
    externalEffects: ["Yakin cevrede yangin", "Elektrik kesintisi", "Yol erisiminin kapanmasi"],
    shutoffPoints: {
      electric: "Zemin kat teknik oda ana elektrik panosu",
      gas: "Mutfak girisi dogalgaz ana vana noktasi",
    },
    evacuationPlanNote: "Her blok icin ayri tahliye plani ve toplanma krokisi hazirlanacak.",
    emergencyContacts: ["112 Acil Cagri", "Itfaiye", "Polis", "Elektrik Ariza", "Dogalgaz Acil"],
  },
  {
    companyId: 2,
    version: "ADP-2026-02",
    preparedDate: "2026-01-03",
    validUntil: "2028-01-03",
    nextReviewDate: "2027-12-15",
    approvedBy: "OSGB + Isveren",
    assemblyPoint: "Acik otopark acil toplanma bolgesi",
    nearestHospital: "Firat Universitesi Hastanesi",
    communicationMethod: "Vardiya amiri telsizi + cep telefonu + 112",
    scenarios: ["Yangin", "Patlama", "Kimyasal sizinti", "Tahliye"],
    externalEffects: ["Komsu tesis yangini", "Enerji kesintisi", "Yol blokaji"],
    shutoffPoints: {
      electric: "Uretim hatti ana pano odasi",
      gas: "Kaynak bolumu vana noktasi",
    },
    evacuationPlanNote: "Uretim alani, depo ve idari kisim icin farkli tahliye plani gereklidir.",
    emergencyContacts: ["112 Acil Cagri", "OSB Itfaiye", "AFAD", "Elektrik Ariza"],
  },
  {
    companyId: 3,
    version: "ADP-2026-01",
    preparedDate: "2026-01-12",
    validUntil: "2030-01-12",
    nextReviewDate: "2029-12-20",
    approvedBy: "Isveren",
    assemblyPoint: "Bahce dogu toplanma noktasi",
    nearestHospital: "Elazig Devlet Hastanesi",
    communicationMethod: "Telefon zinciri + 112",
    scenarios: ["Yangin", "Deprem", "Tahliye"],
    externalEffects: ["Yakin bina yangini", "Siddetli hava olayi"],
    shutoffPoints: {
      electric: "Giris ana pano",
      gas: "Mutfak vana noktasi",
    },
    evacuationPlanNote: "Hizmet alan refakati icin ek prosedur uygulanacak.",
    emergencyContacts: ["112 Acil Cagri", "Itfaiye", "Polis"],
  },
  {
    companyId: 4,
    version: "ADP-2026-01",
    preparedDate: "2026-01-08",
    validUntil: "2032-01-08",
    nextReviewDate: "2031-12-01",
    approvedBy: "Kurum Amiri",
    assemblyPoint: "Bina on acik alan",
    nearestHospital: "Elazig Devlet Hastanesi",
    communicationMethod: "Telefon + guvenlik bildirim zinciri",
    scenarios: ["Yangin", "Deprem", "Tahliye"],
    externalEffects: ["Sehir geneli enerji kesintisi"],
    shutoffPoints: {
      electric: "Zemin kat ana pano",
      gas: "Yok",
    },
    evacuationPlanNote: "Ofis, arsiv ve toplanti salonu icin ortak tahliye plani kullanilacak.",
    emergencyContacts: ["112 Acil Cagri", "Itfaiye", "Elektrik Ariza"],
  },
];

export const emergencyTeams: EmergencyTeam[] = [
  { companyId: 1, type: "Sondurme", leader: "Mustafa Kara", members: ["Zehra Yilmaz", "Hasan Arslan"], backups: ["Merve Koc"], trainingStatus: "Guncel", equipmentStatus: "Kismen", shiftCoverage: "Kismi" },
  { companyId: 1, type: "Kurtarma", leader: "Ayla Duran", members: ["Zehra Yilmaz", "Merve Koc"], backups: ["Hasan Arslan"], trainingStatus: "Guncel", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
  { companyId: 1, type: "Koruma", leader: "Mehmet Demir", members: ["Hasan Arslan"], backups: ["Zehra Yilmaz"], trainingStatus: "Kismen", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
  { companyId: 1, type: "Ilk Yardim", leader: "Dr. Selin Gunes", members: ["Ayla Duran"], backups: ["Mustafa Kara"], trainingStatus: "Guncel", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },

  { companyId: 2, type: "Sondurme", leader: "Mehmet Aydin", members: ["Umut Kaya", "Cem Yurt", "Sibel Acar"], backups: ["Ali Can"], trainingStatus: "Guncel", equipmentStatus: "Guncel", shiftCoverage: "Tam" },
  { companyId: 2, type: "Kurtarma", leader: "Ceren Bulut", members: ["Umut Kaya", "Cem Yurt", "Sibel Acar"], backups: ["Busra Ak"], trainingStatus: "Guncel", equipmentStatus: "Kismen", shiftCoverage: "Tam" },
  { companyId: 2, type: "Koruma", leader: "Ali Can", members: ["Busra Ak", "Cem Yurt"], backups: ["Sibel Acar"], trainingStatus: "Kismen", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
  { companyId: 2, type: "Ilk Yardim", leader: "Dr. Ozlem Ari", members: ["Ceren Bulut", "Sibel Acar"], backups: ["Mehmet Aydin"], trainingStatus: "Guncel", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },

  { companyId: 3, type: "Sondurme", leader: "Burak Yildiz", members: ["Elif Tunc"], backups: ["Gamze Isik"], trainingStatus: "Kismen", equipmentStatus: "Kismen", shiftCoverage: "Kismi" },
  { companyId: 3, type: "Kurtarma", leader: "Burak Yildiz", members: ["Gamze Isik"], backups: ["Elif Tunc"], trainingStatus: "Kismen", equipmentStatus: "Kismen", shiftCoverage: "Kismi" },
  { companyId: 3, type: "Koruma", leader: "Fatma Sen", members: ["Elif Tunc"], backups: ["Gamze Isik"], trainingStatus: "Eksik", equipmentStatus: "Kismen", shiftCoverage: "Yetersiz" },
  { companyId: 3, type: "Ilk Yardim", leader: "Dr. Asli Nur", members: ["Gamze Isik"], backups: ["Elif Tunc"], trainingStatus: "Guncel", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },

  { companyId: 4, type: "Sondurme", leader: "Erdem Polat", members: ["Selin Ari"], backups: ["Ahmet Celik"], trainingStatus: "Kismen", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
  { companyId: 4, type: "Kurtarma", leader: "Erdem Polat", members: ["Ahmet Celik"], backups: ["Selin Ari"], trainingStatus: "Eksik", equipmentStatus: "Kismen", shiftCoverage: "Kismi" },
  { companyId: 4, type: "Koruma", leader: "Ayten Yalcin", members: ["Selin Ari"], backups: ["Ahmet Celik"], trainingStatus: "Kismen", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
  { companyId: 4, type: "Ilk Yardim", leader: "Ayten Yalcin", members: ["Ahmet Celik"], backups: ["Selin Ari"], trainingStatus: "Eksik", equipmentStatus: "Guncel", shiftCoverage: "Kismi" },
];

export const emergencyTrainings: EmergencyTraining[] = [
  { id: 1, companyId: 1, title: "Yangin ve Tahliye Egitimi", date: "2026-02-10", targetGroup: "Tum personel", trainer: "ISG Profesyoneli", renewalDate: "2027-02-10", status: "Guncel" },
  { id: 2, companyId: 1, title: "Ilk Yardim Tazeleme", date: "2026-01-20", targetGroup: "Ilk yardim ekibi", trainer: "Saglik Profesyoneli", renewalDate: "2027-01-20", status: "Guncel" },
  { id: 3, companyId: 2, title: "Patlama ve Yangin Mudahale Egitimi", date: "2026-02-05", targetGroup: "Destek ekipleri", trainer: "OSGB", renewalDate: "2027-02-05", status: "Guncel" },
  { id: 4, companyId: 3, title: "Tahliye Organizasyonu", date: "2025-12-12", targetGroup: "Tum personel", trainer: "Bagimsiz Uzman", renewalDate: "2026-12-12", status: "Kismen" },
  { id: 5, companyId: 4, title: "Yangin Sondurucu Kullanimi", date: "2025-11-18", targetGroup: "Ofis ve arsiv personeli", trainer: "OSGB", renewalDate: "2026-11-18", status: "Kismen" },
];

export const drillRecords = [
  {
    id: 1,
    companyId: 1,
    date: "2026-02-28",
    type: "Yangin ve Tahliye",
    scenario: "Mutfak bolgesinde baslayan yangin senaryosu",
    participants: 46,
    findings: ["Toplanma alanina cikis suresi uzadi", "Bir vardiyada ekip kapsami zayif"],
    improvements: ["Yasam evleri icin ilave yonlendirme", "Vardiya bazli ekip yedekleme"],
    nextDrillDate: "2027-02-28",
  },
  {
    id: 2,
    companyId: 2,
    date: "2026-02-20",
    type: "Yangin ve Patlama",
    scenario: "Kaynak bolumunde patlama riski ve tahliye senaryosu",
    participants: 88,
    findings: ["Koruma ekibi haberlesme akisi zayif", "Iki istasyonda ekipman eksigi tespit edildi"],
    improvements: ["Telsiz dagitimi", "Ekipman tamamlama aksiyonu"],
    nextDrillDate: "2027-02-20",
  },
  {
    id: 3,
    companyId: 3,
    date: "2025-12-22",
    type: "Deprem ve Tahliye",
    scenario: "Hizmet alan refakati ile tahliye denemesi",
    participants: 29,
    findings: ["Refakat planinda rol dagilimi net degil"],
    improvements: ["Refakat listesi olusturma", "Kat bazli gorev kartlari"],
    nextDrillDate: "2026-12-22",
  },
  {
    id: 4,
    companyId: 4,
    date: "2025-11-25",
    type: "Yangin",
    scenario: "Arsiv alaninda duman algilama sonrasi tahliye",
    participants: 18,
    findings: ["Koridor yonlendirmesi guclendirilmeli"],
    improvements: ["Tahliye krokisini guncelleme"],
    nextDrillDate: "2026-11-25",
  },
];