export type ProfessionalRole = "ISG Uzmmani" | "Isyeri Hekimi" | "DSP";
export type ServiceModel = "Kurum Ici" | "OSGB" | "Kendi Nam ve Hesabina" | "Karma";
export type EmploymentType = "Kurum Personeli" | "OSGB Personeli" | "Bagimsiz Hizmet Saglayici";

export type CompanyNote = {
  id: number;
  role: ProfessionalRole;
  title: string;
  content: string;
  date: string;
  confidential: boolean;
  followUp: boolean;
};

export type CompanyEmployee = {
  id: number;
  fullName: string;
  title: string;
  unit: string;
  startDate: string;
  shift: string;
  specialPolicy: boolean;
  note: string;
};

export type CompanyContact = {
  name: string;
  title: string;
  phone: string;
};

export type AssignedProfessional = {
  id: number;
  role: ProfessionalRole;
  fullName: string;
  employmentType: EmploymentType;
  providerCompany: string;
  certificateClass: string;
  phone: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  note: string;
};

export type OsgbInfo = {
  name: string;
  authorizationNo: string;
  phone: string;
  address: string;
};

export type Company = {
  id: number;
  name: string;
  sector: string;
  naceCode: string;
  hazardClass: string;
  employeeCount: number;
  specialPolicyCount: number;
  lastVisit: string;
  openActions: number;
  documentStatus: string;
  riskLevel: "Dusuk" | "Orta" | "Yuksek";
  address: string;
  locations: string[];
  contacts: CompanyContact[];
  serviceModel: ServiceModel;
  contractStart: string;
  contractEnd: string;
  osgbInfo: OsgbInfo | null;
  assignments: AssignedProfessional[];
  employees: CompanyEmployee[];
  notes: CompanyNote[];
};

