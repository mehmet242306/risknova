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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
  getMatrixGrid,
  R2D_PARAMS,
  FK_LIKELIHOOD,
  FK_SEVERITY,
  FK_EXPOSURE,
  MATRIX_LIKELIHOOD_LABELS,
  MATRIX_SEVERITY_LABELS,
  type R2DValues,
  type R2DResult,
  type FKValues,
  type FKResult,
  type MatrixValues,
  type MatrixResult,
} from "@/lib/risk-scoring";
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

type AnalysisMethod = "r_skor" | "fine_kinney" | "l_matrix";
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
  /** Scoring */
  r2dValues: R2DValues;
  r2dResult: R2DResult | null;
  fkValues: FKValues;
  fkResult: FKResult | null;
  matrixValues: MatrixValues;
  matrixResult: MatrixResult | null;
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
  switch (method) {
    case "r_skor": return "R-SKOR 2D";
    case "fine_kinney": return "Fine-Kinney";
    case "l_matrix": return "L-Tipi Matris";
    default: return method;
  }
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

function severityBadge(severity: DetectionSeverity) {
  switch (severity) {
    case "low": return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "medium": return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "high": return "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "critical": return "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
    default: return "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  }
}

function getActiveScore(finding: VisualFinding, method: AnalysisMethod): { score: number; label: string; color: string; action: string } {
  if (method === "r_skor" && finding.r2dResult) {
    return { score: finding.r2dResult.score, label: finding.r2dResult.label, color: finding.r2dResult.color, action: finding.r2dResult.action };
  }
  if (method === "fine_kinney" && finding.fkResult) {
    return { score: finding.fkResult.score, label: finding.fkResult.label, color: finding.fkResult.color, action: finding.fkResult.action };
  }
  if (method === "l_matrix" && finding.matrixResult) {
    return { score: finding.matrixResult.score, label: finding.matrixResult.label, color: finding.matrixResult.color, action: finding.matrixResult.action };
  }
  return { score: 0, label: "-", color: "#64748B", action: "-" };
}

function getActiveRiskClass(finding: VisualFinding, method: AnalysisMethod): string {
  if (method === "r_skor" && finding.r2dResult) return finding.r2dResult.riskClass;
  if (method === "fine_kinney" && finding.fkResult) return finding.fkResult.riskClass;
  if (method === "l_matrix" && finding.matrixResult) return finding.matrixResult.riskClass;
  return "follow_up";
}

function computeAllScores(finding: VisualFinding): VisualFinding {
  return {
    ...finding,
    r2dResult: calculateR2D(finding.r2dValues),
    fkResult: calculateFK(finding.fkValues),
    matrixResult: calculateMatrix(finding.matrixValues),
  };
}

/* ================================================================== */
/* Mock findings generator (AI simulation)                             */
/* ================================================================== */

type MockPattern = Omit<VisualFinding, "id" | "imageId" | "r2dResult" | "fkResult" | "matrixResult">;

const mockPatterns: MockPattern[] = [
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
    annotations: [
      { id: crypto.randomUUID(), kind: "pin", label: "R11", x: 50, y: 10 },
    ],
  },
];

/** Her gorselde 4-6 arasi tespit uretir (ISG uzmani hassasiyetinde) */
function getMockFindings(imageId: string, imageIndex: number, lineIndex: number): VisualFinding[] {
  const seed = lineIndex * 7 + imageIndex * 3;
  // Her gorsel icin 4-6 tespit sec (gercekci ISG uzmani gibi)
  const count = 4 + (seed % 3); // 4, 5 veya 6
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push((seed + i * 3 + i) % mockPatterns.length);
  }
  // Tekrarlari kaldir
  const unique = [...new Set(indices)];
  const selectedIndexes = unique.length >= 4 ? unique : [...unique, ...([0, 5, 7, 8].filter((i) => !unique.includes(i)))].slice(0, Math.max(4, unique.length));

  return selectedIndexes.map((pi) => {
    const p = mockPatterns[pi];
    const finding: VisualFinding = {
      ...p,
      id: crypto.randomUUID(),
      imageId,
      annotations: p.annotations.map((a) => ({ ...a, id: crypto.randomUUID() })),
      r2dValues: { ...p.r2dValues },
      fkValues: { ...p.fkValues },
      matrixValues: { ...p.matrixValues },
      r2dResult: null,
      fkResult: null,
      matrixResult: null,
    };
    return computeAllScores(finding);
  });
}

