export type CompanyRecord = {
  id: string;
  name: string;
  shortName: string;
  kind: string;
  companyType: string;
  address: string;
  sector: string;
  naceCode: string;
  hazardClass: string;
  employeeCount: number;
  shiftModel: string;
  phone: string;
  email: string;
  contactPerson: string;
  employerName: string;
  employerRepresentative: string;
  notes: string;

  activeProfessionals: number;
  employeeRepresentativeCount: number;
  supportStaffCount: number;

  openActions: number;
  overdueActions: number;
  openRiskAssessments: number;
  documentCount: number;

  completionRate: number;
  maturityScore: number;
  openRiskScore: number;
  last30DayImprovement: number;

  completedTrainingCount: number;
  expiringTrainingCount: number;
  periodicControlCount: number;
  overduePeriodicControlCount: number;

  lastAnalysisDate: string;
  lastInspectionDate: string;
  lastDrillDate: string;

  locations: string[];
  departments: string[];
  logo_url?: string;
};

export const COMPANY_DIRECTORY_STORAGE_KEY = "risknova_company_directory_v3";

export const defaultCompanyDirectory: CompanyRecord[] = [
  {
    id: "company-1",
    name: "Elazığ Engelsiz Yaşam, Bakım, Rehabilitasyon ve Aile Danışma Merkezi",
    shortName: "Engelsiz Yaşam Merkezi",
    kind: "Kamu Kurumu",
    companyType: "bagimsiz",
    address: "Elazığ",
    sector: "Bakım ve Rehabilitasyon Hizmetleri",
    naceCode: "87.30",
    hazardClass: "Tehlikeli",
    employeeCount: 78,
    shiftModel: "7/24 vardiyalı",
    phone: "0424 000 00 00",
    email: "kurum@ornek.gov.tr",
    contactPerson: "Kurum Müdürü",
    employerName: "Kurum Yönetimi",
    employerRepresentative: "Müdür Yardımcısı",
    notes:
      "İdari hizmet binası ve yaşam evlerinden oluşan yapı. Bakım, sağlık, mutfak ve destek hizmetleri birlikte yürütülür.",
    activeProfessionals: 3,
    employeeRepresentativeCount: 2,
    supportStaffCount: 5,
    openActions: 11,
    overdueActions: 3,
    openRiskAssessments: 4,
    documentCount: 18,
    completionRate: 54,
    maturityScore: 61,
    openRiskScore: 68,
    last30DayImprovement: 9,
    completedTrainingCount: 52,
    expiringTrainingCount: 8,
    periodicControlCount: 14,
    overduePeriodicControlCount: 2,
    lastAnalysisDate: "2026-03-10",
    lastInspectionDate: "2026-03-14",
    lastDrillDate: "2026-02-18",
    locations: [
      "İdari Hizmet Binası",
      "1. Yaşam Evi",
      "2. Yaşam Evi",
      "3. Yaşam Evi",
      "4. Yaşam Evi",
      "5. Yaşam Evi",
    ],
    departments: [
      "İdari İşler",
      "Bakım Hizmetleri",
      "Sağlık Birimi",
      "Mutfak",
      "Temizlik",
    ],
  },
  {
    id: "company-2",
    name: "RiskNova Demo Fabrika",
    shortName: "Demo Fabrika",
    kind: "Özel Sektör",
    companyType: "asil_isveren",
    address: "Elazığ OSB",
    sector: "Metal İşleme ve İmalat",
    naceCode: "25.62",
    hazardClass: "Çok Tehlikeli",
    employeeCount: 146,
    shiftModel: "3 vardiya",
    phone: "0424 111 11 11",
    email: "ehs@demofabrika.com",
    contactPerson: "İnsan Kaynakları Müdürü",
    employerName: "Genel Müdürlük",
    employerRepresentative: "Üretim Direktörü",
    notes:
      "Üretim, bakım, kalite ve lojistik operasyonları aynı yerleşke içinde yürütülmektedir.",
    activeProfessionals: 4,
    employeeRepresentativeCount: 3,
    supportStaffCount: 6,
    openActions: 19,
    overdueActions: 6,
    openRiskAssessments: 7,
    documentCount: 25,
    completionRate: 63,
    maturityScore: 58,
    openRiskScore: 74,
    last30DayImprovement: 6,
    completedTrainingCount: 103,
    expiringTrainingCount: 17,
    periodicControlCount: 26,
    overduePeriodicControlCount: 4,
    lastAnalysisDate: "2026-03-08",
    lastInspectionDate: "2026-03-15",
    lastDrillDate: "2026-01-27",
    locations: ["Üretim Sahası", "Depo", "Yükleme Alanı", "Bakım Atölyesi"],
    departments: ["Üretim", "Lojistik", "Bakım", "Kalite"],
  },
  {
    id: "company-3",
    name: "RiskNova Demo İnşaat Sahası",
    shortName: "Demo Şantiye",
    kind: "Şantiye",
    companyType: "asil_isveren",
    address: "Elazığ Merkez",
    sector: "Yapı İşleri",
    naceCode: "41.20",
    hazardClass: "Çok Tehlikeli",
    employeeCount: 95,
    shiftModel: "Gündüz + fazla mesai",
    phone: "0424 222 22 22",
    email: "santiye@demoinsaat.com",
    contactPerson: "Şantiye Şefi",
    employerName: "Ana Yüklenici",
    employerRepresentative: "Şantiye Müdürü",
    notes:
      "Birden fazla blok ve açık saha alanı içeren şantiye yapısı. Yüksekte çalışma ve kaldırma operasyonları yoğun.",
    activeProfessionals: 2,
    employeeRepresentativeCount: 2,
    supportStaffCount: 4,
    openActions: 14,
    overdueActions: 5,
    openRiskAssessments: 5,
    documentCount: 16,
    completionRate: 47,
    maturityScore: 49,
    openRiskScore: 79,
    last30DayImprovement: 4,
    completedTrainingCount: 61,
    expiringTrainingCount: 11,
    periodicControlCount: 12,
    overduePeriodicControlCount: 3,
    lastAnalysisDate: "2026-03-05",
    lastInspectionDate: "2026-03-12",
    lastDrillDate: "2026-02-05",
    locations: ["Blok A", "Blok B", "Cephe Alanı", "Malzeme Sahası"],
    departments: ["Şantiye Yönetimi", "Saha Uygulama", "Depolama", "Teknik Ofis"],
  },
];

