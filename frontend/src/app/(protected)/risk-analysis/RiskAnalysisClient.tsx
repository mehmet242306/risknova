"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusAlert } from "@/components/ui/status-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  loadCompanyDirectory,
  saveCompanyDirectory,
  type CompanyRecord,
} from "@/lib/company-directory";
import { usePersistedState, clearPersistedStates } from "@/lib/use-persisted-state";
import { fetchCompaniesFromSupabase } from "@/lib/supabase/company-api";
import { createClient } from "@/lib/supabase/client";
import {
  calculateR2D,
  calculateFK,
  calculateMatrix,
  calculateFMEA,
  calculateHAZOP,
  calculateBowTie,
  calculateFTA,
  calculateChecklist,
  calculateJSA,
  calculateLOPA,
  getMatrixGrid,
  R2D_PARAMS,
  FK_LIKELIHOOD,
  FK_SEVERITY,
  FK_EXPOSURE,
  FMEA_SEVERITY_OPTIONS,
  FMEA_OCCURRENCE_OPTIONS,
  FMEA_DETECTION_OPTIONS,
  HAZOP_GUIDE_WORDS,
  HAZOP_PARAMETERS,
  LOPA_INIT_FREQ_OPTIONS,
  LOPA_PFD_OPTIONS,
  MATRIX_LIKELIHOOD_LABELS,
  MATRIX_SEVERITY_LABELS,
  type R2DValues,
  type R2DResult,
  type FKValues,
  type FKResult,
  type MatrixValues,
  type MatrixResult,
  type FMEAValues,
  type FMEAResult,
  type HAZOPValues,
  type HAZOPResult,
  type BowTieValues,
  type BowTieResult,
  type FTAValues,
  type FTAResult,
  type ChecklistValues,
  type ChecklistResult,
  type ChecklistItem,
  type JSAValues,
  type JSAResult,
  type JSAStep,
  type LOPAValues,
  type LOPAResult,
  type LOPALayer,
  METHOD_CATALOG,
} from "@/lib/risk-scoring";
import { MethodIcon } from "@/components/risk-analysis/MethodIcon";
import { FMEAPanel, HAZOPPanel, BowTiePanel, FTAPanel, ChecklistPanel, JSAPanel, LOPAPanel } from "@/components/risk-analysis/panels";
import {
  exportRiskAnalysisPDF,
  exportRiskAnalysisWord,
  exportRiskAnalysisExcel,
  type ExportFinding,
  type ExportImage,
  type RiskAnalysisExportData,
} from "@/lib/risk-analysis-export";
import {
  saveRiskAnalysis,
  listRiskAssessments,
  loadRiskAssessment,
  deleteRiskAssessment,
  type SavedAssessment,
  type SaveRiskAnalysisInput,
} from "@/lib/supabase/risk-assessment-api";
import { createNotification } from "@/lib/supabase/notification-api";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

type AnalysisMethod = "r_skor" | "fine_kinney" | "l_matrix" | "fmea" | "hazop" | "bow_tie" | "fta" | "checklist" | "jsa" | "lopa";
type DetectionSeverity = "low" | "medium" | "high" | "critical";

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type RiskLine = {
  id: string;
  title: string;
  description: string;
  images: UploadedImage[];
};

type ParticipantRole = {
  code: string;
  label: string;
};

type Participant = {
  id: string;
  fullName: string;
  roleCode: string;
  title: string;
  certificateNo: string;
};

type AnnotationPoint = { x: number; y: number };

type PinAnnotation = {
  id: string;
  kind: "pin";
  label: string;
  x: number;
  y: number;
};