function buildMockResults(lines: RiskLine[]): {
  results: LineResult[];
  selectedImages: Record<string, string>;
  selectedFindings: Record<string, string>;
} {
  const validLines = lines.filter((l) => l.images.length > 0);
  const results = validLines.map((line, li) => {
    const findings = line.images.flatMap((img, ii) => getMockFindings(img.id, ii, li));
    return { rowId: line.id, rowTitle: line.title.trim() || `Satır ${li + 1}`, imageCount: line.images.length, findings };
  });

  const selectedImages: Record<string, string> = {};
  const selectedFindings: Record<string, string> = {};
  results.forEach((r) => {
    const f = r.findings[0];
    if (f) {
      selectedImages[r.rowId] = f.imageId;
      selectedFindings[r.rowId] = f.id;
    }
  });

  return { results, selectedImages, selectedFindings };
}

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
  }, []);

  // URL'den gelen companyId parametresi — firma sayfasından yönlendirme
  useEffect(() => {
    const urlCompanyId = searchParams.get("companyId");
    if (urlCompanyId && companies.length > 0) {
      const found = companies.find((c) => c.id === urlCompanyId);
      if (found) {
        setSelectedCompanyId(urlCompanyId);
        // Doğrudan wizard moduna geç
        setViewMode("wizard");
        setStep(1);
      }
    }
  }, [searchParams, companies]);

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
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
  function addLine() { setLines((prev) => [...prev, createLine()]); setResults([]); }
  function removeLine(lid: string) {
    setLines((prev) => { const t = prev.find((l) => l.id === lid); t?.images.forEach((i) => URL.revokeObjectURL(i.previewUrl)); return prev.filter((l) => l.id !== lid); });
    setResults((prev) => prev.filter((r) => r.rowId !== lid));
    setSelectedImageByRow((prev) => { const n = { ...prev }; delete n[lid]; return n; });
    setSelectedFindingByRow((prev) => { const n = { ...prev }; delete n[lid]; return n; });
  }

  /* ── Finding update (for score panel changes) ── */
  const updateFinding = useCallback((rowId: string, updatedFinding: VisualFinding) => {
    setResults((prev) => prev.map((r) => r.rowId === rowId ? { ...r, findings: r.findings.map((f) => f.id === updatedFinding.id ? updatedFinding : f) } : r));
  }, []);

  /* ── Toggle DÖF ── */
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
  async function analyzeImageWithAI(imageFile: File, imageId: string): Promise<VisualFinding[]> {
    try {
      const { base64, mimeType } = await fileToBase64(imageFile);
      const res = await fetch("/api/analyze-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("AI analiz hatası:", res.status, errBody);
        return [];
      }

      const data = await res.json() as { risks: Array<{
        title: string; category: string; severity: DetectionSeverity;
        confidence: number; recommendation: string; correctiveActionRequired: boolean;
        pinX: number; pinY: number; boxX?: number; boxY?: number; boxW?: number; boxH?: number;
        legalReferences?: LegalReference[];
        r2dParams?: { c1: number; c2: number; c3: number; c4: number; c5: number; c6: number; c7: number; c8: number; c9: number };
      }> };

      return data.risks.map((risk, idx) => {
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
        const aiParams = risk.r2dParams;
        const r2dValues: R2DValues = aiParams
          ? {
              c1: Math.min(1, Math.max(0, aiParams.c1 ?? 0)),
              c2: Math.min(1, Math.max(0, aiParams.c2 ?? 0)),
              c3: Math.min(1, Math.max(0, aiParams.c3 ?? 0)),
              c4: Math.min(1, Math.max(0, aiParams.c4 ?? 0)),
              c5: Math.min(1, Math.max(0, aiParams.c5 ?? 0)),
              c6: Math.min(1, Math.max(0, aiParams.c6 ?? 0)),
              c7: Math.min(1, Math.max(0, aiParams.c7 ?? 0)),
              c8: Math.min(1, Math.max(0, aiParams.c8 ?? 0)),
              c9: Math.min(1, Math.max(0, aiParams.c9 ?? 0)),
            }
          : getR2DForCategory(risk.category, risk.severity);
        const fkValues = getFKForCategory(risk.category, risk.severity);
        const matrixValues = getMatrixForCategory(risk.category, risk.severity);

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
          r2dResult: null,
          fkResult: null,
          matrixResult: null,
        });

        // DÖF adayligini R2D skoruna gore belirle (skor >= 0.60 = DÖF adayi)
        if (scored.r2dResult && scored.r2dResult.score >= 0.60) {
          scored.correctiveActionRequired = true;
        } else if (scored.r2dResult && scored.r2dResult.score < 0.40) {
          scored.correctiveActionRequired = false;
        }
        return scored;
      });
    } catch (err) {
      console.error("AI analiz exception:", err);
      return [];
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

        const aiFindings = await analyzeImageWithAI(img.file, img.id);

        if (aiFindings.length > 0) {
          // Mukerrer risk filtrele (ayni baslik + ayni kategori = mukerrer)
          const existingTitles = new Set(allFindings.map((f) => `${f.title.toLowerCase()}|${f.category.toLowerCase()}`));
          const unique = aiFindings.filter((f) => !existingTitles.has(`${f.title.toLowerCase()}|${f.category.toLowerCase()}`));
          allFindings.push(...unique);
        } else {
          // AI basarisiz olursa mock fallback
          const mockFallback = getMockFindings(img.id, line.images.indexOf(img), li);
          allFindings.push(...mockFallback);
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
    setSelectedImageByRow(newSelectedImages);
    setSelectedFindingByRow(newSelectedFindings);
    const totalFound = newResults.reduce((s, r) => s + r.findings.length, 0);
    setSetupMessage(`AI analizi tamamlandı. ${totalFound} risk tespit edildi.`);
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
      r2dResult: null,
      fkResult: null,
      matrixResult: null,
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
  /** Blob URL'i base64 data URL'e cevir — export sırasında yüzleri bulanıklaştır */
  async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();

      // Görseli canvas'a çiz → yüz tespiti → bulanıklaştır → dataUrl
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

          resolve(canvas.toDataURL("image/jpeg", 0.90));
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve("");
        img.src = URL.createObjectURL(blob);
      });
    } catch { return ""; }
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
        legalReferences: f.legalReferences.length > 0 ? f.legalReferences : undefined,
      };
    });

    // Gorsel datalarini topla (blob URL -> base64)
    const images: ExportImage[] = [];
    for (const result of results) {
      const sourceLine = lineMap.get(result.rowId);
      if (!sourceLine) continue;
      for (const img of sourceLine.images) {
        const findingCount = result.findings.filter((f) => f.imageId === img.id).length;
        const dataUrl = await blobUrlToDataUrl(img.previewUrl);
        if (dataUrl) {
          images.push({ imageId: img.id, rowTitle: result.rowTitle, dataUrl, fileName: img.file.name, findingCount });
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
            findingIds: result.findings.filter((f) => f.imageId === img.id).map((f) => f.imageId),
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
    return m === "r_skor" ? "R-SKOR 2D" : m === "fine_kinney" ? "Fine-Kinney" : m === "l_matrix" ? "L-Matris" : m;
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
              size="lg"
              disabled={!selectedCompanyId}
              onClick={startNewAnalysis}
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={backToList}>Listeye Dön</Button>
            <Button type="button" variant="outline" onClick={resetAll}>Yeni Analiz</Button>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Firma / Kurum</label>
              <select value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedLocation(""); setSelectedDepartment(""); setSetupMessage(""); setSetupMessageType(""); }} className={selectCls}>
                <option value="">Firma / kurum seç</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Analiz Yöntemi</label>
              <div className="grid grid-cols-3 gap-3">
                <Button type="button" variant={method === "r_skor" ? "accent" : "outline"} onClick={() => setMethod("r_skor")}>R-SKOR</Button>
                <Button type="button" variant={method === "fine_kinney" ? "accent" : "outline"} onClick={() => setMethod("fine_kinney")}>Fine-Kinney</Button>
                <Button type="button" variant={method === "l_matrix" ? "accent" : "outline"} onClick={() => setMethod("l_matrix")}>L Matris</Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Lokasyon / Çalışma Alanı</label>
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className={selectCls}>
                <option value="">Lokasyon seç</option>
                {(selectedCompany?.locations ?? []).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Bölüm / Birim</label>
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className={selectCls}>
                <option value="">Bölüm seç</option>
                {(selectedCompany?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
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

          <div className="mt-4"><Link href="/companies"><Button type="button" variant="outline">Firma Yapısını Düzenle</Button></Link></div>

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
            <Button type="button" variant="outline" onClick={addParticipant}>Manuel Görevli Ekle</Button>
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

          <div className="space-y-5">
            {lines.map((line, idx) => (
              <div key={line.id} className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Satır {idx + 1}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Genel ve yakın açıları bu satır altında toplayın.</p>
                  </div>
                  {lines.length > 1 && <Button type="button" variant="ghost" onClick={() => removeLine(line.id)}>Satırı Sil</Button>}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="Satır Başlığı" value={line.title} onChange={(e) => updateLine(line.id, "title", e.target.value)} placeholder="Örn. İstifleme alanı" />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Açıklama</label>
                    <input type="text" value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Risk grubunu kısaca açıkla" className="h-12 rounded-2xl border border-border bg-card px-4 text-sm text-foreground" />
                  </div>
                </div>

                <input ref={(n) => { fileInputRefs.current[line.id] = n; }} type="file" accept="image/*" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => appendFiles(line.id, e.target.files)} />

                <div className="mt-4">
                  <Button type="button" onClick={() => fileInputRefs.current[line.id]?.click()}>Görsel Ekle</Button>
                </div>

                {line.images.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {line.images.map((img) => (
                      <div key={img.id} className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
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

          {/* Yeni satir ekle (liste altinda) */}
          <button
            type="button"
            onClick={addLine}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Satır Ekle
          </button>

          {/* Analiz baslat butonu */}
          <div className="mt-6 flex items-center gap-4">
            <Button type="button" size="lg" variant="accent" disabled={totalImageCount === 0 || isAnalyzing} onClick={() => { handleAnalyze(); setStep(4); }}>
              {isAnalyzing ? "AI Analiz Yapılıyor..." : "AI ile Risk Analizini Başlat"}
            </Button>
            <p className="text-sm text-muted-foreground">Nova AI ile her görsel analiz edilecek.</p>
          </div>

          {setupMessage && <StatusAlert tone={setupMessageType === "success" ? "success" : "danger"} className="mt-5">{setupMessage}</StatusAlert>}
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
                <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => buildExportData().then(exportRiskAnalysisPDF)} disabled={results.length === 0}>PDF</Button>
                <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => buildExportData().then(exportRiskAnalysisWord)} disabled={results.length === 0}>Word</Button>
                <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => buildExportData().then(exportRiskAnalysisExcel)} disabled={results.length === 0}>Excel</Button>
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
                {/* ── Pending pin dialog ── */}
                {pendingPin && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
                <p className="text-sm font-semibold text-foreground">Manuel Risk İşareti Ekle</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Input label="Tespit Başlığı" value={pendingPinTitle} onChange={(e) => setPendingPinTitle(e.target.value)} placeholder="Örn. Korkuluk eksik" />
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
                                <img src={img.previewUrl} alt={img.file.name} className="h-full w-full object-cover" />
                              </div>
                              <div className="p-3">
                                <p className="eyebrow">Görsel {ii + 1}</p>
                                <p className="mt-1 truncate text-sm font-medium text-foreground">{img.file.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Risk: {imgFindings.length}</p>
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
                            <img src={selectedImage.previewUrl} alt={selectedImage.file.name} className="h-full w-full object-cover pointer-events-none" />
                            <div className={`absolute inset-0 ${pinMode === result.rowId ? "pointer-events-none" : ""}`}>
                              {visibleFindings.map((f) =>
                                f.annotations.map((a) =>
                                  renderAnnotation(a, selectedFindingId === f.id, () => setSelectedFindingByRow((prev) => ({ ...prev, [result.rowId]: f.id })))
                                )
                              )}
                            </div>
                            {pinMode === result.rowId && (
                              <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-white">
                                Görsele tıklayarak risk işareti ekle
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right: findings + score panel ── */}
                    <div className="space-y-3">
                      {visibleFindings.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm leading-7 text-muted-foreground">Seçilen görsel için tespit bulunamadı.</div>
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

                      {/* Skorlama paneli kaldırıldı — son kullanıcı için gereksiz karmaşıklık */}
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

      {/* ═══════════════ NAVIGATION BUTTONS ═══════════════ */}
      <div className="flex items-center justify-between">
        <div>
          {step > 1 && (
            <Button type="button" variant="outline" size="lg" onClick={goBack}>Geri</Button>
          )}
        </div>
        <div className="flex gap-3">
          {step < 4 && (
            <Button type="button" variant="accent" size="lg" onClick={goNext}>
              {step === 3 ? "Sonuçlara Git" : "İleri"}
            </Button>
          )}
          {step === 4 && (
            <>
              <Button type="button" variant="accent" size="lg" onClick={handleSaveAnalysis} disabled={isSaving || results.length === 0}>
                {isSaving ? "Kaydediliyor..." : currentAssessmentId ? "Güncelle" : "Kaydet"}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={backToList}>Listeye Dön</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
