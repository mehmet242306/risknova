export type AnalysisMethod = "ishikawa" | "five_why" | "fault_tree" | "scat" | "bow_tie" | "mort" | "r2d_rca";

export const METHOD_META: Record<AnalysisMethod, {
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  description: string;
  aiSupported: boolean;
}> = {
  ishikawa: {
    label: "Ishikawa",
    subtitle: "Balik Kilcigi",
    icon: "GitBranch",
    color: "#d4a017",
    description: "6 kategoride kok nedenleri gorsellistir. Ekip analizi icin idealdir.",
    aiSupported: true,
  },
  five_why: {
    label: "5 Neden",
    subtitle: "5 Why",
    icon: "HelpCircle",
    color: "#5a9ee0",
    description: "Neden sorusunu 5 kez sorarak kok nedene ulas. Hizli ve odakli.",
    aiSupported: true,
  },
  fault_tree: {
    label: "Hata Agaci",
    subtitle: "Fault Tree (FTA)",
    icon: "Network",
    color: "#5ae0a0",
    description: "Olayi mantiksal agac yapisinda kir. VE/VEYA operatorleriyle karmasik sistemler icin.",
    aiSupported: true,
  },
  scat: {
    label: "SCAT",
    subtitle: "Systematic Cause Analysis",
    icon: "Link",
    color: "#e0a05a",
    description: "ISG'ye ozel Bird modeli. Anlik neden - temel neden - kontrol eksikligi zinciri.",
    aiSupported: true,
  },
  bow_tie: {
    label: "Bow-Tie",
    subtitle: "Kelebek Analizi",
    icon: "Target",
    color: "#5ae0e0",
    description: "Olay sonrasi: nedenler, bariyer tutmazliklari ve sonuclari haritala.",
    aiSupported: true,
  },
  mort: {
    label: "MORT",
    subtitle: "Management Oversight & Risk Tree",
    icon: "Building2",
    color: "#a05ae0",
    description: "Yonetim kaynakli nedenleri derinlemesine analiz et. Buyuk olaylar icin.",
    aiSupported: false,
  },
  r2d_rca: {
    label: "R\u2082D-RCA",
    subtitle: "Delta-Based Root Cause",
    icon: "Activity",
    color: "#e05a7a",
    description: "9 boyutlu sayisal kok neden analizi. Olay oncesi/sonrasi R\u2082D skorlarini karsilastirarak oncelikli kok neden seti uretir.",
    aiSupported: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Her yontemin data formati                                          */
/* ------------------------------------------------------------------ */

export interface IshikawaAnalysisData {
  insan: string[];
  makine: string[];
  yontem: string[];
  malzeme: string[];
  cevre: string[];
  yonetim: string[];
}

export interface FiveWhyData {
  whys: { question: string; answer: string }[];
  rootCause: string;
}

export interface FaultTreeNode {
  id: string;
  label: string;
  type: "event" | "and_gate" | "or_gate" | "basic_event";
  parentId: string | null;
  children: string[];
}

export interface FaultTreeData {
  topEvent: string;
  nodes: FaultTreeNode[];
}

export interface ScatData {
  immediateEvent: string;
  immediateCauses: string[];
  basicCauses: string[];
  controlDeficiencies: string[];
  // ── DNV SCAT zenginleştirilmiş alanlar (opsiyonel — AI üretiyor) ──
  /** Olay tipi indeksleri (0-12, TYPE_OF_EVENT) */
  suggestedTypeIndices?: number[];
  /** Standart-altı davranış indeksleri (0-19, SUBSTANDARD_ACTS) */
  suggestedActIndices?: number[];
  /** Standart-altı koşul indeksleri (0-19, SUBSTANDARD_CONDITIONS) */
  suggestedConditionIndices?: number[];
  /** Kişisel faktör indeksleri (0-7, PERSONAL_FACTORS) */
  suggestedPersonalFactorIndices?: number[];
  /** İş/sistem faktör indeksleri (0-7, JOB_FACTORS) */
  suggestedJobFactorIndices?: number[];
  /** CAN program indeksleri (0-21, CAN_PROGRAMS) */
  suggestedCanIndices?: number[];
  /** Kayıp şiddet potansiyeli */
  lossSeverity?: "major" | "serious" | "minor" | null;
  /** Tekrar olasılığı */
  probability?: "high" | "moderate" | "low" | null;
  /** Maruziyet sıklığı */
  frequency?: "extensive" | "moderate" | "low" | null;
  /** Etki kategorileri */
  impactPeople?: boolean;
  impactProperty?: boolean;
  impactProcess?: boolean;
  impactEnvironmental?: boolean;
}

export interface BowTieData {
  hazard: string;
  topEvent: string;
  threats: { id: string; label: string; causes: string[] }[];
  consequences: { id: string; label: string; effects: string[] }[];
  preventiveBarriers: { id: string; label: string; threatId: string; working: boolean }[];
  mitigatingBarriers: { id: string; label: string; consequenceId: string; working: boolean }[];
}

export interface MortData {
  topEvent: string;
  sections: {
    whatHappened: string;
    supervisoryControl: string[];
    managementSystem: string[];
    lessonsLearned: string[];
  };
  // ── Profesyonel MORT genişletmeleri (opsiyonel — AI üretir) ──
  /** Enerji tipi (kinetik/termal/kimyasal/elektriksel/mekanik/biyolojik/radyasyon/akustik) */
  energyType?: string | null;
  /** Enerji kaynağı (örn. "Dokuma makinesi mekanizması") */
  energySource?: string | null;
  /** Savunmasız hedef (örn. "Operatörün elleri") */
  vulnerableTarget?: string | null;
  /** SA1 — Enerji kontrolü bariyerleri (LTA durumuyla) */
  sa1Barriers?: MortBarrierAssessment[];
  /** SA2 — Hedef koruma bariyerleri */
  sa2Barriers?: MortBarrierAssessment[];
  /** SA3 — Genel bariyer/kontrol eksiklikleri */
  sa3Barriers?: MortBarrierAssessment[];
  /** Olay zinciri (ne → ne oldu → nasıl ilerledi) */
  eventSequence?: string[];
  /** Değişim analizi — ne değişti, neden */
  changeAnalysis?: {
    whatChanged?: string;
    whyChanged?: string;
    effectOfChange?: string;
  };
  /** Yönetim faktörleri (MA1-MA7) */
  mortMgmtFactors?: {
    policy?: MortFactorStatus;              // Politika yeterli mi?
    implementation?: MortFactorStatus;      // Uygulama yeterli mi?
    riskAssessment?: MortFactorStatus;      // Risk değerlendirmesi
    resources?: MortFactorStatus;           // Kaynaklar
    communication?: MortFactorStatus;       // İletişim
    training?: MortFactorStatus;            // Eğitim
    monitoring?: MortFactorStatus;          // İzleme/denetim
  };
  /** Risk üstlenildi mi (risk assumed olarak kabul edildi mi)? */
  riskAssumed?: boolean;
  /** Birincil kök neden tespit */
  primaryRootCause?: string | null;
  /** Öneri eylemler */
  recommendations?: string[];
}

/** MORT LTA (Less Than Adequate) durum: yeterli / yetersiz / değerlendirilmedi */
export type MortFactorStatus = "adequate" | "lta" | "not_assessed";

/** Bariyer/kontrol değerlendirmesi */
export interface MortBarrierAssessment {
  /** Bariyer/kontrol adı */
  label: string;
  /** Durumu: yeterli mi yoksa LTA mı? */
  status: MortFactorStatus;
  /** Notlar (neden LTA vb.) */
  notes?: string;
}

/* ------------------------------------------------------------------ */
/*  R2D-RCA types                                                      */
/* ------------------------------------------------------------------ */

/**
 * R2D-RCA — C1-C9 composite risk dimensions
 * Full methodology + computation: see /lib/r2d-rca-engine.ts
 */
export interface R2dRcaData {
  t0: number[];              // 9 elemanlı [0,1] sürekli skala
  t1: number[];              // 9 elemanlı [0,1] sürekli skala
  narrative?: string;        // AI değerlendirme metni (opsiyonel)
}

export type AnalysisData =
  | IshikawaAnalysisData
  | FiveWhyData
  | FaultTreeData
  | ScatData
  | BowTieData
  | MortData
  | R2dRcaData;

/* ------------------------------------------------------------------ */
/*  DB record type                                                     */
/* ------------------------------------------------------------------ */

export interface RootCauseAnalysis {
  id: string;
  organizationId: string;
  incidentId: string | null;
  incidentTitle: string;
  method: AnalysisMethod;
  data: AnalysisData;
  isFreeMode: boolean;
  isEdited: boolean;
  sharedWithCompany: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRcaRow(row: any): RootCauseAnalysis {
  return {
    id: row.id,
    organizationId: row.organization_id,
    incidentId: row.incident_id,
    incidentTitle: row.incident_title,
    method: row.method,
    data: row.data,
    isFreeMode: row.is_free_mode ?? false,
    isEdited: row.is_edited ?? false,
    sharedWithCompany: row.shared_with_company ?? false,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