type BoxAnnotation = {
  id: string;
  kind: "box";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PolygonAnnotation = {
  id: string;
  kind: "polygon";
  label: string;
  points: AnnotationPoint[];
};

type FindingAnnotation = PinAnnotation | BoxAnnotation | PolygonAnnotation;

type LegalReference = {
  law: string;
  article: string;
  description: string;
};

type FaceRegion = {
  faceX: number;
  faceY: number;
  faceW: number;
  faceH: number;
};

type ImageMeta = {
  imageId: string;
  faces: FaceRegion[];
  positiveObservations: string[];
  photoQuality: { level: "good" | "moderate" | "poor"; note: string };
  areaSummary: string;
  personCount: number;
  imageRelevance: "relevant" | "irrelevant" | "not_real_photo";
  imageDescription: string;
};

type VisualFinding = {
  id: string;
  imageId: string;
  title: string;
  category: string;
  confidence: number;
  severity: DetectionSeverity;
  recommendation: string;
  correctiveActionRequired: boolean;
  annotations: FindingAnnotation[];
  isManual: boolean;
  legalReferences: LegalReference[];
  confidenceTier?: "high" | "medium" | "low";
  /** Scoring */
  r2dValues: R2DValues;
  r2dResult: R2DResult | null;
  fkValues: FKValues;
  fkResult: FKResult | null;
  matrixValues: MatrixValues;
  matrixResult: MatrixResult | null;
  fmeaValues: FMEAValues;
  fmeaResult: FMEAResult | null;
  hazopValues: HAZOPValues;
  hazopResult: HAZOPResult | null;
  bowTieValues: BowTieValues;
  bowTieResult: BowTieResult | null;
  ftaValues: FTAValues;
  ftaResult: FTAResult | null;
  checklistValues: ChecklistValues;
  checklistResult: ChecklistResult | null;
  jsaValues: JSAValues;
  jsaResult: JSAResult | null;
  lopaValues: LOPAValues;
  lopaResult: LOPAResult | null;
};

type LineResult = {
  rowId: string;
  rowTitle: string;
  imageCount: number;
  findings: VisualFinding[];
};

/* ================================================================== */
/* Constants & catalogs                                                */
/* ================================================================== */

const participantRoleCatalog: ParticipantRole[] = [
  { code: "employer", label: "İşveren" },
  { code: "employer_representative", label: "İşveren Vekili" },
  { code: "ohs_specialist", label: "İş Güvenliği Uzmanı" },
  { code: "workplace_physician", label: "İşyeri Hekimi" },
  { code: "other_health_personnel", label: "Diğer Sağlık Personeli" },
  { code: "employee_representative", label: "Çalışan Temsilcisi" },
  { code: "support_staff", label: "Destek Elemanı" },
  { code: "knowledgeable_employee", label: "Riskler Hakkında Bilgi Sahibi Çalışan" },
];

/** Firma ekip kategorisinden ISG rol kodu tahmin et */
function guessRoleFromCategory(categoryName: string | null): string {
  if (!categoryName) return "";
  const lower = categoryName.toLowerCase();
  if (lower.includes("işveren") && lower.includes("vekil")) return "employer_representative";
  if (lower.includes("işveren")) return "employer";
  if (lower.includes("güvenlik") || lower.includes("uzman") || lower.includes("isg")) return "ohs_specialist";
  if (lower.includes("hekim") || lower.includes("doktor")) return "workplace_physician";
  if (lower.includes("sağlık")) return "other_health_personnel";
  if (lower.includes("temsilci")) return "employee_representative";
  if (lower.includes("destek")) return "support_staff";
  if (lower.includes("risk") || lower.includes("değerlendirme")) return "knowledgeable_employee";
  return "knowledgeable_employee"; // varsayılan: bilgi sahibi çalışan
}

/** Kategori bazli R2D profilleri — her kategorinin baskin parametresi farkli */
const categoryR2DProfiles: Record<string, R2DValues> = {
  // Turkce kategoriler (Claude API'den gelenler)
  "kkd":                { c1: 0.3, c2: 0.90, c3: 0.50, c4: 0.10, c5: 0.05, c6: 0.15, c7: 0.10, c8: 0.10, c9: 0.30 },
  "düzen/temizlik":     { c1: 0.4, c2: 0.20, c3: 0.60, c4: 0.15, c5: 0.05, c6: 0.80, c7: 0.15, c8: 0.20, c9: 0.20 },
  "depolama":           { c1: 0.7, c2: 0.15, c3: 0.45, c4: 0.10, c5: 0.15, c6: 0.50, c7: 0.55, c8: 0.35, c9: 0.20 },
  "elektrik":           { c1: 0.5, c2: 0.25, c3: 0.40, c4: 0.20, c5: 0.60, c6: 0.30, c7: 0.75, c8: 0.10, c9: 0.20 },
  "ergonomi":           { c1: 0.25, c2: 0.40, c3: 0.55, c4: 0.35, c5: 0.05, c6: 0.20, c7: 0.20, c8: 0.15, c9: 0.70 },
  "yangın":             { c1: 0.6, c2: 0.10, c3: 0.35, c4: 0.30, c5: 0.70, c6: 0.75, c7: 0.25, c8: 0.10, c9: 0.15 },
  "acil durum":         { c1: 0.4, c2: 0.05, c3: 0.70, c4: 0.15, c5: 0.10, c6: 0.90, c7: 0.10, c8: 0.25, c9: 0.40 },
  "makine":             { c1: 0.6, c2: 0.30, c3: 0.50, c4: 0.15, c5: 0.05, c6: 0.20, c7: 0.90, c8: 0.15, c9: 0.25 },
  "yüksekte çalışma":   { c1: 0.4, c2: 0.65, c3: 0.85, c4: 0.15, c5: 0.05, c6: 0.55, c7: 0.30, c8: 0.10, c9: 0.35 },
  "kimyasal":           { c1: 0.35, c2: 0.30, c3: 0.30, c4: 0.25, c5: 0.90, c6: 0.35, c7: 0.20, c8: 0.10, c9: 0.25 },
  "çevre":              { c1: 0.3, c2: 0.10, c3: 0.30, c4: 0.75, c5: 0.20, c6: 0.40, c7: 0.15, c8: 0.15, c9: 0.30 },
  "iskele":             { c1: 0.5, c2: 0.60, c3: 0.80, c4: 0.10, c5: 0.05, c6: 0.50, c7: 0.40, c8: 0.10, c9: 0.30 },
  "trafik":             { c1: 0.5, c2: 0.20, c3: 0.60, c4: 0.10, c5: 0.05, c6: 0.40, c7: 0.20, c8: 0.90, c9: 0.20 },
  // Eski Ingilizce kategoriler (geriye uyumluluk)
  "ppe":                { c1: 0.3, c2: 0.90, c3: 0.50, c4: 0.10, c5: 0.05, c6: 0.15, c7: 0.10, c8: 0.10, c9: 0.30 },
  "housekeeping":       { c1: 0.4, c2: 0.20, c3: 0.60, c4: 0.15, c5: 0.05, c6: 0.80, c7: 0.15, c8: 0.20, c9: 0.20 },
  "storage":            { c1: 0.7, c2: 0.15, c3: 0.45, c4: 0.10, c5: 0.15, c6: 0.50, c7: 0.55, c8: 0.35, c9: 0.20 },
  "electrical":         { c1: 0.5, c2: 0.25, c3: 0.40, c4: 0.20, c5: 0.60, c6: 0.30, c7: 0.75, c8: 0.10, c9: 0.20 },
};

const categoryFKProfiles: Record<string, FKValues> = {
  "kkd":                { likelihood: 6, severity: 7, exposure: 6 },
  "düzen/temizlik":     { likelihood: 3, severity: 3, exposure: 6 },
  "depolama":           { likelihood: 6, severity: 15, exposure: 3 },
  "elektrik":           { likelihood: 3, severity: 15, exposure: 6 },
  "ergonomi":           { likelihood: 6, severity: 3, exposure: 10 },
  "yangın":             { likelihood: 6, severity: 40, exposure: 3 },
  "acil durum":         { likelihood: 3, severity: 40, exposure: 10 },
  "makine":             { likelihood: 6, severity: 15, exposure: 6 },
  "yüksekte çalışma":   { likelihood: 6, severity: 40, exposure: 3 },
  "kimyasal":           { likelihood: 3, severity: 15, exposure: 6 },
  "çevre":              { likelihood: 3, severity: 7, exposure: 10 },
  "iskele":             { likelihood: 6, severity: 40, exposure: 3 },
  "trafik":             { likelihood: 6, severity: 15, exposure: 6 },
  "ppe":                { likelihood: 6, severity: 7, exposure: 6 },
  "housekeeping":       { likelihood: 3, severity: 3, exposure: 6 },
  "storage":            { likelihood: 6, severity: 15, exposure: 3 },
  "electrical":         { likelihood: 3, severity: 15, exposure: 6 },
};

const categoryMatrixProfiles: Record<string, MatrixValues> = {
  "kkd":                { likelihood: 4, severity: 3 },
  "düzen/temizlik":     { likelihood: 3, severity: 2 },
  "depolama":           { likelihood: 3, severity: 4 },
  "elektrik":           { likelihood: 3, severity: 5 },
  "ergonomi":           { likelihood: 4, severity: 3 },
  "yangın":             { likelihood: 3, severity: 5 },
  "acil durum":         { likelihood: 4, severity: 5 },
  "makine":             { likelihood: 4, severity: 4 },
  "yüksekte çalışma":   { likelihood: 3, severity: 5 },
  "kimyasal":           { likelihood: 3, severity: 4 },
  "çevre":              { likelihood: 3, severity: 3 },
  "iskele":             { likelihood: 3, severity: 5 },
  "trafik":             { likelihood: 4, severity: 4 },
  "ppe":                { likelihood: 4, severity: 3 },
  "housekeeping":       { likelihood: 3, severity: 2 },
  "storage":            { likelihood: 3, severity: 4 },
  "electrical":         { likelihood: 3, severity: 5 },
};

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function createLine(): RiskLine {
  return { id: crypto.randomUUID(), title: "", description: "", images: [] };
}

function createParticipant(): Participant {
  return { id: crypto.randomUUID(), fullName: "", roleCode: "", title: "", certificateNo: "" };
}

function methodLabel(method: AnalysisMethod) {
  const info = METHOD_CATALOG.find(m => m.id === method);
  return info?.name || method;
}

function severityLabel(severity: DetectionSeverity) {
  switch (severity) {
    case "low": return "Düşük";
    case "medium": return "Orta";
    case "high": return "Yüksek";
    case "critical": return "Kritik";
    default: return severity;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _severityBadge(severity: DetectionSeverity) {
  switch (severity) {
    case "low": return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "medium": return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "high": return "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "critical": return "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
    default: return "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  }
}

/* ── Default value factories for new methods ── */
function getDefaultFMEAValues(): FMEAValues { return { severity: 5, occurrence: 5, detection: 5 }; }
function getDefaultHAZOPValues(): HAZOPValues { return { severity: 3, likelihood: 3, detectability: 3, guideWord: "Çok (More)", parameter: "Akış (Flow)", deviation: "" }; }
function getDefaultBowTieValues(): BowTieValues { return { threatProbability: 3, consequenceSeverity: 3, preventionBarriers: 1, mitigationBarriers: 1 }; }
function getDefaultFTAValues(): FTAValues { return { components: [{ name: "Bileşen 1", failureRate: 0.1 }], gateType: "OR", systemCriticality: 3 }; }
function getDefaultChecklistValues(): ChecklistValues { return { items: [{ id: crypto.randomUUID(), text: "Kontrol maddesi 1", status: "uygun", weight: 1 }], category: "Genel" }; }
function getDefaultJSAValues(): JSAValues { return { jobTitle: "", steps: [{ id: crypto.randomUUID(), stepDescription: "Adım 1", hazard: "", severity: 3, likelihood: 3, controlEffectiveness: 3, controlMeasures: "" }] }; }
function getDefaultLOPAValues(): LOPAValues { return { initiatingEventFreq: 0.1, consequenceSeverity: 3, layers: [{ id: crypto.randomUUID(), name: "Koruma Katmanı 1", pfd: 0.1 }] }; }

/** Severity bazli default degerler (yeni yontemler icin) */
function getDefaultsForSeverity(severity: DetectionSeverity) {
  const sev = severity === "critical" ? 5 : severity === "high" ? 4 : severity === "medium" ? 3 : 2;
  return {
    fmea: { severity: sev * 2, occurrence: sev * 2, detection: 11 - sev * 2 } as FMEAValues,
    hazop: { severity: sev, likelihood: sev, detectability: 6 - sev, guideWord: "Çok (More)", parameter: "Akış (Flow)", deviation: "" } as HAZOPValues,
    bowTie: { threatProbability: sev, consequenceSeverity: sev, preventionBarriers: Math.max(0, 3 - sev), mitigationBarriers: Math.max(0, 3 - sev) } as BowTieValues,
    fta: { components: [{ name: "Bileşen 1", failureRate: sev * 0.15 }], gateType: "OR" as const, systemCriticality: sev },
    checklist: { items: [{ id: crypto.randomUUID(), text: "Kontrol maddesi", status: (sev >= 4 ? "uygun_degil" : sev >= 3 ? "kismi" : "uygun") as ChecklistItem["status"], weight: 2 }], category: "Genel" } as ChecklistValues,
    jsa: { jobTitle: "", steps: [{ id: crypto.randomUUID(), stepDescription: "Adım 1", hazard: "", severity: sev, likelihood: sev, controlEffectiveness: 6 - sev, controlMeasures: "" }] } as JSAValues,
    lopa: { initiatingEventFreq: Math.pow(10, -(5 - sev)), consequenceSeverity: sev, layers: [{ id: crypto.randomUUID(), name: "Koruma Katmanı 1", pfd: 0.1 }] } as LOPAValues,
  };
}

function getActiveScore(finding: VisualFinding, method: AnalysisMethod): { score: number; label: string; color: string; action: string } {
  const resultMap: Record<AnalysisMethod, { score: number; label: string; color: string; action: string } | null> = {
    r_skor: finding.r2dResult ? { score: finding.r2dResult.score, label: finding.r2dResult.label, color: finding.r2dResult.color, action: finding.r2dResult.action } : null,
    fine_kinney: finding.fkResult ? { score: finding.fkResult.score, label: finding.fkResult.label, color: finding.fkResult.color, action: finding.fkResult.action } : null,
    l_matrix: finding.matrixResult ? { score: finding.matrixResult.score, label: finding.matrixResult.label, color: finding.matrixResult.color, action: finding.matrixResult.action } : null,
    fmea: finding.fmeaResult ? { score: finding.fmeaResult.score, label: finding.fmeaResult.label, color: finding.fmeaResult.color, action: finding.fmeaResult.action } : null,
    hazop: finding.hazopResult ? { score: finding.hazopResult.score, label: finding.hazopResult.label, color: finding.hazopResult.color, action: finding.hazopResult.action } : null,
    bow_tie: finding.bowTieResult ? { score: finding.bowTieResult.score, label: finding.bowTieResult.label, color: finding.bowTieResult.color, action: finding.bowTieResult.action } : null,
    fta: finding.ftaResult ? { score: finding.ftaResult.score, label: finding.ftaResult.label, color: finding.ftaResult.color, action: finding.ftaResult.action } : null,
    checklist: finding.checklistResult ? { score: finding.checklistResult.score, label: finding.checklistResult.label, color: finding.checklistResult.color, action: finding.checklistResult.action } : null,
    jsa: finding.jsaResult ? { score: finding.jsaResult.score, label: finding.jsaResult.label, color: finding.jsaResult.color, action: finding.jsaResult.action } : null,
    lopa: finding.lopaResult ? { score: finding.lopaResult.score, label: finding.lopaResult.label, color: finding.lopaResult.color, action: finding.lopaResult.action } : null,
  };
  return resultMap[method] ?? { score: 0, label: "-", color: "#64748B", action: "-" };
}

function getActiveRiskClass(finding: VisualFinding, method: AnalysisMethod): string {
  const classMap: Record<AnalysisMethod, string | null> = {
    r_skor: finding.r2dResult?.riskClass ?? null,
    fine_kinney: finding.fkResult?.riskClass ?? null,
    l_matrix: finding.matrixResult?.riskClass ?? null,
    fmea: finding.fmeaResult?.riskClass ?? null,
    hazop: finding.hazopResult?.riskClass ?? null,
    bow_tie: finding.bowTieResult?.riskClass ?? null,
    fta: finding.ftaResult?.riskClass ?? null,
    checklist: finding.checklistResult?.riskClass ?? null,
    jsa: finding.jsaResult?.riskClass ?? null,
    lopa: finding.lopaResult?.riskClass ?? null,
  };
  return classMap[method] ?? "follow_up";
}

function computeAllScores(finding: VisualFinding): VisualFinding {
  return {
    ...finding,
    r2dResult: calculateR2D(finding.r2dValues),
    fkResult: calculateFK(finding.fkValues),
    matrixResult: calculateMatrix(finding.matrixValues),
    fmeaResult: calculateFMEA(finding.fmeaValues),
    hazopResult: calculateHAZOP(finding.hazopValues),
    bowTieResult: calculateBowTie(finding.bowTieValues),
    ftaResult: calculateFTA(finding.ftaValues),
    checklistResult: calculateChecklist(finding.checklistValues),
    jsaResult: calculateJSA(finding.jsaValues),
    lopaResult: calculateLOPA(finding.lopaValues),
  };
}

/* Mock fallback kaldırıldı — yalnızca gerçek AI analizi kullanılıyor */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mockPatterns_removed: Record<string, unknown>[] = [
  {
    title: "KKD eksikliği — baret takılı değil",
    category: "PPE",
    confidence: 0.93,
    severity: "high",
    recommendation: "Çalışanın baş koruyucu (baret) kullanımı sağlanmalı; KKD denetim sıklığı artırılmalıdır.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: categoryR2DProfiles.ppe,
    fkValues: categoryFKProfiles.ppe,
    matrixValues: categoryMatrixProfiles.ppe,
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R1", x: 58, y: 22 },
      { id: crypto.randomUUID(), kind: "box", label: "Kişi (baş)", x: 48, y: 10, width: 18, height: 28 },
    ],
  },
  {
    title: "Düşme / takılma riski — zemin engelleri",
    category: "Housekeeping",
    confidence: 0.87,
    severity: "medium",
    recommendation: "Geçiş yolları temizlenmeli, yerdeki malzeme/kablo düzeni iyileştirilmelidir.",
    correctiveActionRequired: false,
    isManual: false,
    legalReferences: [],
    r2dValues: categoryR2DProfiles.housekeeping,
    fkValues: categoryFKProfiles.housekeeping,
    matrixValues: categoryMatrixProfiles.housekeeping,
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R2", x: 42, y: 82 },
      { id: crypto.randomUUID(), kind: "polygon", label: "Zemin engeli", points: [{ x: 18, y: 72 }, { x: 62, y: 70 }, { x: 68, y: 88 }, { x: 22, y: 90 }] },
    ],
  },
  {
    title: "İstif / devrilme riski — dengesiz yükleme",
    category: "Storage",
    confidence: 0.90,
    severity: "critical",
    recommendation: "İstif yüksekliği ve sabitleme durumu kontrol edilmeli, devrilme önlemi alınmalıdır.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: categoryR2DProfiles.storage,
    fkValues: categoryFKProfiles.storage,
    matrixValues: categoryMatrixProfiles.storage,
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R3", x: 74, y: 35 },
      { id: crypto.randomUUID(), kind: "box", label: "İstif", x: 62, y: 14, width: 24, height: 50 },
    ],
  },
  {
    title: "Elektrik tehlikesi — açık pano / kablo",
    category: "Electrical",
    confidence: 0.86,
    severity: "high",
    recommendation: "Açık elektrik panoları kapatılmalı, hasarlı kablolar değiştirilmelidir.",
    correctiveActionRequired: false,
    isManual: false,
    legalReferences: [],
    r2dValues: categoryR2DProfiles.electrical,
    fkValues: categoryFKProfiles.electrical,
    matrixValues: categoryMatrixProfiles.electrical,
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R4", x: 18, y: 40 },
      { id: crypto.randomUUID(), kind: "box", label: "Pano/Kablo", x: 8, y: 28, width: 20, height: 28 },
    ],
  },
  {
    title: "Ergonomi riski — uygunsuz kaldırma",
    category: "Ergonomi",
    confidence: 0.84,
    severity: "high",
    recommendation: "Ağır yük taşıma prosedürü gözden geçirilmeli, mekanik yardım sağlanmalıdır.",
    correctiveActionRequired: false,
    isManual: false,
    legalReferences: [],
    r2dValues: categoryR2DProfiles.ergonomi,
    fkValues: categoryFKProfiles.ergonomi,
    matrixValues: categoryMatrixProfiles.ergonomi,
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R5", x: 50, y: 52 },
      { id: crypto.randomUUID(), kind: "box", label: "Yük/Kişi", x: 36, y: 34, width: 28, height: 36 },
    ],
  },
  {
    title: "Yangın riski — söndürücü erişimi engelli",
    category: "Yangın",
    confidence: 0.82,
    severity: "high",
    recommendation: "Yangın söndürücü önündeki engeller kaldırılmalı, erişim yolu açık tutulmalıdır.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.5, c2: 0.1, c3: 0.3, c4: 0.15, c5: 0.4, c6: 0.8, c7: 0.2, c8: 0.1, c9: 0.15 },
    fkValues: { likelihood: 3, severity: 40, exposure: 6 },
    matrixValues: { likelihood: 3, severity: 4 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R6", x: 88, y: 70 },
      { id: crypto.randomUUID(), kind: "box", label: "Söndürücü", x: 80, y: 60, width: 16, height: 24 },
    ],
  },
  {
    title: "Acil çıkış yolu engelli / işaretsiz",
    category: "Acil Durum",
    confidence: 0.79,
    severity: "critical",
    recommendation: "Acil çıkış yolları temizlenmeli, yönlendirme işaretleri kontrol edilmelidir.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.3, c2: 0.05, c3: 0.7, c4: 0.1, c5: 0.1, c6: 0.9, c7: 0.1, c8: 0.2, c9: 0.4 },
    fkValues: { likelihood: 6, severity: 40, exposure: 10 },
    matrixValues: { likelihood: 4, severity: 5 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R7", x: 12, y: 88 },
    ],
  },
  {
    title: "Makine koruma kapağı açık / devre dışı",
    category: "Makine",
    confidence: 0.88,
    severity: "critical",
    recommendation: "Makine koruma tertibatı etkinleştirilmeli; enerji kilitleme prosedürü uygulanmalıdır.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.6, c2: 0.2, c3: 0.5, c4: 0.1, c5: 0.05, c6: 0.2, c7: 0.9, c8: 0.15, c9: 0.2 },
    fkValues: { likelihood: 6, severity: 15, exposure: 6 },
    matrixValues: { likelihood: 4, severity: 4 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R8", x: 35, y: 58 },
      { id: crypto.randomUUID(), kind: "box", label: "Makine", x: 22, y: 44, width: 30, height: 30 },
    ],
  },
  {
    title: "Yüksekte çalışma — korkuluk/yaşam hattı eksik",
    category: "Yüksekte Çalışma",
    confidence: 0.85,
    severity: "critical",
    recommendation: "Yüksekte çalışma alanına korkuluk veya yaşam hattı sistemi kurulmalıdır.",
    correctiveActionRequired: true,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.4, c2: 0.6, c3: 0.85, c4: 0.15, c5: 0.05, c6: 0.6, c7: 0.3, c8: 0.1, c9: 0.35 },
    fkValues: { likelihood: 6, severity: 40, exposure: 3 },
    matrixValues: { likelihood: 3, severity: 5 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R9", x: 65, y: 15 },
    ],
  },
  {
    title: "Kimyasal madde uygunsuz depolanması",
    category: "Kimyasal",
    confidence: 0.80,
    severity: "high",
    recommendation: "Kimyasal maddeler SDS'ye uygun şekilde etiketlenmeli ve uyumlu dolaplarda depolanmalıdır.",
    correctiveActionRequired: false,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.35, c2: 0.15, c3: 0.3, c4: 0.25, c5: 0.85, c6: 0.3, c7: 0.2, c8: 0.1, c9: 0.3 },
    fkValues: { likelihood: 3, severity: 7, exposure: 6 },
    matrixValues: { likelihood: 3, severity: 3 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R10", x: 82, y: 48 },
    ],
  },
  {
    title: "Aydınlatma yetersizliği",
    category: "Çevre",
    confidence: 0.76,
    severity: "medium",
    recommendation: "Çalışma alanının aydınlatma ölçümü yapılmalı, gerekiyorsa ek aydınlatma sağlanmalıdır.",
    correctiveActionRequired: false,
    isManual: false,
    legalReferences: [],
    r2dValues: { c1: 0.2, c2: 0.1, c3: 0.3, c4: 0.7, c5: 0.05, c6: 0.4, c7: 0.1, c8: 0.15, c9: 0.3 },
    fkValues: { likelihood: 3, severity: 3, exposure: 10 },
    matrixValues: { likelihood: 3, severity: 2 },
    fmeaValues: getDefaultFMEAValues(), hazopValues: getDefaultHAZOPValues(), bowTieValues: getDefaultBowTieValues(), ftaValues: getDefaultFTAValues(), checklistValues: getDefaultChecklistValues(), jsaValues: getDefaultJSAValues(), lopaValues: getDefaultLOPAValues(),
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R11", x: 50, y: 10 },
    ],
  },
];

/* Mock fallback functions removed — only real AI analysis is used */

/* ================================================================== */
/* Annotation render                                                   */
/* ================================================================== */

function annotationStyle(style: CSSProperties, active: boolean): CSSProperties {
  return { ...style, zIndex: active ? 20 : 10 };
}

