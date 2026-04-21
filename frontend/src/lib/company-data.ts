export type CompanyRecord = {
  id: string;
  name: string;
  kind: string;
  address: string;
  locations: string[];
  departments: string[];
};

const STORAGE_KEY = "risknova_company_catalog_v1";

const defaultCatalog: CompanyRecord[] = [
  {
    id: "company-1",
    name: "Elazığ Engelsiz Yaşam, Bakım, Rehabilitasyon ve Aile Danışma Merkezi",
    kind: "Kamu Kurumu",
    address: "Elazığ",
    locations: ["İdari Hizmet Binası", "1. Yaşam Evi", "2. Yaşam Evi", "3. Yaşam Evi"],
    departments: ["İdari İşler", "Bakım Hizmetleri", "Sağlık Birimi", "Mutfak"],
  },
  {
    id: "company-2",
    name: "RiskNova Ornek Fabrika",
    kind: "Özel Sektör",
    address: "Elazığ OSB",
    locations: ["Üretim Sahası", "Depo", "Yükleme Alanı"],
    departments: ["Üretim", "Lojistik", "Bakım", "Kalite"],
  },
  {
    id: "company-3",
    name: "RiskNova Ornek Insaat Sahasi",
    kind: "Şantiye",
    address: "Elazığ Merkez",
    locations: ["Blok A", "Blok B", "Cephe Alanı", "Malzeme Sahası"],
    departments: ["Şantiye Yönetimi", "Saha Uygulama", "Depolama", "Teknik Ofis"],
  },
];

function uniqueTrimmed(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeCompany(company: CompanyRecord): CompanyRecord {
  return {
    id: company.id,
    name: company.name.trim(),
    kind: company.kind.trim(),
    address: company.address.trim(),
    locations: uniqueTrimmed(company.locations),
    departments: uniqueTrimmed(company.departments),
  };
}

export function getDefaultCompanyCatalog(): CompanyRecord[] {
  return defaultCatalog.map(normalizeCompany);
}

export function loadCompanyCatalog(): CompanyRecord[] {
  if (typeof window === "undefined") {
    return getDefaultCompanyCatalog();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultCompanyCatalog();
    }

    const parsed = JSON.parse(raw) as CompanyRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return getDefaultCompanyCatalog();
    }

    return parsed.map(normalizeCompany);
  } catch {
    return getDefaultCompanyCatalog();
  }
}

export function saveCompanyCatalog(companies: CompanyRecord[]): CompanyRecord[] {
  const normalized = companies.map(normalizeCompany);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}