function repairMojibake(value: string) {
  return value
    .replace(/Ä°/g, "İ")
    .replace(/Ä±/g, "ı")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ã§/g, "ç")
    .replace(/Ã–/g, "Ö")
    .replace(/Ã¶/g, "ö")
    .replace(/Ãœ/g, "Ü")
    .replace(/Ã¼/g, "ü")
    .replace(/Äž/g, "Ğ")
    .replace(/ÄŸ/g, "ğ")
    .replace(/Åž/g, "Ş")
    .replace(/ÅŸ/g, "ş")
    .replace(/Â·/g, "·");
}

function normalizeText(value: string) {
  return repairMojibake(value).trim();
}

function normalizeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function normalizeCompanyDirectory(
  companies: CompanyRecord[],
): CompanyRecord[] {
  return companies
    .map((company) => ({
      ...company,
      name: normalizeText(company.name),
      shortName: normalizeText(company.shortName),
      kind: normalizeText(company.kind),
      companyType: normalizeText(company.companyType || "bagimsiz"),
      address: normalizeText(company.address),
      sector: normalizeText(company.sector),
      naceCode: normalizeText(company.naceCode),
      hazardClass: normalizeText(company.hazardClass),
      shiftModel: normalizeText(company.shiftModel),
      phone: normalizeText(company.phone),
      email: normalizeText(company.email),
      contactPerson: normalizeText(company.contactPerson),
      employerName: normalizeText(company.employerName),
      employerRepresentative: normalizeText(company.employerRepresentative),
      notes: normalizeText(company.notes),
      employeeCount: normalizeNumber(company.employeeCount),
      activeProfessionals: normalizeNumber(company.activeProfessionals),
      employeeRepresentativeCount: normalizeNumber(company.employeeRepresentativeCount),
      supportStaffCount: normalizeNumber(company.supportStaffCount),
      openActions: normalizeNumber(company.openActions),
      overdueActions: normalizeNumber(company.overdueActions),
      openRiskAssessments: normalizeNumber(company.openRiskAssessments),
      documentCount: normalizeNumber(company.documentCount),
      completionRate: normalizeNumber(company.completionRate),
      maturityScore: normalizeNumber(company.maturityScore),
      openRiskScore: normalizeNumber(company.openRiskScore),
      last30DayImprovement: normalizeNumber(company.last30DayImprovement),
      completedTrainingCount: normalizeNumber(company.completedTrainingCount),
      expiringTrainingCount: normalizeNumber(company.expiringTrainingCount),
      periodicControlCount: normalizeNumber(company.periodicControlCount),
      overduePeriodicControlCount: normalizeNumber(company.overduePeriodicControlCount),
      lastAnalysisDate: normalizeText(company.lastAnalysisDate),
      lastInspectionDate: normalizeText(company.lastInspectionDate),
      lastDrillDate: normalizeText(company.lastDrillDate),
      locations: uniqueNonEmpty(company.locations ?? []),
      departments: uniqueNonEmpty(company.departments ?? []),
    }))
    .filter((company) => company.name);
}

export function loadCompanyDirectory(): CompanyRecord[] {
  if (typeof window === "undefined") {
    return defaultCompanyDirectory;
  }

  try {
    const raw = window.localStorage.getItem(COMPANY_DIRECTORY_STORAGE_KEY);
    if (!raw) {
      return defaultCompanyDirectory;
    }

    const parsed = JSON.parse(raw) as CompanyRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultCompanyDirectory;
    }

    return normalizeCompanyDirectory(parsed);
  } catch {
    return defaultCompanyDirectory;
  }
}

export function saveCompanyDirectory(companies: CompanyRecord[]) {
  if (typeof window === "undefined") return;

  const normalized = normalizeCompanyDirectory(companies);
  window.localStorage.setItem(
    COMPANY_DIRECTORY_STORAGE_KEY,
    JSON.stringify(normalized),
  );
}