function renderAnnotation(annotation: FindingAnnotation, active: boolean, onClick: () => void) {
  if (annotation.kind === "pin") {
    return (
      <button
        key={annotation.id}
        type="button"
        onClick={onClick}
        title={annotation.label}
        className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg transition-transform hover:scale-105 ${
          active
            ? "border-red-700 bg-red-600 text-white dark:border-red-400 dark:bg-red-500"
            : "border-white bg-slate-900/90 text-white dark:border-slate-300 dark:bg-slate-800"
        }`}
        style={annotationStyle({ left: `${annotation.x}%`, top: `${annotation.y}%` }, active)}
      >
        {annotation.label}
      </button>
    );
  }

  if (annotation.kind === "box") {
    return (
      <button
        key={annotation.id}
        type="button"
        onClick={onClick}
        title={annotation.label}
        className={`absolute rounded-md border-2 ${
          active
            ? "border-red-600 bg-red-500/10 shadow-[0_0_0_2px_rgba(220,38,38,0.18)] dark:border-red-400 dark:bg-red-400/10"
            : "border-cyan-400 bg-cyan-400/10 dark:border-cyan-300 dark:bg-cyan-300/10"
        }`}
        style={annotationStyle({ left: `${annotation.x}%`, top: `${annotation.y}%`, width: `${annotation.width}%`, height: `${annotation.height}%` }, active)}
      >
        <span className={`absolute -top-7 left-0 rounded-md px-2 py-1 text-[10px] font-semibold ${active ? "bg-red-600 text-white" : "bg-cyan-500 text-white"}`}>
          {annotation.label}
        </span>
      </button>
    );
  }

  return (
    <button
      key={annotation.id}
      type="button"
      onClick={onClick}
      className="absolute inset-0"
      title={annotation.label}
      style={annotationStyle({}, active)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polygon
          points={annotation.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={active ? "rgba(239,68,68,0.18)" : "rgba(6,182,212,0.18)"}
          stroke={active ? "rgb(220,38,38)" : "rgb(8,145,178)"}
          strokeWidth="1.8"
        />
      </svg>
      <span
        className={`absolute rounded-md px-2 py-1 text-[10px] font-semibold ${active ? "bg-red-600 text-white" : "bg-cyan-500 text-white"}`}
        style={{ left: `${annotation.points[0]?.x ?? 0}%`, top: `${annotation.points[0]?.y ?? 0}%`, transform: "translate(-10%, -120%)" }}
      >
        {annotation.label}
      </span>
    </button>
  );
}

/* ================================================================== */
/* Score Display Panels                                                */
/* ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function R2DPanel({ finding, onUpdate }: { finding: VisualFinding; onUpdate: (f: VisualFinding) => void }) {
  const result = finding.r2dResult;
  if (!result) return null;

  const updateParam = (key: string, value: number) => {
    const next = { ...finding, r2dValues: { ...finding.r2dValues, [key]: value } };
    onUpdate(computeAllScores(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: result.color }}>
          {(result.score * 100).toFixed(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{result.label}</p>
          <p className="text-xs text-muted-foreground">{result.action}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border bg-card px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Taban</p>
          <p className="text-sm font-bold text-foreground">{(result.sBase * 100).toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tepe</p>
          <p className="text-sm font-bold text-foreground">{(result.sPeak * 100).toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dominant</p>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{result.dominantParam}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parametreler</p>
        {R2D_PARAMS.map((param) => {
          const val = finding.r2dValues[param.key] ?? 0;
          const contrib = result.paramContributions.find((c) => c.code === param.code);
          const barWidth = contrib ? (contrib.contribution / (result.sBase || 0.01)) * 100 : 0;

          return (
            <div key={param.key} className="group">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {param.code}
                  {param.overrideCoeff !== null && (
                    <span className="ml-1 text-[10px] text-amber-500" title={`Override: x${param.overrideCoeff}`}>x{param.overrideCoeff}</span>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">{(val * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(val * 100)}
                  onChange={(e) => updateParam(param.key, Number(e.target.value) / 100)}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[var(--accent)] dark:bg-slate-700"
                  title={param.description}
                />
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, barWidth)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FKPanel({ finding, onUpdate }: { finding: VisualFinding; onUpdate: (f: VisualFinding) => void }) {
  const result = finding.fkResult;
  if (!result) return null;

  const update = (field: keyof FKValues, value: number) => {
    const next = { ...finding, fkValues: { ...finding.fkValues, [field]: value } };
    onUpdate(computeAllScores(next));
  };

  const selectClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground [&_option]:bg-white [&_option]:text-slate-900 dark:[&_option]:bg-[var(--navy-mid)] dark:[&_option]:text-white";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-white" style={{ backgroundColor: result.color }}>
          {Math.round(result.score)}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{result.label}</p>
          <p className="text-xs text-muted-foreground">{result.action}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 text-center text-xs text-muted-foreground">
        {finding.fkValues.likelihood} x {finding.fkValues.severity} x {finding.fkValues.exposure} = <span className="font-bold text-foreground">{Math.round(result.score)}</span>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Olasılık (L)</label>
          <select value={finding.fkValues.likelihood} onChange={(e) => update("likelihood", Number(e.target.value))} className={selectClass}>
            {FK_LIKELIHOOD.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.description}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Şiddet (S)</label>
          <select value={finding.fkValues.severity} onChange={(e) => update("severity", Number(e.target.value))} className={selectClass}>
            {FK_SEVERITY.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.description}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Frekans / Maruziyet (E)</label>
          <select value={finding.fkValues.exposure} onChange={(e) => update("exposure", Number(e.target.value))} className={selectClass}>
            {FK_EXPOSURE.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.description}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MatrixPanel({ finding, onUpdate }: { finding: VisualFinding; onUpdate: (f: VisualFinding) => void }) {
  const result = finding.matrixResult;
  if (!result) return null;
  const grid = getMatrixGrid();

  const updateBoth = (likelihood: number, severity: number) => {
    const next = { ...finding, matrixValues: { likelihood, severity } };
    onUpdate(computeAllScores(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: result.cellColor }}>
          {result.score}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{result.label}</p>
          <p className="text-xs text-muted-foreground">{result.action}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border-b border-r border-border bg-card p-1 text-muted-foreground">O\S</th>
              {[1, 2, 3, 4, 5].map((s) => (
                <th key={s} className="border-b border-border bg-card p-1 text-center text-muted-foreground">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((l) => (
              <tr key={l}>
                <td className="border-r border-border bg-card p-1 text-center font-semibold text-muted-foreground">{l}</td>
                {[1, 2, 3, 4, 5].map((s) => {
                  const cell = grid.find((c) => c.likelihood === l && c.severity === s);
                  const isSelected = finding.matrixValues.likelihood === l && finding.matrixValues.severity === s;
                  return (
                    <td
                      key={s}
                      onClick={() => updateBoth(l, s)}
                      className={`cursor-pointer p-1 text-center font-bold text-white transition-opacity hover:opacity-80 ${isSelected ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                      style={{ backgroundColor: cell?.color ?? "#64748B" }}
                    >
                      {l * s}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-semibold text-muted-foreground">Olasılık ({finding.matrixValues.likelihood})</p>
          <p className="text-foreground">{MATRIX_LIKELIHOOD_LABELS[finding.matrixValues.likelihood - 1]}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Şiddet ({finding.matrixValues.severity})</p>
          <p className="text-foreground">{MATRIX_SEVERITY_LABELS[finding.matrixValues.severity - 1]}</p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Main Component                                                      */
/* ================================================================== */

export function RiskAnalysisClient() {
  const searchParams = useSearchParams();

  /* ── Setup state (persisted across page navigation) ── */
  const [analysisTitle, setAnalysisTitle] = usePersistedState("risk:title", "Saha Risk Analizi");
  const [analysisNote, setAnalysisNote] = usePersistedState("risk:note", "Her satır bir risk konusu veya uygunsuzluk grubunu temsil eder. Aynı satıra bir veya birden fazla fotoğraf eklenebilir.");
  const [method, setMethod] = usePersistedState<AnalysisMethod>("risk:method", "r_skor");

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = usePersistedState("risk:companyId", "");

  useEffect(() => {
    let cancelled = false;
    const fallback = loadCompanyDirectory();
    setCompanies(fallback);
    // Sadece henuz secim yapilmamissa default ata
    setSelectedCompanyId((prev) => prev || fallback[0]?.id || "");

    fetchCompaniesFromSupabase().then((sb) => {
      if (cancelled) return;
      if (sb && sb.length > 0) {
        setCompanies(sb);
        saveCompanyDirectory(sb);
        // Sadece mevcut secim listede yoksa degistir
        setSelectedCompanyId((prev) => {
          if (prev && sb.find((c) => c.id === prev)) return prev;
          return sb[0]?.id ?? "";
        });
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL'den gelen companyId parametresi — firma sayfasından yönlendirme
  useEffect(() => {
    const urlCompanyId = searchParams.get("companyId");
    if (urlCompanyId && companies.length > 0) {
      const found = companies.find((c) => c.id === urlCompanyId);
      if (found) {
        setSelectedCompanyId(urlCompanyId);
        // loadId varsa analizi yükle, yoksa yeni analiz wizard'ı aç
        if (!searchParams.get("loadId")) {
          setViewMode("wizard");
          setStep(1);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, companies]);

  // URL'den gelen loadId parametresi — mevcut analizi düzenleme modunda aç
  const loadIdHandled = useRef(false);
  useEffect(() => {
    const loadId = searchParams.get("loadId");
    if (!loadId || loadIdHandled.current) return;
    loadIdHandled.current = true;

    (async () => {
      const full = await loadRiskAssessment(loadId);
      if (!full) return;

      // 1. Setup state'lerini doldur
      setAnalysisTitle(full.title);
      setAnalysisNote(full.analysisNote);
      setMethod(full.method as AnalysisMethod);
      setSelectedLocation(full.locationText);
      setSelectedDepartment(full.departmentName);
      setCurrentAssessmentId(full.id);

      // Katılımcıları doldur
      if (Array.isArray(full.participants) && full.participants.length > 0) {
        setParticipants(
          (full.participants as { fullName: string; roleCode: string; title: string; certificateNo: string }[]).map((p) => ({
            id: crypto.randomUUID(),
            fullName: p.fullName,
            roleCode: p.roleCode,
            title: p.title,
            certificateNo: p.certificateNo,
          }))
        );
      }

      // 2. Görselleri signed URL'den Blob olarak indir → UploadedImage oluştur
      const newLines: RiskLine[] = [];
      const newResults: LineResult[] = [];

      for (const row of full.rows) {
        const lineId = row.id;
        const uploadedImages: UploadedImage[] = [];
        // DB image ID → yeni local image ID eşleştirmesi
        const dbImageIdToLocalId = new Map<string, string>();

        for (const img of row.images) {
          const localImgId = crypto.randomUUID();
          dbImageIdToLocalId.set(img.id, localImgId);

          if (img.signedUrl) {
            try {
              const resp = await fetch(img.signedUrl);
              const blob = await resp.blob();
              const file = new File([blob], img.fileName, { type: blob.type || "image/jpeg" });
              uploadedImages.push({
                id: localImgId,
                file,
                previewUrl: URL.createObjectURL(blob),
              });
            } catch {
              // Signed URL süresi dolmuşsa veya hata varsa placeholder
              uploadedImages.push({
                id: localImgId,
                file: new File([], img.fileName, { type: "image/jpeg" }),
                previewUrl: "",
              });
            }
          }
        }

        newLines.push({
          id: lineId,
          title: row.title,
          description: row.description ?? "",
          images: uploadedImages,
        });

        // 3. Findings → VisualFinding dönüşümü
        const findings: VisualFinding[] = row.findings.map((f) => ({
          id: f.id,
          imageId: dbImageIdToLocalId.get(f.imageId) ?? f.imageId,
          title: f.title,
          category: f.category,
          confidence: f.confidence,
          severity: f.severity as DetectionSeverity,
          recommendation: f.recommendation ?? "",
          correctiveActionRequired: f.correctiveActionRequired,
          annotations: (f.annotations ?? []) as FindingAnnotation[],
          isManual: f.isManual,
          legalReferences: f.legalReferences,
          r2dValues: (f.r2dValues ?? { c1: 0.5, c2: 0.5, c3: 0.5, c4: 0.5, c5: 0.5, c6: 0.5, c7: 0.5, c8: 0.5, c9: 0.5 }) as R2DValues,
          r2dResult: (f.r2dResult ?? null) as R2DResult | null,
          fkValues: (f.fkValues ?? { likelihood: 3, severity: 7, exposure: 6 }) as FKValues,
          fkResult: (f.fkResult ?? null) as FKResult | null,
          matrixValues: (f.matrixValues ?? { likelihood: 3, severity: 3 }) as MatrixValues,
          matrixResult: (f.matrixResult ?? null) as MatrixResult | null,
          fmeaValues: ((f as Record<string, unknown>).fmeaValues ?? getDefaultFMEAValues()) as FMEAValues,
          fmeaResult: ((f as Record<string, unknown>).fmeaResult ?? null) as FMEAResult | null,
          hazopValues: ((f as Record<string, unknown>).hazopValues ?? getDefaultHAZOPValues()) as HAZOPValues,
          hazopResult: ((f as Record<string, unknown>).hazopResult ?? null) as HAZOPResult | null,
          bowTieValues: ((f as Record<string, unknown>).bowTieValues ?? getDefaultBowTieValues()) as BowTieValues,
          bowTieResult: ((f as Record<string, unknown>).bowTieResult ?? null) as BowTieResult | null,
          ftaValues: ((f as Record<string, unknown>).ftaValues ?? getDefaultFTAValues()) as FTAValues,
          ftaResult: ((f as Record<string, unknown>).ftaResult ?? null) as FTAResult | null,
          checklistValues: ((f as Record<string, unknown>).checklistValues ?? getDefaultChecklistValues()) as ChecklistValues,
          checklistResult: ((f as Record<string, unknown>).checklistResult ?? null) as ChecklistResult | null,
          jsaValues: ((f as Record<string, unknown>).jsaValues ?? getDefaultJSAValues()) as JSAValues,
          jsaResult: ((f as Record<string, unknown>).jsaResult ?? null) as JSAResult | null,
          lopaValues: ((f as Record<string, unknown>).lopaValues ?? getDefaultLOPAValues()) as LOPAValues,
          lopaResult: ((f as Record<string, unknown>).lopaResult ?? null) as LOPAResult | null,
        }));

        newResults.push({
          rowId: lineId,
          rowTitle: row.title,
          imageCount: uploadedImages.length,
          findings,
        });
      }

      setLines(newLines);
      setResults(newResults);

      // 4. Wizard moduna geç — 3. adım (sonuçlar)
      setViewMode("wizard");
      setStep(3);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Firma secildiginde ekip uyelerini yukle
  useEffect(() => {
    if (!selectedCompanyId) { setTeamMembers([]); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const [{ data: members }, { data: categories }] = await Promise.all([
        supabase.from("team_members").select("id, full_name, title, category_id, cert_number").eq("company_workspace_id", selectedCompanyId).eq("is_active", true).order("full_name"),
        supabase.from("team_categories").select("id, name"),
      ]);
      if (cancelled) return;
      const catMap = new Map((categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      setTeamMembers((members ?? []).map((m: { id: string; full_name: string; title: string | null; category_id: string | null; cert_number: string | null }) => ({
        id: m.id,
        full_name: m.full_name,
        title: m.title,
        category_name: m.category_id ? catMap.get(m.category_id) ?? null : null,
        cert_number: m.cert_number,
      })));
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);
  const [selectedLocation, setSelectedLocation] = usePersistedState("risk:location", "");
  const [selectedDepartment, setSelectedDepartment] = usePersistedState("risk:department", "");

  const [participants, setParticipants] = usePersistedState<Participant[]>("risk:participants", [createParticipant()]);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupMessageType, setSetupMessageType] = useState<"success" | "error" | "">("");

  /* ── Lines state ── */
  const [lines, setLines] = useState<RiskLine[]>([{ id: crypto.randomUUID(), title: "İstifleme alanı", description: "Aynı durumun genel ve yakın açıdan çekilmiş görselleri birlikte eklenebilir.", images: [] }]);

  /* ── Results state ── */
  const [results, setResults] = useState<LineResult[]>([]);
  const [selectedImageByRow, setSelectedImageByRow] = useState<Record<string, string>>({});
  const [selectedFindingByRow, setSelectedFindingByRow] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageMetaMap, setImageMetaMap] = useState<Record<string, ImageMeta>>({});
  const [noRiskImages, setNoRiskImages] = useState<Set<string>>(new Set());

  /* ── Wizard step ── */
  const [step, setStep] = usePersistedState<1 | 2 | 3 | 4>("risk:step", 1);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState("");

  /* ── Sayfa modu: "list" = firma + geçmiş listesi, "wizard" = analiz wizard ── */
  const [viewMode, setViewMode] = usePersistedState<"list" | "wizard">("risk:viewMode", "list");

  /* ── Kayıtlı analizler ── */
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAssessment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [currentAssessmentId, setCurrentAssessmentId] = useState<string | null>(null);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Firma seçildiğinde analizleri yükle
  useEffect(() => {
    if (!selectedCompanyId) { setSavedAnalyses([]); return; }
    setLoadingAnalyses(true);
    listRiskAssessments(selectedCompanyId).then((list) => {
      setSavedAnalyses(list);
      setLoadingAnalyses(false);
    });
  }, [selectedCompanyId]);

  /* ── Saved team members (from company team management) ── */
  type TeamMemberBasic = { id: string; full_name: string; title: string | null; category_name: string | null; cert_number: string | null };
  const [teamMembers, setTeamMembers] = useState<TeamMemberBasic[]>([]);

  /* ── Manual annotation mode ── */
  const [pinMode, setPinMode] = useState<string | null>(null); // rowId when active
  const [pendingPin, setPendingPin] = useState<{ rowId: string; imageId: string; x: number; y: number } | null>(null);
  const [pendingPinTitle, setPendingPinTitle] = useState("");
  const [pendingPinSeverity, setPendingPinSeverity] = useState<DetectionSeverity>("medium");

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const _cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({}); // eslint-disable-line @typescript-eslint/no-unused-vars

  /* ── Derived ── */
  const selectedCompany = useMemo(() => companies.find((c) => c.id === selectedCompanyId) ?? null, [companies, selectedCompanyId]);
  const validParticipants = useMemo(() => participants.filter((p) => p.fullName.trim() && p.roleCode.trim()), [participants]);
  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const totalImageCount = useMemo(() => lines.reduce((s, l) => s + l.images.length, 0), [lines]);

  const allFindings = useMemo(() => results.flatMap((r) => r.findings), [results]);
  const totalDetectionCount = allFindings.length;
  const criticalHighCount = useMemo(() => allFindings.filter((f) => {
    const rc = getActiveRiskClass(f, method);
    return rc === "critical" || rc === "high";
  }).length, [allFindings, method]);
  const dofCandidateCount = useMemo(() => allFindings.filter((f) => f.correctiveActionRequired).length, [allFindings]);
  const avgScore = useMemo(() => {
    if (allFindings.length === 0) return 0;
    const sum = allFindings.reduce((s, f) => s + getActiveScore(f, method).score, 0);
    return sum / allFindings.length;
  }, [allFindings, method]);

  /* ── Validation ── */
  function validateSetup(): string | null {
    if (!selectedCompanyId) return "Önce firma / kurum seçmelisin.";
    if (!selectedLocation) return "Lokasyon / çalışma alanı seçmelisin.";
    if (!selectedDepartment) return "Bölüm / birim seçmelisin.";
    if (validParticipants.length === 0) return "En az bir görevli kişi adı ve rolü girilmelidir.";
    return null;
  }

  /* ── Participant ops ── */
  function updateParticipant(pid: string, field: keyof Omit<Participant, "id">, value: string) {
    setParticipants((prev) => prev.map((p) => p.id === pid ? { ...p, [field]: value } : p));
    setSetupMessage(""); setSetupMessageType("");
  }
  function addParticipant() { setParticipants((prev) => [...prev, createParticipant()]); setSetupMessage(""); setSetupMessageType(""); }
  function removeParticipant(pid: string) { setParticipants((prev) => prev.length === 1 ? prev : prev.filter((p) => p.id !== pid)); setSetupMessage(""); setSetupMessageType(""); }

  /* ── Line ops ── */
  function updateLine(lid: string, field: "title" | "description", value: string) {
    setLines((prev) => prev.map((l) => l.id === lid ? { ...l, [field]: value } : l));
    setResults([]);
  }
  function appendFiles(lid: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith("image/")).map((f) => ({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) }));
    setLines((prev) => prev.map((l) => l.id === lid ? { ...l, images: [...l.images, ...imgs] } : l));
    setResults([]);
  }
  function removeImage(lid: string, imgId: string) {
    setLines((prev) => prev.map((l) => {
      if (l.id !== lid) return l;
      const t = l.images.find((i) => i.id === imgId);
      if (t) URL.revokeObjectURL(t.previewUrl);
      return { ...l, images: l.images.filter((i) => i.id !== imgId) };
    }));
    setResults((prev) => prev.map((r) => r.rowId === lid ? { ...r, findings: r.findings.filter((f) => f.imageId !== imgId) } : r));
  }
  function addLine() { setLines((prev) => [createLine(), ...prev]); setResults([]); }

  /** Toplu yukleme: Her gorsel icin ayri bir satir olustur */
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  function bulkUploadToSeparateLines(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const newLines: RiskLine[] = imageFiles.map((file, idx) => {
      const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
      return {
        id: crypto.randomUUID(),
        title: cleanName || `Alan ${idx + 1}`,
        description: "",
        images: [{ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }],
      };
    });

    setLines(() => {
      // Toplu yuklemede tum mevcut satirlari temizle, sadece yeni satirlarla baslat
      return [...newLines];
    });
    setResults([]);
  }
  function removeLine(lid: string) {
    setLines((prev) => { const t = prev.find((l) => l.id === lid); t?.images.forEach((i) => URL.revokeObjectURL(i.previewUrl)); return prev.filter((l) => l.id !== lid); });
    setResults((prev) => prev.filter((r) => r.rowId !== lid));
    setSelectedImageByRow((prev) => { const n = { ...prev }; delete n[lid]; return n; });
    setSelectedFindingByRow((prev) => { const n = { ...prev }; delete n[lid]; return n; });
  }

  /* ── Finding update (for score panel changes) ── */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateFinding = useCallback((rowId: string, updatedFinding: VisualFinding) => {
    setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, findings: r.findings.map((f) => f.id === updatedFinding.id ? updatedFinding : f) } : r));
  }, []);

  /* ── Toggle DÖF ── */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleDof = useCallback((rowId: string, findingId: string) => {
    setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, findings: r.findings.map((f) => f.id === findingId ? { ...f, correctiveActionRequired: !f.correctiveActionRequired } : f) } : r));
  }, []);

  /* ── Tespit silme ── */
  const [pendingDeleteFinding, setPendingDeleteFinding] = useState<{ rowId: string; findingId: string; title: string } | null>(null);
  const deleteFinding = useCallback((rowId: string, findingId: string) => {
    setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, findings: r.findings.filter((f) => f.id !== findingId) } : r));
    setSelectedFindingByRow((prev) => { const n = { ...prev }; if (n[rowId] === findingId) delete n[rowId]; return n; });
    setPendingDeleteFinding(null);
  }, []);

  /* ── Analyze ── */
  /** Gorsel dosyayi base64'e cevir */
  /** Gorseli max 1600px'e kucultup base64'e cevir (API limitleri icin) */
  async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context yok")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType: "image/jpeg" });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /** Kategori bazli R2D profili — ciddiyet ile carpan uygula */
  function clamp01(v: unknown): number { return Math.min(1, Math.max(0, Number(v) || 0)); }

  function getR2DForCategory(category: string, severity?: DetectionSeverity): R2DValues {
    const key = category.toLowerCase().trim();
    const profile = categoryR2DProfiles[key];
    const base = profile ? { ...profile } : { c1: 0.4, c2: 0.3, c3: 0.4, c4: 0.2, c5: 0.2, c6: 0.3, c7: 0.3, c8: 0.15, c9: 0.25 };

    // Ciddiyet carpani — ayni kategori farkli ciddiyet = farkli skor
    const multiplier = severity === "critical" ? 1.3 : severity === "high" ? 1.1 : severity === "medium" ? 0.9 : 0.7;
    const keys = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"] as const;
    for (const k of keys) {
      base[k] = Math.min(1, (base[k] ?? 0) * multiplier);
    }
    return base;
  }

  function getFKForCategory(category: string, severity?: DetectionSeverity): FKValues {
    const key = category.toLowerCase().trim();
    const profile = categoryFKProfiles[key];
    if (profile) return { ...profile };
    // Fallback ciddiyet bazli
    switch (severity) {
      case "critical": return { likelihood: 6, severity: 40, exposure: 6 };
      case "high": return { likelihood: 6, severity: 15, exposure: 6 };
      case "medium": return { likelihood: 3, severity: 7, exposure: 6 };
      default: return { likelihood: 1, severity: 3, exposure: 3 };
    }
  }

  function getMatrixForCategory(category: string, severity?: DetectionSeverity): MatrixValues {
    const key = category.toLowerCase().trim();
    const profile = categoryMatrixProfiles[key];
    if (profile) return { ...profile };
    switch (severity) {
      case "critical": return { likelihood: 4, severity: 5 };
      case "high": return { likelihood: 4, severity: 3 };
      case "medium": return { likelihood: 3, severity: 2 };
      default: return { likelihood: 2, severity: 2 };
    }
  }

  /** Nova AI Vision ile tek gorsel analiz et */
  async function analyzeImageWithAI(imageFile: File, imageId: string): Promise<{ findings: VisualFinding[]; meta: ImageMeta }> {
    try {
      const { base64, mimeType } = await fileToBase64(imageFile);
      const res = await fetch("/api/analyze-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, method }),
      });

      const emptyMeta: ImageMeta = { imageId, faces: [], positiveObservations: [], photoQuality: { level: "good", note: "" }, areaSummary: "", personCount: 0, imageRelevance: "relevant", imageDescription: "" };

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("AI analiz hatası:", res.status, errBody);
        return { findings: [], meta: emptyMeta };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as Record<string, any>;

      const meta: ImageMeta = {
        imageId,
        faces: Array.isArray(data.faces) ? data.faces.map((f: FaceRegion) => ({ faceX: f.faceX ?? 0, faceY: f.faceY ?? 0, faceW: f.faceW ?? 5, faceH: f.faceH ?? 6 })) : [],
        positiveObservations: Array.isArray(data.positiveObservations) ? data.positiveObservations : [],
        photoQuality: data.photoQuality ?? { level: "good", note: "" },
        areaSummary: data.areaSummary ?? "",
        personCount: data.personCount ?? 0,
        imageRelevance: data.imageRelevance === "irrelevant" ? "irrelevant" : data.imageRelevance === "not_real_photo" ? "not_real_photo" : "relevant",
        imageDescription: data.imageDescription ?? "",
      };

      // Uygunsuz gorsel — risk analizi yapilamaz
      if (meta.imageRelevance !== "relevant") {
        return { findings: [], meta };
      }

      const risks = Array.isArray(data.risks) ? data.risks : [];

      const findings = risks.map((risk, idx) => {
        const annotations: FindingAnnotation[] = [
          { id: crypto.randomUUID(), kind: "pin" as const, label: `R${idx + 1}`, x: risk.pinX, y: risk.pinY },
        ];
        if (risk.boxX != null && risk.boxY != null && risk.boxW != null && risk.boxH != null) {
          annotations.push({
            id: crypto.randomUUID(), kind: "box" as const,
            label: risk.category, x: risk.boxX, y: risk.boxY, width: risk.boxW, height: risk.boxH,
          });
        }

        // AI'dan gelen C1-C9 parametrelerini kullan, yoksa fallback profil
        const aiR2D = risk.r2dParams;
        const r2dValues: R2DValues = aiR2D
          ? { c1: clamp01(aiR2D.c1), c2: clamp01(aiR2D.c2), c3: clamp01(aiR2D.c3), c4: clamp01(aiR2D.c4), c5: clamp01(aiR2D.c5), c6: clamp01(aiR2D.c6), c7: clamp01(aiR2D.c7), c8: clamp01(aiR2D.c8), c9: clamp01(aiR2D.c9) }
          : getR2DForCategory(risk.category, risk.severity);

        // Fine-Kinney: AI'dan veya fallback
        const aiFk = risk.fkParams;
        const fkValues: FKValues = aiFk
          ? { likelihood: aiFk.likelihood ?? 3, severity: aiFk.severity ?? 7, exposure: aiFk.exposure ?? 6 }
          : getFKForCategory(risk.category, risk.severity);

        // Matrix: AI'dan veya fallback
        const aiMx = risk.matrixParams;
        const matrixValues: MatrixValues = aiMx
          ? { likelihood: aiMx.likelihood ?? 3, severity: aiMx.severity ?? 3 }
          : getMatrixForCategory(risk.category, risk.severity);

        // Method-specific params from AI
        const sevDefaults = getDefaultsForSeverity(risk.severity);

        const aiFmea = risk.fmeaParams;
        const fmeaValues: FMEAValues = aiFmea
          ? { severity: aiFmea.severity ?? 5, occurrence: aiFmea.occurrence ?? 5, detection: aiFmea.detection ?? 5 }
          : sevDefaults.fmea;

        const aiHazop = risk.hazopParams;
        const hazopValues: HAZOPValues = aiHazop
          ? { severity: aiHazop.severity ?? 3, likelihood: aiHazop.likelihood ?? 3, detectability: aiHazop.detectability ?? 3, guideWord: aiHazop.guideWord ?? "Çok (More)", parameter: aiHazop.parameter ?? "Akış (Flow)", deviation: aiHazop.deviation ?? "" }
          : sevDefaults.hazop;

        const aiBt = risk.bowTieParams;
        const bowTieValues: BowTieValues = aiBt
          ? { threatProbability: aiBt.threatProbability ?? 3, consequenceSeverity: aiBt.consequenceSeverity ?? 3, preventionBarriers: aiBt.preventionBarriers ?? 1, mitigationBarriers: aiBt.mitigationBarriers ?? 1 }
          : sevDefaults.bowTie;

        const aiFta = risk.ftaParams;
        const ftaValues: FTAValues = aiFta?.components
          ? { components: aiFta.components.map((c: { name: string; failureRate: number }) => ({ name: c.name, failureRate: clamp01(c.failureRate) })), gateType: aiFta.gateType === "AND" ? "AND" : "OR", systemCriticality: aiFta.systemCriticality ?? 3 }
          : sevDefaults.fta;

        const aiCl = risk.checklistParams;
        const checklistValues: ChecklistValues = aiCl?.items
          ? { items: aiCl.items.map((i: { text: string; status: string; weight: number }) => ({ id: crypto.randomUUID(), text: i.text, status: (["uygun","uygun_degil","kismi","na"].includes(i.status) ? i.status : "uygun_degil") as ChecklistItem["status"], weight: Math.min(3, Math.max(1, i.weight ?? 1)) })), category: aiCl.category ?? risk.category }
          : sevDefaults.checklist;

        const aiJsa = risk.jsaParams;
        const jsaValues: JSAValues = aiJsa?.steps
          ? { jobTitle: aiJsa.jobTitle ?? "", steps: aiJsa.steps.map((s: { stepDescription: string; hazard: string; severity: number; likelihood: number; controlEffectiveness: number; controlMeasures: string }) => ({ id: crypto.randomUUID(), stepDescription: s.stepDescription, hazard: s.hazard ?? "", severity: s.severity ?? 3, likelihood: s.likelihood ?? 3, controlEffectiveness: s.controlEffectiveness ?? 3, controlMeasures: s.controlMeasures ?? "" })) }
          : sevDefaults.jsa;

        const aiLopa = risk.lopaParams;
        const lopaValues: LOPAValues = aiLopa?.layers
          ? { initiatingEventFreq: aiLopa.initiatingEventFreq ?? 0.1, consequenceSeverity: aiLopa.consequenceSeverity ?? 3, layers: aiLopa.layers.map((l: { name: string; pfd: number }) => ({ id: crypto.randomUUID(), name: l.name, pfd: l.pfd ?? 0.1 })) }
          : sevDefaults.lopa;
        const scored = computeAllScores({
          id: crypto.randomUUID(),
          imageId,
          title: risk.title,
          category: risk.category,
          confidence: risk.confidence,
          severity: risk.severity,
          recommendation: risk.recommendation,
          correctiveActionRequired: risk.correctiveActionRequired,
          isManual: false,
          legalReferences: risk.legalReferences ?? [],
          annotations,
          r2dValues,
          fkValues,
          matrixValues,
          fmeaValues,
          hazopValues,
          bowTieValues,
          ftaValues,
          checklistValues,
          jsaValues,
          lopaValues,
          r2dResult: null,
          fkResult: null,
          matrixResult: null,
          fmeaResult: null,
          hazopResult: null,
          bowTieResult: null,
          ftaResult: null,
          checklistResult: null,
          jsaResult: null,
          lopaResult: null,
        });

        // DÖF adayligini R2D skoruna gore belirle (skor >= 0.60 = DÖF adayi)
        if (scored.r2dResult && scored.r2dResult.score >= 0.60) {
          scored.correctiveActionRequired = true;
        } else if (scored.r2dResult && scored.r2dResult.score < 0.40) {
          scored.correctiveActionRequired = false;
        }
        return scored;
      });

      return { findings, meta };
    } catch (err) {
      console.error("AI analiz exception:", err);
      return { findings: [], meta: { imageId, faces: [], positiveObservations: [], photoQuality: { level: "good" as const, note: "" }, areaSummary: "", personCount: 0, imageRelevance: "relevant" as const, imageDescription: "" } };
    }
  }

  async function handleAnalyze() {
    const err = validateSetup();
    if (err) { setSetupMessage(err); setSetupMessageType("error"); return; }
    if (totalImageCount === 0) { setSetupMessage("Analiz başlatmak için en az bir görsel eklemelisin."); setSetupMessageType("error"); return; }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisMessage("Analiz başlatılıyor...");

    // Manuel findings'i koru
    const existingManualFindings: Record<string, VisualFinding[]> = {};
    results.forEach((r) => {
      const manuals = r.findings.filter((f) => f.isManual);
      if (manuals.length > 0) existingManualFindings[r.rowId] = manuals;
    });
    setResults([]);

    const validLines = lines.filter((l) => l.images.length > 0);
    const totalImages = validLines.reduce((s, l) => s + l.images.length, 0);
    let processedImages = 0;
    const newResults: LineResult[] = [];
    const newSelectedImages: Record<string, string> = {};
    const newSelectedFindings: Record<string, string> = {};
    const newImageMeta: Record<string, ImageMeta> = {};
    const newNoRiskImages = new Set<string>();

    for (let li = 0; li < validLines.length; li++) {
      const line = validLines[li];
      const allFindings: VisualFinding[] = [];

      for (const img of line.images) {
        processedImages++;
        const pct = Math.round((processedImages / totalImages) * 100);
        setAnalysisProgress(Math.min(95, pct));
        setAnalysisMessage(`Görsel ${processedImages}/${totalImages} analiz ediliyor: ${img.file.name}`);
        setSetupMessage(`Görsel analiz ediliyor: Satır ${li + 1}, ${img.file.name}...`);
        setSetupMessageType("success");

        const { findings: aiFindings, meta } = await analyzeImageWithAI(img.file, img.id);
        newImageMeta[img.id] = meta;

        if (aiFindings.length > 0) {
          // Confidence filtresi: 0.85 altini ele (v1.7 — siki esik)
          const validFindings = aiFindings.filter((f) => {
            const conf = f.confidence ?? 0;
            if (conf < 0.85) {
              console.log(`[${img.id}] Dusuk guvenli tespit elendi: ${f.title} (conf=${conf})`);
              return false;
            }
            return true;
          });

          // Confidence tier etiketle
          const taggedFindings = validFindings.map((f) => {
            const conf = f.confidence ?? 0;
            const tier: "high" | "medium" | "low" = conf >= 0.95 ? "high" : conf >= 0.90 ? "medium" : "low";
            return { ...f, confidenceTier: tier };
          });

          // Mukerrer risk filtrele — exact match + fuzzy similarity
          const unique = taggedFindings.filter((newF) => {
            const newTitle = newF.title.toLowerCase();
            const newCat = newF.category.toLowerCase();
            if (allFindings.some((f) => f.title.toLowerCase() === newTitle && f.category.toLowerCase() === newCat)) return false;
            const newWords = new Set(newTitle.split(/\s+/).filter(w => w.length > 2));
            for (const existing of allFindings) {
              if (existing.category.toLowerCase() !== newCat) continue;
              const existWords = new Set(existing.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
              if (existWords.size === 0 || newWords.size === 0) continue;
              const overlap = [...newWords].filter(w => existWords.has(w)).length;
              const similarity = overlap / Math.min(newWords.size, existWords.size);
              if (similarity >= 0.5) return false;
            }
            return true;
          });
          allFindings.push(...unique);

          // Tum tespitler confidence filtresiyle elendiyse
          if (unique.length === 0 && aiFindings.length > 0) {
            newNoRiskImages.add(img.id);
          }
        } else {
          // AI gercekten "risk yok" dedi — BU BIR BASARI, hata degil
          // Mock uretme, hicbir sey ekleme
          newNoRiskImages.add(img.id);
        }
      }

      // Manuel findings'i ekle
      const manuals = existingManualFindings[line.id];
      if (manuals) allFindings.push(...manuals);

      const result: LineResult = {
        rowId: line.id,
        rowTitle: line.title.trim() || `Satır ${li + 1}`,
        imageCount: line.images.length,
        findings: allFindings,
      };
      newResults.push(result);

      const first = allFindings[0];
      if (first) {
        newSelectedImages[line.id] = first.imageId;
        newSelectedFindings[line.id] = first.id;
      }
    }

    setAnalysisProgress(100);
    setAnalysisMessage("Analiz tamamlandı!");
    setResults(newResults);
    setImageMetaMap(newImageMeta);
    setNoRiskImages(newNoRiskImages);
    setSelectedImageByRow(newSelectedImages);
    setSelectedFindingByRow(newSelectedFindings);
    const totalFound = newResults.reduce((s, r) => s + r.findings.length, 0);
    const totalPositive = Object.values(newImageMeta).reduce((s, m) => s + m.positiveObservations.length, 0);
    setSetupMessage(`AI analizi tamamlandı. ${totalFound} risk, ${totalPositive} olumlu tespit.`);
    setSetupMessageType("success");
    setIsAnalyzing(false);
  }

  /* ── Manual pin ── */
  function handleImageClick(e: ReactMouseEvent<HTMLDivElement>, rowId: string, imageId: string) {
    if (!pinMode || pinMode !== rowId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ rowId, imageId, x, y });
    setPendingPinTitle("");
    setPendingPinSeverity("medium");
    setPinMode(null);
  }

  function confirmManualPin() {
    if (!pendingPin || !pendingPinTitle.trim()) return;
    const { rowId, imageId, x, y } = pendingPin;

    const r2dValues = getR2DForCategory("diğer", pendingPinSeverity);
    const fkValues = getFKForCategory("diğer", pendingPinSeverity);
    const matrixValues = getMatrixForCategory("diğer", pendingPinSeverity);
    const sevDefaults = getDefaultsForSeverity(pendingPinSeverity);

    const findingId = crypto.randomUUID();
    const newFinding: VisualFinding = computeAllScores({
      id: findingId,
      imageId,
      title: pendingPinTitle.trim(),
      category: "Manuel Tespit",
      confidence: 1,
      severity: pendingPinSeverity,
      recommendation: "Manuel olarak işaretlendi. Detaylı değerlendirme yapılmalıdır.",
      correctiveActionRequired: pendingPinSeverity === "critical" || pendingPinSeverity === "high",
      isManual: true,
      legalReferences: [],
      annotations: [{ id: crypto.randomUUID(), kind: "pin", label: `M${Math.floor(Math.random() * 90) + 10}`, x, y }],
      r2dValues,
      fkValues,
      matrixValues,
      fmeaValues: sevDefaults.fmea,
      hazopValues: sevDefaults.hazop,
      bowTieValues: sevDefaults.bowTie,
      ftaValues: sevDefaults.fta,
      checklistValues: sevDefaults.checklist,
      jsaValues: sevDefaults.jsa,
      lopaValues: sevDefaults.lopa,
      r2dResult: null,
      fkResult: null,
      matrixResult: null,
      fmeaResult: null,
      hazopResult: null,
      bowTieResult: null,
      ftaResult: null,
      checklistResult: null,
      jsaResult: null,
      lopaResult: null,
    });

    setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, findings: [...r.findings, newFinding] } : r));
    setSelectedFindingByRow((prev) => ({ ...prev, [rowId]: findingId }));
    setSelectedImageByRow((prev) => ({ ...prev, [rowId]: imageId }));
    setPendingPin(null);

    // Arka planda AI'dan oneri ve mevzuat al
    (async () => {
      try {
        const sourceLine = lineMap.get(rowId);
        const img = sourceLine?.images.find((i) => i.id === imageId);
        if (!img) return;

        const { base64, mimeType } = await fileToBase64(img.file);
        const res = await fetch("/api/admin-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Bu görselde tam olarak (${x.toFixed(0)}%, ${y.toFixed(0)}%) konumunda bir risk işaretlendi.

GÖREV: Görselin bu spesifik konumundaki nesne/durum/ekipmanı dikkatlice incele. Kullanıcı bu noktayı "${pendingPinTitle.trim()}" olarak tanımladı, ciddiyet: ${pendingPinSeverity}.

YAPMAN GEREKENLER:
1. Bu konumdaki spesifik nesne/durumu tanımla ve riski somut olarak değerlendir
2. EN AZ 2-3 cümle detaylı öneri yaz — ne yapılacak, nasıl, kim yapacak
3. İlgili Türk İSG mevzuat referanslarını belirle:
   - HER referans için: tam yönetmelik adı + madde numarası + fıkra + maddenin ne söylediğini açıkla
   - En az 2 farklı mevzuat kaynağından referans ver
   - 6331 sayılı İSG Kanunu + ilgili yönetmeliği birlikte kullan
4. Riski en iyi tanımlayan kategoriyi seç

KATEGORİLER: KKD, Düzen/Temizlik, Depolama, Elektrik, Ergonomi, Yangın, Acil Durum, Makine, Yüksekte Çalışma, Kimyasal, Çevre, İskele, Trafik, Diğer

JSON formatında döndür:
{"recommendation": "detaylı öneri", "legalReferences": [{"law": "tam yönetmelik adı", "article": "Madde X, fıkra Y", "description": "maddenin ne söylediğini açıkla"}], "category": "Türkçe kategori"}`,
            history: [],
            imageBase64: base64,
            imageMimeType: mimeType,
          }),
        });

        if (!res.ok) return;
        const data = await res.json() as { response: string };

        // JSON parse dene
        let jsonStr = data.response.trim();
        if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

        try {
          const parsed = JSON.parse(jsonStr) as { recommendation?: string; legalReferences?: LegalReference[]; category?: string };
          setResults((prev) => prev.map((r) => r.rowId === rowId ? {
            ...r,
            findings: r.findings.map((f) => f.id === findingId ? {
              ...f,
              recommendation: parsed.recommendation || f.recommendation,
              legalReferences: parsed.legalReferences || f.legalReferences,
              category: parsed.category || f.category,
            } : f),
          } : r));
        } catch { /* JSON parse basarisiz, mevcut haliyle kalsin */ }
      } catch { /* AI sorgusu basarisiz, sorun degil */ }
    })();
  }

  /* ── Export ── */
  /** Blob URL'i base64 data URL'e cevir — annotation overlay + yuz blur */
  async function blobUrlToDataUrl(blobUrl: string, imageFindings?: VisualFinding[]): Promise<string> {
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(""); return; }
          ctx.drawImage(img, 0, 0);

          // Yüz tespiti ve bulanıklaştırma
          try {
            await blurFacesOnCanvas(canvas, ctx);
          } catch { /* yüz tespiti başarısızsa orijinal devam */ }

          // Annotation overlay: pin, box, polygon çiz
          if (imageFindings && imageFindings.length > 0) {
            drawAnnotationsOnCanvas(ctx, canvas.width, canvas.height, imageFindings);
          }

          resolve(canvas.toDataURL("image/jpeg", 0.90));
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve("");
        img.src = URL.createObjectURL(blob);
      });
    } catch { return ""; }
  }

  /** Canvas uzerine annotation cizimleri (pin, box, polygon) */
  function drawAnnotationsOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, findings: VisualFinding[]) {
    const scale = Math.max(1, Math.min(w, h) / 800); // olceklendirme

    findings.forEach((f, fi) => {
      f.annotations.forEach((a) => {
        if (a.kind === "pin") {
          // Kirmizi daire + beyaz etiket
          const px = (a.x / 100) * w;
          const py = (a.y / 100) * h;
          const r = 14 * scale;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = "#DC2626";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2 * scale;
          ctx.stroke();
          // Etiket
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(10 * scale)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(a.label || `R${fi + 1}`, px, py);
        }

        if (a.kind === "box") {
          // Cyan dikdortgen
          const bx = (a.x / 100) * w;
          const by = (a.y / 100) * h;
          const bw = ((a.width ?? 10) / 100) * w;
          const bh = ((a.height ?? 10) / 100) * h;
          ctx.strokeStyle = "#06B6D4";
          ctx.lineWidth = 2.5 * scale;
          ctx.strokeRect(bx, by, bw, bh);
          // Etiket kutusu
          if (a.label) {
            const fontSize = Math.round(10 * scale);
            ctx.font = `bold ${fontSize}px Arial`;
            const tw = ctx.measureText(a.label).width + 8 * scale;
            ctx.fillStyle = "#06B6D4";
            ctx.fillRect(bx, by - fontSize - 6 * scale, tw, fontSize + 4 * scale);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(a.label, bx + 4 * scale, by - fontSize - 4 * scale);
          }
        }

        if (a.kind === "polygon" && a.points && a.points.length >= 3) {
          // Cyan polygon
          ctx.beginPath();
          ctx.moveTo((a.points[0].x / 100) * w, (a.points[0].y / 100) * h);
          for (let i = 1; i < a.points.length; i++) {
            ctx.lineTo((a.points[i].x / 100) * w, (a.points[i].y / 100) * h);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
          ctx.fill();
          ctx.strokeStyle = "#06B6D4";
          ctx.lineWidth = 2 * scale;
          ctx.stroke();
        }
      });
    });
  }

  /** Canvas üzerindeki yüzleri tespit edip bulanıklaştır */
  async function blurFacesOnCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<void> {
    // FaceDetector API (Chrome 70+, Edge, Opera)
    if ("FaceDetector" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 20 });
        const faces = await detector.detect(canvas);
        for (const face of faces) {
          const { x, y, width, height } = face.boundingBox;
          // Orijinal bölgeyi al
          const faceData = ctx.getImageData(x, y, width, height);
          // Pixelate (hızlı bulanıklaştırma)
          const blockSize = Math.max(8, Math.round(Math.min(width, height) / 6));
          for (let py = 0; py < height; py += blockSize) {
            for (let px = 0; px < width; px += blockSize) {
              const idx = (py * width + px) * 4;
              const r = faceData.data[idx];
              const g = faceData.data[idx + 1];
              const b = faceData.data[idx + 2];
              for (let dy = 0; dy < blockSize && py + dy < height; dy++) {
                for (let dx = 0; dx < blockSize && px + dx < width; dx++) {
                  const i = ((py + dy) * width + (px + dx)) * 4;
                  faceData.data[i] = r;
                  faceData.data[i + 1] = g;
                  faceData.data[i + 2] = b;
                }
              }
            }
          }
          ctx.putImageData(faceData, x, y);
        }
      } catch { /* FaceDetector hata verirse devam */ }
    }
    // FaceDetector yoksa (Firefox, Safari) → canvas filter blur fallback
    // Yüz konumu bilinmediğinden bulanıklaştırma yapılamaz — orijinal kalır
  }

  async function buildExportData(): Promise<RiskAnalysisExportData> {
    const findings: ExportFinding[] = allFindings.map((f) => {
      const sc = getActiveScore(f, method);
      const rc = getActiveRiskClass(f, method);
      return {
        rowTitle: results.find((r) => r.findings.some((ff) => ff.id === f.id))?.rowTitle ?? "",
        imageId: f.imageId,
        title: f.title,
        category: f.category,
        severity: f.severity,
        severityLabel: severityLabel(f.severity),
        score: sc.score,
        scoreLabel: sc.label,
        riskClass: rc,
        action: sc.action,
        recommendation: f.recommendation,
        confidence: f.confidence,
        isManual: f.isManual,
        correctiveActionRequired: f.correctiveActionRequired,
        method: method,
        methodLabel: methodLabel(method),
        paramDetails: f.r2dResult ? R2D_PARAMS.map((p) => ({
          code: p.code,
          label: p.label,
          value: f.r2dValues[p.key] ?? 0,
          contribution: f.r2dResult!.paramContributions.find((c) => c.code === p.code)?.contribution ?? 0,
        })) : undefined,
        fkDetails: f.fkResult ? { likelihood: f.fkValues.likelihood, severity: f.fkValues.severity, exposure: f.fkValues.exposure } : undefined,
        matrixDetails: f.matrixResult ? { likelihood: f.matrixValues.likelihood, severity: f.matrixValues.severity } : undefined,
        fmeaDetails: f.fmeaResult ? { severity: f.fmeaValues.severity, occurrence: f.fmeaValues.occurrence, detection: f.fmeaValues.detection, rpn: f.fmeaResult.rpn } : undefined,
        hazopDetails: f.hazopResult ? { severity: f.hazopValues.severity, likelihood: f.hazopValues.likelihood, detectability: f.hazopValues.detectability, guideWord: f.hazopValues.guideWord, parameter: f.hazopValues.parameter, deviation: f.hazopValues.deviation } : undefined,
        bowTieDetails: f.bowTieResult ? { threatProbability: f.bowTieValues.threatProbability, consequenceSeverity: f.bowTieValues.consequenceSeverity, preventionBarriers: f.bowTieValues.preventionBarriers, mitigationBarriers: f.bowTieValues.mitigationBarriers, rawRisk: f.bowTieResult.rawRisk, residualRisk: f.bowTieResult.residualRisk } : undefined,
        ftaDetails: f.ftaResult ? { componentCount: f.ftaResult.componentCount, gateType: f.ftaResult.gateType, systemProbability: f.ftaResult.systemProbability, systemCriticality: f.ftaResult.systemCriticality } : undefined,
        checklistDetails: f.checklistResult ? { compliancePercent: f.checklistResult.compliancePercent, totalItems: f.checklistResult.totalItems, compliantCount: f.checklistResult.compliantCount, nonCompliantCount: f.checklistResult.nonCompliantCount } : undefined,
        jsaDetails: f.jsaResult ? { jobTitle: f.jsaValues.jobTitle, stepCount: f.jsaValues.steps.length, highRiskStepCount: f.jsaResult.highRiskStepCount, maxStepScore: f.jsaResult.maxStepScore, avgStepScore: f.jsaResult.avgStepScore } : undefined,
        lopaDetails: f.lopaResult ? { initiatingEventFreq: f.lopaResult.initiatingEventFreq, mitigatedFreq: f.lopaResult.mitigatedFreq, riskReductionFactor: f.lopaResult.riskReductionFactor, layerCount: f.lopaResult.layerCount, meetsTarget: f.lopaResult.meetsTarget } : undefined,
        legalReferences: f.legalReferences.length > 0 ? f.legalReferences : undefined,
      };
    });

    // Gorsel datalarini topla (blob URL -> base64 + annotation overlay)
    const images: ExportImage[] = [];
    for (const result of results) {
      const sourceLine = lineMap.get(result.rowId);
      if (!sourceLine) continue;
      for (const img of sourceLine.images) {
        const imgFindings = result.findings.filter((f) => f.imageId === img.id);
        const meta = imageMetaMap[img.id];
        const dataUrl = await blobUrlToDataUrl(img.previewUrl, imgFindings);
        if (dataUrl) {
          images.push({
            imageId: img.id,
            rowTitle: result.rowTitle,
            dataUrl,
            fileName: img.file.name,
            findingCount: imgFindings.length,
            // Yeni meta alanlar
            imageRelevance: meta?.imageRelevance ?? "relevant",
            imageDescription: meta?.imageDescription ?? "",
            areaSummary: meta?.areaSummary ?? "",
            positiveObservations: meta?.positiveObservations ?? [],
            photoQuality: meta?.photoQuality?.level ?? "good",
          });
        }
      }
    }

    return {
      analysisTitle,
      analysisNote,
      companyName: selectedCompany?.name ?? "",
      companyKind: selectedCompany?.kind ?? "",
      companySector: selectedCompany?.sector ?? "",
      companyHazardClass: selectedCompany?.hazardClass ?? "",
      companyAddress: selectedCompany ? `${selectedCompany.address || ""} ${selectedCompany.city || ""}`.trim() : "",
      companyLogoUrl: selectedCompany?.logo_url ?? "",
      location: selectedLocation,
      department: selectedDepartment,
      method,
      methodLabel: methodLabel(method),
      participants: validParticipants.map((p) => ({
        fullName: p.fullName,
        role: participantRoleCatalog.find((r) => r.code === p.roleCode)?.label ?? p.roleCode,
        title: p.title,
        certificateNo: p.certificateNo,
      })),
      findings,
      images,
      totalFindings: totalDetectionCount,
      criticalCount: criticalHighCount,
      dofCandidateCount,
      date: new Date().toLocaleDateString("tr-TR"),
    };
  }

  /* ── Kaydet ── */
  async function handleSaveAnalysis() {
    if (results.length === 0) return;
    if (!selectedCompanyId) { setSaveMessage("Firma seçilmeden analiz kaydedilemez."); return; }
    setIsSaving(true);
    setSaveMessage("");

    try {
      const input: SaveRiskAnalysisInput = {
        title: analysisTitle,
        analysisNote,
        method,
        companyWorkspaceId: selectedCompanyId || null,
        location: selectedLocation,
        department: selectedDepartment,
        participants: validParticipants.map((p) => ({
          fullName: p.fullName,
          roleCode: p.roleCode,
          title: p.title,
          certificateNo: p.certificateNo,
        })),
        rows: results.map((result) => {
          const sourceLine = lineMap.get(result.rowId);
          // Map each image to its finding IDs
          const imageEntries = (sourceLine?.images ?? []).map((img) => ({
            file: img.file,
            findingIds: result.findings.filter((f) => f.imageId === img.id).map((f) => f.id),
          }));

          return {
            title: result.rowTitle,
            description: sourceLine?.description ?? "",
            images: imageEntries,
            findings: result.findings.map((f) => ({
              id: f.id,
              imageId: f.imageId,
              title: f.title,
              category: f.category,
              severity: f.severity,
              confidence: f.confidence,
              isManual: f.isManual,
              correctiveActionRequired: f.correctiveActionRequired,
              recommendation: f.recommendation,
              action: getActiveScore(f, method).action,
              r2dValues: f.r2dValues,
              r2dResult: f.r2dResult,
              fkValues: f.fkValues,
              fkResult: f.fkResult,
              matrixValues: f.matrixValues,
              matrixResult: f.matrixResult,
              fmeaValues: f.fmeaValues,
              fmeaResult: f.fmeaResult,
              hazopValues: f.hazopValues,
              hazopResult: f.hazopResult,
              bowTieValues: f.bowTieValues,
              bowTieResult: f.bowTieResult,
              ftaValues: f.ftaValues,
              ftaResult: f.ftaResult,
              checklistValues: f.checklistValues,
              checklistResult: f.checklistResult,
              jsaValues: f.jsaValues,
              jsaResult: f.jsaResult,
              lopaValues: f.lopaValues,
              lopaResult: f.lopaResult,
              annotations: f.annotations,
              legalReferences: f.legalReferences,
            })),
          };
        }),
        totalFindings: totalDetectionCount,
        criticalCount: criticalHighCount,
        highestRiskLevel: allFindings.length > 0 ? getActiveRiskClass(allFindings.reduce((worst, f) => {
          const wScore = getActiveScore(worst, method).score;
          const fScore = getActiveScore(f, method).score;
          return fScore > wScore ? f : worst;
        }), method) : "low",
      };

      const assessmentId = await saveRiskAnalysis(input);
      if (assessmentId) {
        setCurrentAssessmentId(assessmentId);
        setSaveMessage("Analiz başarıyla kaydedildi!");
        // Bildirim oluştur
        void createNotification({
          title: "Risk analizi kaydedildi",
          message: `${input.title} — ${input.totalFindings} tespit, ${input.criticalCount} kritik/yüksek`,
          type: "risk_analysis",
          level: input.criticalCount > 0 ? "warning" : "info",
          link: `/companies/${selectedCompanyId}?tab=risk`,
        });
        // Refresh list
        const list = await listRiskAssessments(selectedCompanyId);
        setSavedAnalyses(list);
      } else {
        setSaveMessage("Kayıt sırasında hata oluştu.");
      }
    } catch (err) {
      console.warn("[save] error:", err);
      setSaveMessage("Kayıt sırasında hata oluştu.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  }

  /* ── Kayıtlı analizi sil ── */
  async function handleDeleteAnalysis(assessmentId: string) {
    const ok = await deleteRiskAssessment(assessmentId);
    if (ok) {
      setSavedAnalyses((prev) => prev.filter((a) => a.id !== assessmentId));
      if (currentAssessmentId === assessmentId) setCurrentAssessmentId(null);
    }
  }

  /* ── Reset ── */
  function resetAll() {
    const keepCompanyId = selectedCompanyId; // Firma seçimini koru
    lines.forEach((l) => l.images.forEach((i) => URL.revokeObjectURL(i.previewUrl)));
    setAnalysisTitle("Saha Risk Analizi");
    setAnalysisNote("Her satır bir risk konusu veya uygunsuzluk grubunu temsil eder. Aynı satıra bir veya birden fazla fotoğraf eklenebilir.");
    setMethod("r_skor");
    setSelectedLocation(""); setSelectedDepartment("");
    setParticipants([createParticipant()]);
    setSetupMessage(""); setSetupMessageType("");
    setLines([createLine()]);
    setResults([]); setSelectedImageByRow({}); setSelectedFindingByRow({});
    setPinMode(null); setPendingPin(null);
    setStep(1);
    setCurrentAssessmentId(null);
    setViewMode("list");
    clearPersistedStates("risk:");
    // Firma seçimini geri yükle (clearPersistedStates silmiş olabilir)
    if (keepCompanyId) setSelectedCompanyId(keepCompanyId);
  }

  /** Wizard'a geç (yeni analiz başlat) */
  function startNewAnalysis() {
    lines.forEach((l) => l.images.forEach((i) => URL.revokeObjectURL(i.previewUrl)));
    setAnalysisTitle("Saha Risk Analizi");
    setAnalysisNote("Her satır bir risk konusu veya uygunsuzluk grubunu temsil eder. Aynı satıra bir veya birden fazla fotoğraf eklenebilir.");
    setSelectedLocation(""); setSelectedDepartment("");
    setParticipants([createParticipant()]);
    setSetupMessage(""); setSetupMessageType("");
    setLines([createLine()]);
    setResults([]); setSelectedImageByRow({}); setSelectedFindingByRow({});
    setPinMode(null); setPendingPin(null);
    setCurrentAssessmentId(null);
    setStep(1);
    setViewMode("wizard");
  }

  /** Listeye geri dön */
  function backToList() {
    setViewMode("list");
    // Analizleri yenile
    if (selectedCompanyId) {
      listRiskAssessments(selectedCompanyId).then((list) => setSavedAnalyses(list));
    }
  }

  /* ── Select styles (reusable) ── */
  const selectCls = "h-12 rounded-2xl border border-primary/15 bg-white px-4 text-sm text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors transition-shadow hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)] dark:bg-[var(--navy-mid)] dark:border-border dark:text-white [&_option]:bg-white [&_option]:text-slate-900 dark:[&_option]:bg-[var(--navy-mid)] dark:[&_option]:text-white";

  /* ── Step navigation helpers ── */
  const stepLabels = ["Analiz Bağlamı", "Analiz Ekibi", "Görseller", "Sonuçlar"];

  function canGoNext(): boolean {
    if (step === 1) return !!selectedCompanyId && !!selectedLocation && !!selectedDepartment;
    if (step === 2) return validParticipants.length > 0;
    if (step === 3) return totalImageCount > 0;
    return false;
  }

  function goNext() {
    if (step === 1 && !canGoNext()) { setSetupMessage("Firma, lokasyon ve bölüm seçmelisin."); setSetupMessageType("error"); return; }
    if (step === 2 && !canGoNext()) { setSetupMessage("En az bir görevli adı ve rolü girilmelidir."); setSetupMessageType("error"); return; }
    if (step === 3 && !canGoNext()) { setSetupMessage("En az bir görsel eklemelisin."); setSetupMessageType("error"); return; }
    setSetupMessage(""); setSetupMessageType("");
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
  }

  function goBack() {
    setSetupMessage(""); setSetupMessageType("");
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  }

  /* ================================================================ */
  /* RENDER                                                            */
  /* ================================================================ */

  /* ── Tarih formatı helper ── */
  function fmtDate(d: string) {
    try { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }); } catch { return d; }
  }
  function methodBadge(m: string) {
    return methodLabel(m as AnalysisMethod);
  }
  function riskBadgeColor(level: string | null) {
    if (!level) return "bg-muted text-muted-foreground";
    if (level === "critical") return "bg-red-900/80 text-red-200";
    if (level === "high") return "bg-red-600/80 text-white";
    if (level === "medium" || level === "significant") return "bg-orange-500/80 text-white";
    if (level === "low") return "bg-amber-500/80 text-white";
    return "bg-green-600/80 text-white";
  }

  /* ════════════════════════════════════════════════════════════════ */
  /* LIST MODE — Firma seçimi + analiz geçmişi                      */
  /* ════════════════════════════════════════════════════════════════ */
  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Risk Analizi"
          title="Risk Analizi Yönetimi"
          description="Firma seçin, geçmiş analizleri görüntüleyin veya yeni analiz başlatın."
        />

        {/* ── Firma Seçimi ── */}
        <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-foreground">Firma / Kurum Seçin</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className={selectCls + " w-full"}
              >
                <option value="">— Firma seçin —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="accent"
              disabled={!selectedCompanyId}
              onClick={startNewAnalysis}
              className="h-12 rounded-xl px-8 text-base font-bold shadow-lg"
            >
              + Yeni Analiz Başlat
            </Button>
          </div>
        </div>

        {/* ── Analiz Geçmişi ── */}
        {selectedCompanyId && (
          <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedCompany?.name ?? "Firma"} — Risk Analizi Geçmişi
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {savedAnalyses.length} kayıtlı analiz
                </p>
              </div>
            </div>

            {loadingAnalyses ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : savedAnalyses.length === 0 ? (
              <EmptyState
                title="Henüz analiz kaydı yok"
                description="Bu firma için ilk risk analizinizi başlatmak için yukarıdaki butonu kullanın."
              />
            ) : (
              <div className="space-y-3">
                {savedAnalyses.map((a) => (
                  <div key={a.id} className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{a.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${riskBadgeColor(a.overallRiskLevel)}`}>
                            {a.overallRiskLevel ? a.overallRiskLevel.toUpperCase() : "—"}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {methodBadge(a.method)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            a.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : a.status === "archived" ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {a.status === "completed" ? "Tamamlandı" : a.status === "archived" ? "Arşivlendi" : "Taslak"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{fmtDate(a.assessmentDate)}</span>
                          <span>{a.itemCount} tespit</span>
                          {a.locationText && <span>{a.locationText}</span>}
                          {a.departmentName && <span>{a.departmentName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {deleteConfirmId === a.id ? (
                          <div className="flex items-center gap-1 rounded-xl border border-red-400 bg-red-50 px-2 py-1 dark:border-red-600 dark:bg-red-950">
                            <span className="text-xs text-red-600 dark:text-red-400 mr-1">Emin misin?</span>
                            <Button type="button" variant="ghost" className="h-6 px-2 text-xs text-red-600 hover:bg-red-100 dark:text-red-400" onClick={() => { handleDeleteAnalysis(a.id); setDeleteConfirmId(null); }}>Evet</Button>
                            <Button type="button" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDeleteConfirmId(null)}>Hayır</Button>
                          </div>
                        ) : (
                          <>
                            <Button type="button" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteConfirmId(a.id)}>Sil</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════ */
  /* WIZARD MODE — Analiz oluşturma / düzenleme                     */
  /* ════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Risk Analizi"
        title="Görsel Tabanlı Risk Analizi"
        description="Firma seç, ekip tanımla, görseller yükle, AI + manuel tespit ve 3 yöntemli skorlama ile analiz oluştur."
        meta={
          <>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">{methodLabel(method)}</span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">AI + Manuel Tespit</span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">PDF / Word / Excel</span>
          </>
        }
        actions={
          <div className="flex gap-2.5">
            <Button type="button" variant="outline" onClick={backToList} className="h-10 rounded-xl px-5 text-sm font-semibold">Listeye Dön</Button>
            <Button type="button" variant="accent" onClick={resetAll} className="h-10 rounded-xl px-5 text-sm font-bold shadow-md">Yeni Analiz</Button>
          </div>
        }
      />

      {/* ═══════════════ STEP INDICATOR ═══════════════ */}
      <div className="surface-card rounded-[1.75rem] border border-border p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          {stepLabels.map((label, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3 | 4;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { if (isDone || isActive) setStep(stepNum); }}
                className={`flex flex-1 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : isDone
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? "bg-white/20 text-white" : isDone ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}>
                  {isDone ? "✓" : stepNum}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ STEP 1: ANALİZ BAĞLAMI ═══════════════ */}
      {step === 1 && (
        <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Analiz Bağlamı</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Bu risk analizinin hangi firma, lokasyon ve bölüm için yapıldığını seç.</p>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Firma / Kurum <span className="text-red-500">*</span></label>
              <select value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedLocation(""); setSelectedDepartment(""); setSetupMessage(""); setSetupMessageType(""); }} className={selectCls + (!selectedCompanyId ? " !border-amber-400/60 !shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" : "")}>
                <option value="">Firma / kurum seç</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!selectedCompanyId && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Analiz için firma seçimi zorunludur</p>}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-foreground">Analiz Yöntemi <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {METHOD_CATALOG.map((m) => {
                  const selected = method === m.id;
                  return (
                    <div key={m.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setMethod(m.id as AnalysisMethod)}
                        className={`relative flex w-full flex-col items-center overflow-hidden rounded-2xl border-2 px-3 py-5 text-center transition-all duration-300 ${
                          selected
                            ? "shadow-xl scale-[1.04]"
                            : "border-border bg-card hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5"
                        }`}
                        style={selected ? {
                          borderColor: m.color,
                          boxShadow: `0 8px 32px ${m.color}30, 0 0 0 1px ${m.color}50`,
                          background: `linear-gradient(135deg, ${m.color}08 0%, ${m.color}03 100%)`,
                        } : undefined}
                      >
                        {/* Ust renkli serit */}
                        <div className="absolute top-0 left-0 right-0 h-1 transition-all duration-300" style={{ backgroundColor: selected ? m.color : "transparent" }} />

                        {/* Buyuk ikon dairesi */}
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
                            selected ? "shadow-md" : "bg-muted/60"
                          }`}
                          style={selected ? { backgroundColor: `${m.color}18`, boxShadow: `0 4px 12px ${m.color}20` } : undefined}
                        >
                          <MethodIcon method={m.id} color={selected ? m.color : "#94a3b8"} size={34} />
                        </div>

                        {/* Baslik */}
                        <p className={`mt-3 text-base font-extrabold leading-tight tracking-tight transition-colors ${selected ? "" : "text-foreground/75"}`} style={selected ? { color: m.color } : undefined}>
                          {m.shortName}
                        </p>

                        {/* Yontem adi */}
                        <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-1">{m.name}</p>

                        {/* Secili gosterge noktasi */}
                        {selected && (
                          <div className="mt-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                        )}
                      </button>

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-72 -translate-x-1/2 rounded-2xl border border-border bg-card p-4 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.color}15` }}>
                            <MethodIcon method={m.id} color={m.color} size={18} />
                          </div>
                          <span className="font-bold text-sm text-foreground">{m.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{m.tooltip}</p>
                        <div className="mt-2.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="rounded-md bg-muted px-2 py-0.5 font-medium">Skor: {m.scoreRange}</span>
                          {m.paramCount > 0 && <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{m.paramCount} parametre</span>}
                        </div>
                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-border" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Lokasyon / Çalışma Alanı <span className="text-red-500">*</span></label>
                <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className={selectCls + (selectedCompanyId && !selectedLocation ? " !border-amber-400/60 !shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" : "")}>
                  <option value="">Lokasyon seç</option>
                  {(selectedCompany?.locations ?? []).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                {selectedCompanyId && !selectedLocation && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Lokasyon seçimi zorunludur</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Bölüm / Birim <span className="text-red-500">*</span></label>
                <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className={selectCls + (selectedCompanyId && !selectedDepartment ? " !border-amber-400/60 !shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" : "")}>
                  <option value="">Bölüm seç</option>
                  {(selectedCompany?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {selectedCompanyId && !selectedDepartment && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Bölüm seçimi zorunludur</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <Input label="Analiz Başlığı" value={analysisTitle} onChange={(e) => setAnalysisTitle(e.target.value)} />
            <Textarea label="Analiz Notu" rows={3} value={analysisNote} onChange={(e) => setAnalysisNote(e.target.value)} />
          </div>

          {selectedCompany && (
            <div className="mt-5 rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">{selectedCompany.name}</p>
              <p className="text-xs text-muted-foreground">Tür: {selectedCompany.kind || "-"} · Adres: {selectedCompany.address || "-"}</p>
            </div>
          )}

          <div className="mt-4"><Link href="/companies"><Button type="button" variant="outline" className="h-10 rounded-xl px-5 text-sm font-semibold">Firma Yapısını Düzenle</Button></Link></div>

          {setupMessage && <StatusAlert tone={setupMessageType === "success" ? "success" : "danger"} className="mt-5">{setupMessage}</StatusAlert>}
        </div>
      )}

      {/* ═══════════════ STEP 2: ANALİZ EKİBİ ═══════════════ */}
      {step === 2 && (
        <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Risk Analizinde Görev Alanlar</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">Kayıtlı personelden seçebilir veya manuel ekleyebilirsin.</p>
            </div>
            <Button type="button" variant="outline" onClick={addParticipant} className="h-10 rounded-xl px-5 text-sm font-semibold">Manuel Görevli Ekle</Button>
          </div>

          {/* Firma ekip uyelerinden hizli secim */}
          {teamMembers.length > 0 && (
            <div className="mb-5 rounded-[1.25rem] border border-border bg-card p-4">
              <p className="eyebrow mb-3">Firma Ekibinden Seç</p>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((tm) => {
                  const alreadyAdded = participants.some((p) => p.fullName === tm.full_name);
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => {
                        const emptyIdx = participants.findIndex((p) => !p.fullName.trim());
                        // Kategori adından otomatik rol eşle
                        const autoRole = guessRoleFromCategory(tm.category_name);
                        const patch = { fullName: tm.full_name, title: tm.title || "", certificateNo: tm.cert_number || "", roleCode: autoRole };
                        if (emptyIdx >= 0) {
                          setParticipants((prev) => prev.map((p, i) => i === emptyIdx ? { ...p, ...patch } : p));
                        } else {
                          const newP = createParticipant();
                          setParticipants((prev) => [...prev, { ...newP, ...patch }]);
                        }
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        alreadyAdded
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "border-border bg-card text-foreground hover:border-[var(--accent)] hover:bg-amber-50 dark:hover:bg-amber-950"
                      }`}
                    >
                      {alreadyAdded ? "✓ " : ""}{tm.full_name}
                      {tm.category_name && <span className="ml-1 text-xs text-muted-foreground">({tm.category_name})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {teamMembers.length === 0 && selectedCompanyId && (
            <div className="mb-5 rounded-[1.25rem] border border-dashed border-amber-400/40 bg-amber-50/10 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                <div>
                  <p className="text-sm font-semibold text-foreground">Risk Değerlendirme Ekibi Tanımlı Değil</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bu firma için henüz ekip üyesi tanımlanmamış. Firma sayfasında <strong>Ekip</strong> sekmesinden
                    &quot;Risk Değerlendirme Ekibi&quot; oluşturup üyelerinizi ekleyin — burada otomatik listelenecek.
                  </p>
                  <Link
                    href={`/companies/${selectedCompanyId}?tab=people`}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                    Firma Ekip Yönetimine Git
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {participants.map((p, i) => (
              <div key={p.id} className="rounded-[1.25rem] border border-border bg-card p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="eyebrow">Görevli {i + 1}</p>
                  {participants.length > 1 && <Button type="button" variant="ghost" onClick={() => removeParticipant(p.id)}>Sil</Button>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Ad Soyad" value={p.fullName} onChange={(e) => updateParticipant(p.id, "fullName", e.target.value)} />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Rol / Ünvan Türü</label>
                    <select value={p.roleCode} onChange={(e) => updateParticipant(p.id, "roleCode", e.target.value)} className={selectCls}>
                      <option value="">Rol seç</option>
                      {participantRoleCatalog.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                  </div>
                  <Input label="Görev / Unvan Açıklaması" value={p.title} onChange={(e) => updateParticipant(p.id, "title", e.target.value)} placeholder="Örn. A sınıfı uzman" />
                  <Input label="Belge / Sertifika No (varsa)" value={p.certificateNo} onChange={(e) => updateParticipant(p.id, "certificateNo", e.target.value)} placeholder="Varsa gir" />
                </div>
              </div>
            ))}
          </div>

          {setupMessage && <StatusAlert tone={setupMessageType === "success" ? "success" : "danger"} className="mt-5">{setupMessage}</StatusAlert>}
        </div>
      )}

      {/* ═══════════════ STEP 3: GÖRSELLER ═══════════════ */}
      {step === 3 && (
        <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Risk Satırları ve Görseller</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Her satır bir risk konusunu temsil eder. Görselleri yükle, sonra AI analizi başlat.</p>
          </div>

          {/* Ozet bandi */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Firma</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedCompany?.shortName || selectedCompany?.name || "-"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Lokasyon</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedLocation || "-"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Yöntem</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{methodLabel(method)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Görseller</p>
              <p className="mt-1 text-lg font-bold text-foreground">{totalImageCount}</p>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input ref={bulkFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { bulkUploadToSeparateLines(e.target.files); e.target.value = ""; }} />

          {/* AI Analiz + Satir/Toplu Yukle — full-width bar */}
          <div className="space-y-2">
            {/* AI Analiz Baslat — full width */}
            <button
              type="button"
              disabled={totalImageCount === 0 || isAnalyzing}
              onClick={() => { handleAnalyze(); setStep(4); }}
              className="group relative w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 px-6 py-4 text-left shadow-[0_8px_30px_rgba(245,158,11,0.25)] transition-all hover:shadow-[0_12px_40px_rgba(245,158,11,0.35)] hover:brightness-105 disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{isAnalyzing ? "AI Analiz Yapiliyor..." : "AI ile Risk Analizini Baslat"}</p>
                    <p className="mt-0.5 text-xs text-white/70">Nova AI her gorseli ayri ayri analiz eder</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {totalImageCount > 0 && (
                    <div className="flex items-center gap-3 text-white/90">
                      <div className="text-center">
                        <p className="text-lg font-bold">{totalImageCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/60">Gorsel</p>
                      </div>
                      <div className="h-8 w-px bg-white/20" />
                      <div className="text-center">
                        <p className="text-lg font-bold">{lines.length}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/60">Satir</p>
                      </div>
                    </div>
                  )}
                  <svg className="h-5 w-5 text-white/80 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </div>
            </button>

            {/* Yeni Satir + Toplu Yukle — yan yana full width, belirgin */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={addLine}
                className="group flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-all hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(184,134,11,0.12)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </div>
                Yeni Satir Ekle
              </button>
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="group flex items-center justify-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/50 px-4 py-4 text-sm font-semibold text-emerald-700 shadow-[var(--shadow-soft)] transition-all hover:border-emerald-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.15)] dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                Toplu Yukle (Her Biri Ayri Satir)
              </button>
            </div>
          </div>

          {setupMessage && <StatusAlert tone={setupMessageType === "success" ? "success" : "danger"}>{setupMessage}</StatusAlert>}

          <div className="space-y-5">
            {lines.map((line, idx) => (
              <div key={line.id} className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Satır {idx + 1}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Genel ve yakın açıları bu satır altında toplayın.</p>
                  </div>
                  {lines.length > 1 && <Button type="button" variant="ghost" onClick={() => removeLine(line.id)} className="rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">Satırı Sil</Button>}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="Satır Başlığı" value={line.title} onChange={(e) => updateLine(line.id, "title", e.target.value)} placeholder="Örn. İstifleme alanı" />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Açıklama</label>
                    <input type="text" value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Risk grubunu kısaca açıkla" className="h-12 rounded-2xl border border-border bg-card px-4 text-sm text-foreground" />
                  </div>
                </div>

                <input ref={(n) => { fileInputRefs.current[line.id] = n; }} type="file" accept="image/*" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => appendFiles(line.id, e.target.files)} />

                {/* Gorsel ekleme butonu */}
                <div className="mt-4">
                  <Button type="button" onClick={() => fileInputRefs.current[line.id]?.click()} className="h-10 rounded-xl px-5 text-sm font-semibold shadow-sm">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Görsel Ekle
                  </Button>
                </div>

                {line.images.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {line.images.map((img) => (
                      <div key={img.id} className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.previewUrl} alt={img.file.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between p-2">
                          <p className="truncate text-xs text-muted-foreground">{img.file.name}</p>
                          <Button type="button" variant="ghost" onClick={() => removeImage(line.id, img.id)} className="h-6 px-2 text-xs">Sil</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Alt aksiyonlar kaldirildi — uste tasindi */}
        </div>
      )}

      {/* ═══════════════ STEP 4: SONUÇLAR ═══════════════ */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Ozet bandi */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Toplam Tespit</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalDetectionCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Kritik / Yüksek</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{criticalHighCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">DÖF Adayı</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{dofCandidateCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Ort. Skor</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {totalDetectionCount === 0 ? "-" : method === "r_skor" ? (avgScore * 100).toFixed(0) : Math.round(avgScore)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="eyebrow">Rapor</p>
              <div className="mt-1 flex justify-center gap-1">
                <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" onClick={() => buildExportData().then(exportRiskAnalysisPDF)} disabled={results.length === 0}>PDF</Button>
                <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20" onClick={() => buildExportData().then(exportRiskAnalysisWord)} disabled={results.length === 0}>Word</Button>
                <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20" onClick={() => buildExportData().then(exportRiskAnalysisExcel)} disabled={results.length === 0}>Excel</Button>
              </div>
            </div>
          </div>

          {/* Kayit mesaji */}
          {saveMessage && (
            <StatusAlert tone={saveMessage.includes("başarı") ? "success" : "danger"} className="mt-2">{saveMessage}</StatusAlert>
          )}

          {/* Sonuc alani */}
          <div className="surface-card rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Anotasyonlu Tespit Sonuçları</h2>
                <p className="mt-1 text-sm text-muted-foreground">Risk kartı ile görsel üstündeki anotasyonlar bağlı çalışır. Parametreleri ayarlayarak skoru değiştir.</p>
              </div>
              {isAnalyzing && <span className="text-xs text-muted-foreground">Analiz yapılıyor...</span>}
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-16">
                {/* Animated hourglass / spinner */}
                <div className="relative mb-6">
                  <svg className="h-20 w-20 animate-spin text-[var(--accent)]" viewBox="0 0 50 50" fill="none">
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="3" strokeDasharray="80 45" strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                    %{analysisProgress}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>

                <p className="text-sm font-medium text-foreground">{analysisMessage}</p>
                <p className="mt-2 text-xs text-muted-foreground">Nova AI her görseli ayrı ayrı analiz ediyor...</p>
              </div>
            ) : results.length === 0 ? (
              <EmptyState title="Henüz sonuç üretilmedi" description="3. adımda görselleri yükleyip analizi başlat." />
            ) : (
              <div className="space-y-6">

                {/* ── Tespit silme onay dialog ── */}
                {pendingDeleteFinding && (
              <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 dark:border-red-600 dark:bg-red-950">
                <p className="text-sm font-semibold text-foreground">Tespiti Sil</p>
                <p className="mt-1 text-sm text-muted-foreground">&quot;{pendingDeleteFinding.title}&quot; tespitini silmek istediğinize emin misiniz?</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="accent" className="!bg-red-600 hover:!bg-red-700" onClick={() => deleteFinding(pendingDeleteFinding.rowId, pendingDeleteFinding.findingId)}>Sil</Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingDeleteFinding(null)}>İptal</Button>
                </div>
              </div>
            )}

            {results.map((result, ri) => {
              const sourceLine = lineMap.get(result.rowId);
              const images = sourceLine?.images ?? [];
              const selectedImageId = selectedImageByRow[result.rowId] ?? images[0]?.id ?? "";
              const selectedFindingId = selectedFindingByRow[result.rowId] ?? result.findings[0]?.id ?? "";
              const selectedImage = images.find((i) => i.id === selectedImageId) ?? images[0];
              const visibleFindings = result.findings.filter((f) => f.imageId === selectedImage?.id);
              const selectedFinding = result.findings.find((f) => f.id === selectedFindingId);

              return (
                <div key={result.rowId} className="rounded-[1.5rem] border border-border bg-card p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="eyebrow">Satır {ri + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{result.rowTitle}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Görsel: {result.imageCount} · Tespit: {result.findings.length}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={pinMode === result.rowId ? "accent" : "outline"}
                        onClick={() => setPinMode(pinMode === result.rowId ? null : result.rowId)}
                        className="h-10 rounded-xl px-5 text-sm font-semibold shadow-sm"
                      >
                        {pinMode === result.rowId ? "Pin Modu Aktif..." : "Risk İşareti Ekle"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    {/* ── Left: image + thumbnails ── */}
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {images.map((img, ii) => {
                          const imgFindings = result.findings.filter((f) => f.imageId === img.id);
                          const active = selectedImage?.id === img.id;
                          return (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => {
                                setSelectedImageByRow((prev) => ({ ...prev, [result.rowId]: img.id }));
                                if (imgFindings[0]) setSelectedFindingByRow((prev) => ({ ...prev, [result.rowId]: imgFindings[0].id }));
                              }}
                              className={`overflow-hidden rounded-2xl border text-left transition-colors ${active ? "border-primary shadow-[var(--shadow-soft)]" : "border-border hover:border-primary/40"}`}
                            >
                              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.previewUrl} alt={img.file.name} className="h-full w-full object-cover" />
                              </div>
                              <div className="p-3">
                                <p className="eyebrow">Görsel {ii + 1}</p>
                                <p className="mt-1 truncate text-sm font-medium text-foreground">{img.file.name}</p>
                                {noRiskImages.has(img.id) ? (
                                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">Temiz — risk tespit edilmedi</p>
                                ) : (
                                  <p className="mt-1 text-xs text-muted-foreground">Risk: {imgFindings.length}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedImage && (
                        <div className={`overflow-hidden rounded-[1.5rem] border bg-card shadow-[0_18px_40px_rgba(15,23,42,0.10)] ${pinMode === result.rowId ? "cursor-crosshair border-amber-400 ring-2 ring-amber-300/50" : "border-border"}`}>
                          <div
                            className="relative aspect-[4/3]"
                            onClick={(e) => handleImageClick(e, result.rowId, selectedImage.id)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedImage.previewUrl} alt={selectedImage.file.name} className="h-full w-full object-cover pointer-events-none" />
                            <div className={`absolute inset-0 ${pinMode === result.rowId ? "pointer-events-none" : ""}`}>
                              {visibleFindings.map((f) =>
                                f.annotations.map((a) =>
                                  renderAnnotation(a, selectedFindingId === f.id, () => setSelectedFindingByRow((prev) => ({ ...prev, [result.rowId]: f.id })))
                                )
                              )}
                            </div>
                            {/* KVKK: Yüz bulanıklaştırma */}
                            {imageMetaMap[selectedImage.id]?.faces.map((face, fi) => (
                              <div
                                key={`face-${fi}`}
                                className="absolute pointer-events-none rounded-full"
                                style={{
                                  left: `${face.faceX}%`, top: `${face.faceY}%`,
                                  width: `${face.faceW}%`, height: `${face.faceH}%`,
                                  backdropFilter: "blur(16px)",
                                  WebkitBackdropFilter: "blur(16px)",
                                  background: "rgba(0,0,0,0.08)",
                                }}
                              />
                            ))}
                            {pinMode === result.rowId && (
                              <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-white">
                                Görsele tıklayarak risk işareti ekle
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Pending pin dialog — görselin hemen altında ── */}
                      {pendingPin && pendingPin.rowId === result.rowId && (
                        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
                          <p className="text-sm font-semibold text-foreground">Manuel Risk İşareti Ekle</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <Input label="Tespit Başlığı" value={pendingPinTitle} onChange={(e) => setPendingPinTitle(e.target.value)} placeholder="Örn. Korkuluk eksik" autoFocus />
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-foreground">Ciddiyet</label>
                              <select value={pendingPinSeverity} onChange={(e) => setPendingPinSeverity(e.target.value as DetectionSeverity)} className={selectCls}>
                                <option value="low">Düşük</option>
                                <option value="medium">Orta</option>
                                <option value="high">Yüksek</option>
                                <option value="critical">Kritik</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <Button type="button" variant="accent" onClick={confirmManualPin} disabled={!pendingPinTitle.trim()}>Ekle</Button>
                              <Button type="button" variant="ghost" onClick={() => setPendingPin(null)}>İptal</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right: findings + score panel ── */}
                    <div className="space-y-3">
                      {/* Alan özeti + olumlu tespitler + foto kalitesi */}
                      {selectedImage && imageMetaMap[selectedImage.id] && (() => {
                        const m = imageMetaMap[selectedImage.id];
                        return (
                          <div className="space-y-2">
                            {/* Uygunsuz görsel uyarısı */}
                            {m.imageRelevance !== "relevant" && (
                              <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
                                <span className="text-2xl">{m.imageRelevance === "not_real_photo" ? "🖼️" : "🚫"}</span>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {m.imageRelevance === "not_real_photo" ? "Gerçek Fotoğraf Değil" : "Risk Analizi Yapılamadı"}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {m.imageRelevance === "not_real_photo"
                                      ? "Bu görsel bir çizim, illüstrasyon veya dijital üretim. Risk analizi yalnızca gerçek saha fotoğrafları üzerinde yapılabilir."
                                      : "Bu görsel risk analizi için uygun değil."}
                                    {m.imageDescription ? ` Tespit: ${m.imageDescription}` : ""}
                                  </p>
                                </div>
                              </div>
                            )}
                            {/* Risksiz görsel — olumlu durum */}
                            {selectedImage && noRiskImages.has(selectedImage.id) && m.imageRelevance === "relevant" && (
                              <div className="flex items-start gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950">
                                <span className="text-2xl">✅</span>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Risk Tespit Edilmedi</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    AI analizi bu görselde anlamlı bir risk veya uygunsuzluk tespit edemedi.
                                    {m.positiveObservations.length > 0 && " Olumlu gözlemler aşağıda listelenmiştir."}
                                    {" "}Manuel pin ekleyerek kendi tespitinizi oluşturabilirsiniz.
                                  </p>
                                </div>
                              </div>
                            )}
                            {/* Foto kalitesi uyarısı */}
                            {m.imageRelevance === "relevant" && m.photoQuality.level !== "good" && (
                              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${m.photoQuality.level === "poor" ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                                <span className="text-sm">{m.photoQuality.level === "poor" ? "⚠️" : "📷"}</span>
                                <span>Görsel kalitesi: {m.photoQuality.level === "poor" ? "Düşük" : "Orta"}{m.photoQuality.note ? ` — ${m.photoQuality.note}` : ""}</span>
                              </div>
                            )}
                            {/* Alan özeti */}
                            {m.areaSummary && (
                              <div className="rounded-xl border border-border bg-card px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Alan Değerlendirmesi</p>
                                <p className="text-xs text-foreground leading-relaxed">{m.areaSummary}</p>
                                {m.personCount > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{m.personCount} kişi tespit edildi</p>}
                              </div>
                            )}
                            {/* Olumlu tespitler */}
                            {m.positiveObservations.length > 0 && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">Olumlu Tespitler</p>
                                {m.positiveObservations.map((obs, oi) => (
                                  <div key={oi} className="flex items-start gap-1.5 text-xs text-emerald-800 dark:text-emerald-200">
                                    <span className="mt-0.5 flex-shrink-0">✓</span>
                                    <span>{obs}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {visibleFindings.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950">
                          <div className="flex items-start gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Bu görselde belirgin risk tespit edilmedi</p>
                              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">AI analizi sonucunda somut risk unsuru bulunamamıştır. Manuel risk ekleyebilirsiniz.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        visibleFindings.map((finding, fi) => {
                          const active = selectedFindingId === finding.id;
                          const sc = getActiveScore(finding, method);

                          return (
                            <button
                              key={finding.id}
                              type="button"
                              onClick={() => {
                                setSelectedFindingByRow((prev) => ({ ...prev, [result.rowId]: finding.id }));
                                setSelectedImageByRow((prev) => ({ ...prev, [result.rowId]: finding.imageId }));
                              }}
                              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                active
                                  ? "border-[var(--accent)]/30 bg-card shadow-[0_0_0_1px_var(--accent-light),0_18px_36px_rgba(15,23,42,0.12)]"
                                  : "border-border bg-muted/50 hover:border-primary/40 hover:bg-card"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="eyebrow">Risk {fi + 1}</p>
                                    {finding.isManual && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">Sonradan Eklendi</span>}
                                    {!finding.isManual && finding.confidenceTier === "high" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Kesin Tespit</span>}
                                    {!finding.isManual && finding.confidenceTier === "medium" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">AI Tespiti</span>}
                                    {!finding.isManual && finding.confidenceTier === "low" && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Dogrulama Onerilir</span>}
                                  </div>
                                  <h4 className="mt-1 text-base font-semibold text-foreground">{finding.title}</h4>
                                  <p className="mt-1 text-sm text-muted-foreground">{finding.category}</p>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-2">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: sc.color }}>
                                    {method === "r_skor" ? (sc.score * 100).toFixed(0) : Math.round(sc.score)}
                                  </div>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setPendingDeleteFinding({ rowId: result.rowId, findingId: finding.id, title: finding.title }); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setPendingDeleteFinding({ rowId: result.rowId, findingId: finding.id, title: finding.title }); } }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                    title="Tespiti sil"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </div>
                                </div>
                              </div>

                              {finding.correctiveActionRequired && (
                                <div className="mt-2 inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                                  DÖF Adayı
                                </div>
                              )}

                              {finding.recommendation && (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{finding.recommendation}</p>
                              )}

                              {finding.legalReferences.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {finding.legalReferences.map((ref, ri) => (
                                    <div key={ri} className="flex items-start gap-1.5 text-[10px]">
                                      <span className="mt-0.5 flex-shrink-0 text-amber-500">§</span>
                                      <span className="text-muted-foreground">
                                        <span className="font-semibold text-foreground">{ref.law}</span>
                                        {ref.article && <span> · {ref.article}</span>}
                                        {ref.description && <span> — {ref.description}</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}

                      {/* ── Skorlama Paneli ── */}
                      {selectedFinding && (
                        <div className="mt-4 rounded-xl border border-border bg-background p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Skor Detayı — {METHOD_CATALOG.find(m => m.id === method)?.name ?? method}
                          </p>
                          {method === "r_skor" && <R2DPanel finding={selectedFinding} onUpdate={(f) => updateFinding(result.rowId, f)} />}
                          {method === "fine_kinney" && <FKPanel finding={selectedFinding} onUpdate={(f) => updateFinding(result.rowId, f)} />}
                          {method === "l_matrix" && <MatrixPanel finding={selectedFinding} onUpdate={(f) => updateFinding(result.rowId, f)} />}
                          {method === "fmea" && <FMEAPanel fmeaValues={selectedFinding.fmeaValues} fmeaResult={selectedFinding.fmeaResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, fmeaValues: v }))} />}
                          {method === "hazop" && <HAZOPPanel hazopValues={selectedFinding.hazopValues} hazopResult={selectedFinding.hazopResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, hazopValues: v }))} />}
                          {method === "bow_tie" && <BowTiePanel bowTieValues={selectedFinding.bowTieValues} bowTieResult={selectedFinding.bowTieResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, bowTieValues: v }))} />}
                          {method === "fta" && <FTAPanel ftaValues={selectedFinding.ftaValues} ftaResult={selectedFinding.ftaResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, ftaValues: v }))} />}
                          {method === "checklist" && <ChecklistPanel checklistValues={selectedFinding.checklistValues} checklistResult={selectedFinding.checklistResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, checklistValues: v }))} />}
                          {method === "jsa" && <JSAPanel jsaValues={selectedFinding.jsaValues} jsaResult={selectedFinding.jsaResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, jsaValues: v }))} />}
                          {method === "lopa" && <LOPAPanel lopaValues={selectedFinding.lopaValues} lopaResult={selectedFinding.lopaResult} onValuesChange={(v) => updateFinding(result.rowId, computeAllScores({ ...selectedFinding, lopaValues: v }))} />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        </div>
      )}

      {/* ═══════════════ STICKY BOTTOM BAR — nav + AI analiz ═══════════════ */}
      <div className="sticky bottom-0 z-40 -mx-4 mt-6 border-t border-border/60 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-[#0A0E18]/95 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {/* Kaydetme uyarısı — sonuçlar var ama henüz kaydedilmemiş */}
        {step === 4 && results.length > 0 && !currentAssessmentId && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-2.5 dark:border-amber-600/30 dark:bg-amber-950/30">
            <svg className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Analiz sonuçlarınız henüz kaydedilmedi! Kaydetmezseniz tüm tespitler kaybolacaktır.</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={goBack} className="h-10 rounded-xl px-5 text-sm font-semibold">Geri</Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* AI Analiz butonu — step 3'te her zaman görünür */}
            {step === 3 && totalImageCount > 0 && (
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => { handleAnalyze(); setStep(4); }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 px-5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-105 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
                {isAnalyzing ? "Analiz Yapılıyor..." : "AI Analiz Başlat"}
              </button>
            )}
            {step < 4 && !(step === 3 && totalImageCount > 0) && (
              <Button type="button" variant="accent" onClick={goNext} className="h-10 rounded-xl px-6 text-sm font-bold shadow-md">
                {step === 3 ? "Sonuçlara Git" : "İleri"}
              </Button>
            )}
            {step === 4 && (
              <>
                <Button type="button" variant="accent" onClick={handleSaveAnalysis} disabled={isSaving || results.length === 0} className="h-10 rounded-xl px-6 text-sm font-bold shadow-md">
                  {isSaving ? "Kaydediliyor..." : currentAssessmentId ? "Güncelle" : "Kaydet"}
                </Button>
                <Button type="button" variant="outline" onClick={backToList} className="h-10 rounded-xl px-5 text-sm font-semibold">Listeye Dön</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