export const companies: Company[] = [
  {
    id: 1,
    name: "Nova Yasam Destek Merkezi",
    sector: "Bakim ve rehabilitasyon hizmetleri",
    naceCode: "87.30.01",
    hazardClass: "Cok Tehlikeli",
    employeeCount: 58,
    specialPolicyCount: 9,
    lastVisit: "04.03.2026",
    openActions: 6,
    documentStatus: "Revizyon gerekli",
    riskLevel: "Yuksek",
    address: "Elazig Merkez / Elazig",
    locations: ["Idari Bina", "Yasam Evi 1", "Yasam Evi 2", "Mutfak", "Camasirhane"],
    contacts: [
      { name: "Ayse Kaya", title: "Kurum Muduru", phone: "0532 000 00 01" },
      { name: "Mehmet Demir", title: "Idari Sorumlu", phone: "0532 000 00 02" }
    ],
    serviceModel: "Kurum Ici",
    contractStart: "01.01.2026",
    contractEnd: "31.12.2026",
    osgbInfo: null,
    assignments: [
      {
        id: 1,
        role: "ISG Uzmmani",
        fullName: "Mustafa Kara",
        employmentType: "Kurum Personeli",
        providerCompany: "Nova Yasam Destek Merkezi",
        certificateClass: "B Sinifi",
        phone: "0532 000 00 11",
        startDate: "01.01.2026",
        active: true,
        note: "Kurum ici gorevlendirme aktif."
      },
      {
        id: 2,
        role: "Isyeri Hekimi",
        fullName: "Dr. Selin Gunes",
        employmentType: "Kurum Personeli",
        providerCompany: "Nova Yasam Destek Merkezi",
        certificateClass: "Isyeri Hekimi",
        phone: "0532 000 00 12",
        startDate: "01.01.2026",
        active: true,
        note: "Aylik saglik gozetimi plani yürütülüyor."
      },
      {
        id: 3,
        role: "DSP",
        fullName: "Ayla Duran",
        employmentType: "Kurum Personeli",
        providerCompany: "Nova Yasam Destek Merkezi",
        certificateClass: "DSP",
        phone: "0532 000 00 13",
        startDate: "01.01.2026",
        active: true,
        note: "Egitim ve takip gorevleri aktif."
      }
    ],
    employees: [
      { id: 1, fullName: "Zehra Yilmaz", title: "Bakim Personeli", unit: "Yasam Evi 1", startDate: "12.08.2022", shift: "Vardiyali", specialPolicy: false, note: "Gece vardiyasi aktif." },
      { id: 2, fullName: "Hasan Arslan", title: "Temizlik Personeli", unit: "Idari Bina", startDate: "03.05.2021", shift: "Gunduz", specialPolicy: false, note: "Ortak alan temizligi." },
      { id: 3, fullName: "Merve Koc", title: "Destek Personeli", unit: "Yasam Evi 2", startDate: "17.10.2023", shift: "Vardiyali", specialPolicy: true, note: "Ozel takip gerektiren calisan grubunda." }
    ],
    notes: [
      {
        id: 1,
        role: "ISG Uzmmani",
        title: "Elektrik kaynakli tekrar eden uygunsuzluk",
        content: "Son iki ziyarette panolarin erisim alaninda uygunsuz yerlesim tekrar gozlendi.",
        date: "05.03.2026",
        confidential: false,
        followUp: true
      },
      {
        id: 2,
        role: "Isyeri Hekimi",
        title: "Saglik gozetimi plani",
        content: "Ozel politika gerektiren calisanlar icin takip listesi guncellenmeli.",
        date: "03.03.2026",
        confidential: true,
        followUp: true
      },
      {
        id: 3,
        role: "DSP",
        title: "Egitim ve bilgilendirme notu",
        content: "Yeni baslayan calisanlar icin oryantasyon bilgilendirmesi tekrar planlanmali.",
        date: "28.02.2026",
        confidential: false,
        followUp: false
      }
    ]
  },
  {
    id: 2,
    name: "Atlas Metal Sanayi",
    sector: "Metal isleme ve uretim",
    naceCode: "25.62.01",
    hazardClass: "Cok Tehlikeli",
    employeeCount: 132,
    specialPolicyCount: 4,
    lastVisit: "01.03.2026",
    openActions: 11,
    documentStatus: "Guncel",
    riskLevel: "Yuksek",
    address: "Organize Sanayi Bolgesi / Elazig",
    locations: ["Uretim Hatti", "Kesim Alani", "Kaynak Bolumu", "Depo"],
    contacts: [
      { name: "Ali Can", title: "Fabrika Muduru", phone: "0532 000 00 03" },
      { name: "Busra Ak", title: "IK Sorumlusu", phone: "0532 000 00 04" }
    ],
    serviceModel: "OSGB",
    contractStart: "01.01.2026",
    contractEnd: "31.12.2026",
    osgbInfo: {
      name: "Guven OSGB Hizmetleri A.S.",
      authorizationNo: "OSGB-TR-2026-145",
      phone: "0532 000 00 21",
      address: "Elazig OSB 2. Cadde No:14"
    },
    assignments: [
      {
        id: 1,
        role: "ISG Uzmmani",
        fullName: "Mehmet Aydin",
        employmentType: "OSGB Personeli",
        providerCompany: "Guven OSGB Hizmetleri A.S.",
        certificateClass: "A Sinifi",
        phone: "0532 000 00 22",
        startDate: "01.01.2026",
        active: true,
        note: "OSGB uzerinden aylik saha hizmeti saglaniyor."
      },
      {
        id: 2,
        role: "Isyeri Hekimi",
        fullName: "Dr. Ozlem Ari",
        employmentType: "OSGB Personeli",
        providerCompany: "Guven OSGB Hizmetleri A.S.",
        certificateClass: "Isyeri Hekimi",
        phone: "0532 000 00 23",
        startDate: "01.01.2026",
        active: true,
        note: "Periyodik muayene plani OSGB tarafindan yürütülüyor."
      },
      {
        id: 3,
        role: "DSP",
        fullName: "Ceren Bulut",
        employmentType: "OSGB Personeli",
        providerCompany: "Guven OSGB Hizmetleri A.S.",
        certificateClass: "DSP",
        phone: "0532 000 00 24",
        startDate: "01.01.2026",
        active: true,
        note: "Egitim ve kayit islemleri OSGB tarafindan takip ediliyor."
      }
    ],
    employees: [
      { id: 1, fullName: "Umut Kaya", title: "Kaynak Operatoru", unit: "Kaynak Bolumu", startDate: "11.01.2020", shift: "Vardiyali", specialPolicy: false, note: "Kaynak maskesi kontrolu onemli." },
      { id: 2, fullName: "Cem Yurt", title: "Pres Operatoru", unit: "Uretim Hatti", startDate: "20.09.2021", shift: "Vardiyali", specialPolicy: false, note: "Gurultu maruziyeti yuksek." },
      { id: 3, fullName: "Sibel Acar", title: "Paketleme Personeli", unit: "Depo", startDate: "08.07.2024", shift: "Gunduz", specialPolicy: true, note: "Ozel politika gerektiren calisan kaydi mevcut." }
    ],
    notes: [
      {
        id: 1,
        role: "ISG Uzmmani",
        title: "Kesim alani risk yogunlugu",
        content: "Makine koruyucu kontrolleri ve acil durdurma erisimleri yeniden gozden gecirilmeli.",
        date: "02.03.2026",
        confidential: false,
        followUp: true
      },
      {
        id: 2,
        role: "DSP",
        title: "Personel bilgilendirme ihtiyaci",
        content: "Goz dusu ve acil yikama noktalari hakkinda kisa saha egitimi onerilir.",
        date: "01.03.2026",
        confidential: false,
        followUp: true
      }
    ]
  },
  {
    id: 3,
    name: "Umut Egitim ve Bakim Merkezi",
    sector: "Egitim ve bakim hizmetleri",
    naceCode: "88.91.01",
    hazardClass: "Tehlikeli",
    employeeCount: 41,
    specialPolicyCount: 6,
    lastVisit: "27.02.2026",
    openActions: 3,
    documentStatus: "Kismen guncel",
    riskLevel: "Orta",
    address: "Elazig / Merkez",
    locations: ["Siniflar", "Atolye", "Mutfak", "Bahce"],
    contacts: [
      { name: "Fatma Sen", title: "Kurum Yetkilisi", phone: "0532 000 00 05" }
    ],
    serviceModel: "Kendi Nam ve Hesabina",
    contractStart: "15.01.2026",
    contractEnd: "15.01.2027",
    osgbInfo: null,
    assignments: [
      {
        id: 1,
        role: "ISG Uzmmani",
        fullName: "Burak Yildiz",
        employmentType: "Bagimsiz Hizmet Saglayici",
        providerCompany: "Kendi Nam ve Hesabina",
        certificateClass: "B Sinifi",
        phone: "0532 000 00 31",
        startDate: "15.01.2026",
        active: true,
        note: "Bagimsiz sozlesme ile hizmet veriyor."
      },
      {
        id: 2,
        role: "Isyeri Hekimi",
        fullName: "Dr. Asli Nur",
        employmentType: "Bagimsiz Hizmet Saglayici",
        providerCompany: "Kendi Nam ve Hesabina",
        certificateClass: "Isyeri Hekimi",
        phone: "0532 000 00 32",
        startDate: "15.01.2026",
        active: true,
        note: "Bagimsiz saglik hizmeti sagliyor."
      }
    ],
    employees: [
      { id: 1, fullName: "Elif Tunc", title: "Ogretmen", unit: "Sinif 1", startDate: "10.09.2020", shift: "Gunduz", specialPolicy: false, note: "Sinif duzeni sorumlusu." },
      { id: 2, fullName: "Gamze Isik", title: "Destek Personeli", unit: "Atolye", startDate: "12.04.2023", shift: "Gunduz", specialPolicy: true, note: "Izlem gerektiren calisan kaydi var." }
    ],
    notes: [
      {
        id: 1,
        role: "ISG Uzmmani",
        title: "Kayma-dusme onlemleri",
        content: "Islak zemin uyarilari ve koridor duzeni yeniden degerlendirilmeli.",
        date: "28.02.2026",
        confidential: false,
        followUp: true
      }
    ]
  },
  {
    id: 4,
    name: "Merkez Yonetim Binasi",
    sector: "Ofis ve idari hizmetler",
    naceCode: "84.11.01",
    hazardClass: "Az Tehlikeli",
    employeeCount: 24,
    specialPolicyCount: 2,
    lastVisit: "20.02.2026",
    openActions: 2,
    documentStatus: "Guncel",
    riskLevel: "Dusuk",
    address: "Elazig / Merkez",
    locations: ["Giris", "Arsiv", "Ofisler", "Toplanti Salonu"],
    contacts: [
      { name: "Murat Gungor", title: "Bina Sorumlusu", phone: "0532 000 00 06" }
    ],
    serviceModel: "Karma",
    contractStart: "01.01.2026",
    contractEnd: "31.12.2026",
    osgbInfo: {
      name: "Merkez OSGB Cozum Ltd.",
      authorizationNo: "OSGB-TR-2026-212",
      phone: "0532 000 00 41",
      address: "Elazig Merkez Cumhuriyet Mah. 18/2"
    },
    assignments: [
      {
        id: 1,
        role: "ISG Uzmmani",
        fullName: "Erdem Polat",
        employmentType: "OSGB Personeli",
        providerCompany: "Merkez OSGB Cozum Ltd.",
        certificateClass: "C Sinifi",
        phone: "0532 000 00 42",
        startDate: "01.01.2026",
        active: true,
        note: "OSGB uzerinden uzman destegi saglaniyor."
      },
      {
        id: 2,
        role: "DSP",
        fullName: "Ayten Yalcin",
        employmentType: "Kurum Personeli",
        providerCompany: "Merkez Yonetim Binasi",
        certificateClass: "DSP",
        phone: "0532 000 00 43",
        startDate: "01.01.2026",
        active: true,
        note: "Kurum ici bilgilendirme ve evrak takibi yapiyor."
      }
    ],
    employees: [
      { id: 1, fullName: "Selin Ari", title: "Memur", unit: "Ofis", startDate: "16.06.2022", shift: "Gunduz", specialPolicy: false, note: "Standart masa basi is." },
      { id: 2, fullName: "Ahmet Celik", title: "Destek Personeli", unit: "Arsiv", startDate: "04.11.2021", shift: "Gunduz", specialPolicy: true, note: "Ozel politika gerektiren calisan isaretli." }
    ],
    notes: [
      {
        id: 1,
        role: "ISG Uzmmani",
        title: "Arsiv duzeni",
        content: "Ust raf yuklemelerinde dusme riskine karsi duzenleme onerilir.",
        date: "21.02.2026",
        confidential: false,
        followUp: false
      }
    ]
  }
];

export function getCompanyById(id: number) {
  return companies.find((company) => company.id === id);
}