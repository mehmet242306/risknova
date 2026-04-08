/**
 * Risk Assessment API — Supabase CRUD
 * Görsel-bazlı risk analizi kaydetme, yükleme, silme
 */

import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type SavedAssessment = {
  id: string;
  title: string;
  status: "draft" | "completed" | "archived";
  method: string;
  assessmentDate: string;
  workplaceName: string;
  departmentName: string;
  locationText: string;
  analysisNote: string;
  companyWorkspaceId: string | null;
  participants: unknown[];
  itemCount: number;
  overallRiskLevel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedRow = {
  id: string;
  assessmentId: string;
  sortOrder: number;
  title: string;
  description: string | null;
};

export type SavedImage = {
  id: string;
  rowId: string;
  storagePath: string;
  fileName: string;
  sortOrder: number;
  /** Runtime: signed URL from storage */
  signedUrl?: string;
};

export type SavedFinding = {
  id: string;
  rowId: string;
  imageId: string;
  title: string;
  category: string;
  severity: string;
  confidence: number;
  isManual: boolean;
  correctiveActionRequired: boolean;
  recommendation: string | null;
  actionText: string | null;
  r2dValues: Record<string, number>;
  r2dResult: unknown | null;
  fkValues: { likelihood: number; severity: number; exposure: number };
  fkResult: unknown | null;
  matrixValues: { likelihood: number; severity: number };
  matrixResult: unknown | null;
  fmeaValues: unknown;
  fmeaResult: unknown | null;
  hazopValues: unknown;
  hazopResult: unknown | null;
  bowTieValues: unknown;
  bowTieResult: unknown | null;
  ftaValues: unknown;
  ftaResult: unknown | null;
  checklistValues: unknown;
  checklistResult: unknown | null;
  jsaValues: unknown;
  jsaResult: unknown | null;
  lopaValues: unknown;
  lopaResult: unknown | null;
  annotations: unknown[];
  legalReferences: { law: string; article: string; description: string }[];
  sortOrder: number;
};

export type FullAssessment = SavedAssessment & {
  rows: (SavedRow & { images: SavedImage[]; findings: SavedFinding[] })[];
};

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

/** File → base64 for upload */
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/* ================================================================== */
/* LIST                                                                */
/* ================================================================== */

export async function listRiskAssessments(companyWorkspaceId?: string): Promise<SavedAssessment[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("risk_assessments")
    .select("id, title, status, method, assessment_date, workplace_name, department_name, location_text, analysis_note, company_workspace_id, participants, item_count, overall_risk_level, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (companyWorkspaceId) {
    query = query.eq("company_workspace_id", companyWorkspaceId);
  }

  const { data, error } = await query;
  if (error) { console.warn("[risk-assessment-api] listRiskAssessments error:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    method: r.method,
    assessmentDate: r.assessment_date,
    workplaceName: r.workplace_name ?? "",
    departmentName: r.department_name ?? "",
    locationText: r.location_text ?? "",
    analysisNote: r.analysis_note ?? "",
    companyWorkspaceId: r.company_workspace_id,
    participants: r.participants ?? [],
    itemCount: r.item_count ?? 0,
    overallRiskLevel: r.overall_risk_level,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/* ================================================================== */
/* LOAD                                                                */
/* ================================================================== */

export async function loadRiskAssessment(assessmentId: string): Promise<FullAssessment | null> {
  const supabase = createClient();
  if (!supabase) return null;

  // 1. Assessment
  const { data: assessment, error: aErr } = await supabase
    .from("risk_assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();
  if (aErr || !assessment) { console.warn("[risk-assessment-api] loadRiskAssessment error:", aErr?.message); return null; }

  // 2. Rows
  const { data: dbRows } = await supabase
    .from("risk_assessment_rows")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order");

  // 3. Images
  const { data: dbImages } = await supabase
    .from("risk_assessment_images")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order");

  // 4. Findings
  const { data: dbFindings } = await supabase
    .from("risk_assessment_findings")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order");

  // 5. Signed URLs for images
  const images: SavedImage[] = (dbImages ?? []).map((img) => ({
    id: img.id,
    rowId: img.row_id,
    storagePath: img.storage_path,
    fileName: img.file_name,
    sortOrder: img.sort_order,
  }));

  // Get signed URLs in batch
  if (images.length > 0) {
    const paths = images.map((i) => i.storagePath);
    const { data: signedUrls } = await supabase.storage.from("risk-images").createSignedUrls(paths, 3600);
    if (signedUrls) {
      for (let i = 0; i < images.length; i++) {
        images[i].signedUrl = signedUrls[i]?.signedUrl ?? undefined;
      }
    }
  }

  // Build rows with images and findings
  const rows = (dbRows ?? []).map((r) => ({
    id: r.id,
    assessmentId: r.assessment_id,
    sortOrder: r.sort_order,
    title: r.title,
    description: r.description,
    images: images.filter((i) => i.rowId === r.id),
    findings: (dbFindings ?? []).filter((f) => f.row_id === r.id).map((f) => ({
      id: f.id,
      rowId: f.row_id,
      imageId: f.image_id,
      title: f.title,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      isManual: f.is_manual,
      correctiveActionRequired: f.corrective_action_required,
      recommendation: f.recommendation,
      actionText: f.action_text,
      r2dValues: f.r2d_values ?? {},
      r2dResult: f.r2d_result,
      fkValues: f.fk_values ?? { likelihood: 1, severity: 1, exposure: 1 },
      fkResult: f.fk_result,
      matrixValues: f.matrix_values ?? { likelihood: 1, severity: 1 },
      matrixResult: f.matrix_result,
      fmeaValues: f.fmea_values ?? { severity: 5, occurrence: 5, detection: 5 },
      fmeaResult: f.fmea_result ?? null,
      hazopValues: f.hazop_values ?? { severity: 3, likelihood: 3, detectability: 3, guideWord: "Çok (More)", parameter: "Akış (Flow)", deviation: "" },
      hazopResult: f.hazop_result ?? null,
      bowTieValues: f.bow_tie_values ?? { threatProbability: 3, consequenceSeverity: 3, preventionBarriers: 1, mitigationBarriers: 1 },
      bowTieResult: f.bow_tie_result ?? null,
      ftaValues: f.fta_values ?? { components: [], gateType: "OR", systemCriticality: 3 },
      ftaResult: f.fta_result ?? null,
      checklistValues: f.checklist_values ?? { items: [], category: "Genel" },
      checklistResult: f.checklist_result ?? null,
      jsaValues: f.jsa_values ?? { jobTitle: "", steps: [] },
      jsaResult: f.jsa_result ?? null,
      lopaValues: f.lopa_values ?? { initiatingEventFreq: 0.1, consequenceSeverity: 3, layers: [] },
      lopaResult: f.lopa_result ?? null,
      annotations: f.annotations ?? [],
      legalReferences: f.legal_references ?? [],
      sortOrder: f.sort_order,
    })),
  }));

  return {
    id: assessment.id,
    title: assessment.title,
    status: assessment.status,
    method: assessment.method,
    assessmentDate: assessment.assessment_date,
    workplaceName: assessment.workplace_name ?? "",
    departmentName: assessment.department_name ?? "",
    locationText: assessment.location_text ?? "",
    analysisNote: assessment.analysis_note ?? "",
    companyWorkspaceId: assessment.company_workspace_id,
    participants: assessment.participants ?? [],
    itemCount: assessment.item_count ?? 0,
    overallRiskLevel: assessment.overall_risk_level,
    createdAt: assessment.created_at,
    updatedAt: assessment.updated_at,
    rows,
  };
}

/* ================================================================== */
/* SAVE                                                                */
/* ================================================================== */

export type SaveRiskAnalysisInput = {
  title: string;
  analysisNote: string;
  method: string;
  companyWorkspaceId: string | null;
  location: string;
  department: string;
  participants: { fullName: string; roleCode: string; title: string; certificateNo: string }[];
  rows: {
    title: string;
    description: string;
    images: { file: File; findingIds: string[] }[];
    findings: {
      id: string;
      imageId: string; // local image reference
      title: string;
      category: string;
      severity: string;
      confidence: number;
      isManual: boolean;
      correctiveActionRequired: boolean;
      recommendation: string;
      action: string;
      r2dValues: Record<string, number>;
      r2dResult: unknown | null;
      fkValues: { likelihood: number; severity: number; exposure: number };
      fkResult: unknown | null;
      matrixValues: { likelihood: number; severity: number };
      matrixResult: unknown | null;
      fmeaValues?: unknown;
      fmeaResult?: unknown | null;
      hazopValues?: unknown;
      hazopResult?: unknown | null;
      bowTieValues?: unknown;
      bowTieResult?: unknown | null;
      ftaValues?: unknown;
      ftaResult?: unknown | null;
      checklistValues?: unknown;
      checklistResult?: unknown | null;
      jsaValues?: unknown;
      jsaResult?: unknown | null;
      lopaValues?: unknown;
      lopaResult?: unknown | null;
      annotations: unknown[];
      legalReferences: { law: string; article: string; description: string }[];
    }[];
  }[];
  /** Overall stats */
  totalFindings: number;
  criticalCount: number;
  highestRiskLevel: string;
};

export async function saveRiskAnalysis(input: SaveRiskAnalysisInput): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const auth = await resolveOrganizationId();
  if (!auth) { console.warn("[risk-assessment-api] saveRiskAnalysis: auth failed"); return null; }

  try {
    // 1. Create assessment
    const { data: assessment, error: aErr } = await supabase
      .from("risk_assessments")
      .insert({
        organization_id: auth.orgId,
        created_by_user_id: auth.userId,
        title: input.title,
        analysis_note: input.analysisNote,
        method: input.method,
        method_version: `${input.method}-v1`,
        company_workspace_id: input.companyWorkspaceId || null,
        assessment_date: new Date().toISOString().split("T")[0],
        workplace_name: input.location || null,
        department_name: input.department || null,
        location_text: input.location || null,
        participants: input.participants,
        item_count: input.totalFindings,
        overall_risk_level: input.highestRiskLevel || null,
        status: "completed",
      })
      .select("id")
      .single();

    if (aErr || !assessment) { console.warn("[risk-assessment-api] create assessment failed:", aErr?.message); return null; }
    const assessmentId = assessment.id;

    // 2. Process each row
    for (let ri = 0; ri < input.rows.length; ri++) {
      const row = input.rows[ri];

      // Create row
      const { data: dbRow, error: rErr } = await supabase
        .from("risk_assessment_rows")
        .insert({
          assessment_id: assessmentId,
          organization_id: auth.orgId,
          sort_order: ri + 1,
          title: row.title,
          description: row.description || null,
        })
        .select("id")
        .single();

      if (rErr || !dbRow) { console.warn("[risk-assessment-api] create row failed:", rErr?.message); continue; }

      // Upload images and create image records
      const localToDbImageId = new Map<string, string>();

      for (let ii = 0; ii < row.images.length; ii++) {
        const img = row.images[ii];
        const storagePath = `${auth.orgId}/${assessmentId}/${dbRow.id}/${crypto.randomUUID()}_${img.file.name}`;

        // Upload to storage
        const buffer = await fileToArrayBuffer(img.file);
        const { error: uploadErr } = await supabase.storage
          .from("risk-images")
          .upload(storagePath, buffer, { contentType: img.file.type, upsert: false });

        if (uploadErr) { console.warn("[risk-assessment-api] upload image failed:", uploadErr.message); continue; }

        // Create image record
        const { data: dbImage, error: imgErr } = await supabase
          .from("risk_assessment_images")
          .insert({
            assessment_id: assessmentId,
            row_id: dbRow.id,
            organization_id: auth.orgId,
            storage_path: storagePath,
            file_name: img.file.name,
            sort_order: ii + 1,
          })
          .select("id")
          .single();

        if (imgErr || !dbImage) { console.warn("[risk-assessment-api] create image failed:", imgErr?.message); continue; }

        // Map local finding imageIds to DB image ID
        for (const fId of img.findingIds) {
          localToDbImageId.set(fId, dbImage.id);
        }
      }

      // Create findings
      const findingsToInsert = row.findings
        .map((f, fi) => {
          const dbImageId = localToDbImageId.get(f.imageId);
          if (!dbImageId) return null;
          return {
            assessment_id: assessmentId,
            row_id: dbRow.id,
            image_id: dbImageId,
            organization_id: auth.orgId,
            title: f.title,
            category: f.category,
            severity: f.severity,
            confidence: f.confidence,
            is_manual: f.isManual,
            corrective_action_required: f.correctiveActionRequired,
            recommendation: f.recommendation || null,
            action_text: f.action || null,
            r2d_values: f.r2dValues,
            r2d_result: f.r2dResult,
            fk_values: f.fkValues,
            fk_result: f.fkResult,
            matrix_values: f.matrixValues,
            matrix_result: f.matrixResult,
            fmea_values: f.fmeaValues ?? null,
            fmea_result: f.fmeaResult ?? null,
            hazop_values: f.hazopValues ?? null,
            hazop_result: f.hazopResult ?? null,
            bow_tie_values: f.bowTieValues ?? null,
            bow_tie_result: f.bowTieResult ?? null,
            fta_values: f.ftaValues ?? null,
            fta_result: f.ftaResult ?? null,
            checklist_values: f.checklistValues ?? null,
            checklist_result: f.checklistResult ?? null,
            jsa_values: f.jsaValues ?? null,
            jsa_result: f.jsaResult ?? null,
            lopa_values: f.lopaValues ?? null,
            lopa_result: f.lopaResult ?? null,
            annotations: f.annotations,
            legal_references: f.legalReferences,
            sort_order: fi + 1,
          };
        })
        .filter(Boolean);

      if (findingsToInsert.length > 0) {
        const { error: fErr } = await supabase
          .from("risk_assessment_findings")
          .insert(findingsToInsert);
        if (fErr) console.warn("[risk-assessment-api] create findings failed:", fErr.message);
      }
    }

    return assessmentId;
  } catch (err) {
    console.warn("[risk-assessment-api] saveRiskAnalysis error:", err);
    return null;
  }
}

/* ================================================================== */
/* DELETE                                                              */
/* ================================================================== */

export async function deleteRiskAssessment(assessmentId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // 1. Get all image paths for cleanup
  const { data: images } = await supabase
    .from("risk_assessment_images")
    .select("storage_path")
    .eq("assessment_id", assessmentId);

  // 2. Delete from storage
  if (images && images.length > 0) {
    const paths = images.map((i) => i.storage_path);
    await supabase.storage.from("risk-images").remove(paths);
  }

  // 3. Delete assessment (cascade deletes rows, images, findings)
  const { error } = await supabase
    .from("risk_assessments")
    .delete()
    .eq("id", assessmentId);

  if (error) { console.warn("[risk-assessment-api] deleteRiskAssessment error:", error.message); return false; }
  return true;
}

/* ================================================================== */
/* FINDINGS BY CATEGORY                                                */
/* ================================================================== */

export type FindingWithContext = SavedFinding & {
  assessmentId: string;
  assessmentTitle: string;
  trackingStatus: "open" | "in_progress" | "resolved" | "archived";
  trackingNotes: string;
  statusUpdatedAt: string | null;
};

/**
 * Bir firmaya ait tüm analizlerdeki tespitleri kategoriye göre getirir.
 * Severity sırasına göre sıralı: critical > high > medium > low
 */
export async function listFindingsByCategory(
  companyWorkspaceId: string,
  categoryKey: string,
): Promise<FindingWithContext[]> {
  const supabase = createClient();
  if (!supabase) return [];

  // 1. Get assessment IDs for this company
  const { data: assessments } = await supabase
    .from("risk_assessments")
    .select("id, title")
    .eq("company_workspace_id", companyWorkspaceId);

  if (!assessments || assessments.length === 0) return [];

  const assessmentIds = assessments.map((a) => a.id);
  const titleMap = new Map(assessments.map((a) => [a.id, a.title]));

  // 2. Get all findings for these assessments
  const { data: findings, error } = await supabase
    .from("risk_assessment_findings")
    .select("*")
    .in("assessment_id", assessmentIds)
    .order("sort_order");

  if (error || !findings) {
    console.warn("[risk-assessment-api] listFindingsByCategory error:", error?.message);
    return [];
  }

  // 3. Filter by category using the same mapping logic
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return findings
    .filter((f) => mapCategoryToKey(f.category) === categoryKey)
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))
    .map((f) => ({
      id: f.id,
      rowId: f.row_id,
      imageId: f.image_id,
      title: f.title,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      isManual: f.is_manual,
      correctiveActionRequired: f.corrective_action_required,
      recommendation: f.recommendation,
      actionText: f.action_text,
      r2dValues: f.r2d_values ?? {},
      r2dResult: f.r2d_result,
      fkValues: f.fk_values ?? { likelihood: 1, severity: 1, exposure: 1 },
      fkResult: f.fk_result,
      matrixValues: f.matrix_values ?? { likelihood: 1, severity: 1 },
      matrixResult: f.matrix_result,
      fmeaValues: f.fmea_values ?? { severity: 5, occurrence: 5, detection: 5 },
      fmeaResult: f.fmea_result ?? null,
      hazopValues: f.hazop_values ?? { severity: 3, likelihood: 3, detectability: 3, guideWord: "Çok (More)", parameter: "Akış (Flow)", deviation: "" },
      hazopResult: f.hazop_result ?? null,
      bowTieValues: f.bow_tie_values ?? { threatProbability: 3, consequenceSeverity: 3, preventionBarriers: 1, mitigationBarriers: 1 },
      bowTieResult: f.bow_tie_result ?? null,
      ftaValues: f.fta_values ?? { components: [], gateType: "OR", systemCriticality: 3 },
      ftaResult: f.fta_result ?? null,
      checklistValues: f.checklist_values ?? { items: [], category: "Genel" },
      checklistResult: f.checklist_result ?? null,
      jsaValues: f.jsa_values ?? { jobTitle: "", steps: [] },
      jsaResult: f.jsa_result ?? null,
      lopaValues: f.lopa_values ?? { initiatingEventFreq: 0.1, consequenceSeverity: 3, layers: [] },
      lopaResult: f.lopa_result ?? null,
      annotations: f.annotations ?? [],
      legalReferences: f.legal_references ?? [],
      sortOrder: f.sort_order,
      assessmentId: f.assessment_id,
      assessmentTitle: titleMap.get(f.assessment_id) ?? "",
      trackingStatus: f.tracking_status ?? "open",
      trackingNotes: f.tracking_notes ?? "",
      statusUpdatedAt: f.status_updated_at ?? null,
    }));
}

/** AI kategori adını risk sınıfı key'ine dönüştür (WorkspaceTabs.tsx ile aynı mantık) */
function mapCategoryToKey(category: string): string {
  const lower = (category || "").toLowerCase().trim();

  // Elektrik
  if (lower.includes("elektrik") || lower.includes("electrical")) return "elektrik";

  // Yangın / Patlama
  if (lower.includes("yangın") || lower.includes("yangin") || lower.includes("patlama") || lower.includes("fire") || lower.includes("lpg") || lower.includes("gaz")) return "yangin";

  // Kimyasal
  if (lower.includes("kimyasal") || lower.includes("kimya") || lower.includes("chemical")) return "kimyasal";

  // Mekanik (makine, ekipman, düşme, sıkışma, depolama)
  if (lower.includes("makine") || lower.includes("mekanik") || lower.includes("machine") || lower.includes("ekipman") || lower.includes("depolama") || lower.includes("storage") || lower.includes("istifleme") || lower.includes("yüksekte") || lower.includes("yuksekte") || lower.includes("iskele") || lower.includes("düşme") || lower.includes("dusme")) return "mekanik";

  // Ergonomik
  if (lower.includes("ergonomi") || lower.includes("ergonomic") || lower.includes("elle taşıma") || lower.includes("elle tasima") || lower.includes("kaldırma")) return "ergonomik";

  // Trafik
  if (lower.includes("trafik") || lower.includes("araç") || lower.includes("arac") || lower.includes("forklift") || lower.includes("traffic")) return "trafik";

  // Çevresel
  if (lower.includes("çevre") || lower.includes("cevre") || lower.includes("havalandırma") || lower.includes("havalandirma") || lower.includes("aydınlatma") || lower.includes("aydinlatma") || lower.includes("gürültü") || lower.includes("gurultu") || lower.includes("sıcaklık") || lower.includes("sicaklik") || lower.includes("environment")) return "cevre";

  // Biyolojik
  if (lower.includes("biyolojik") || lower.includes("biological") || lower.includes("hijyen") || lower.includes("enfeksiyon")) return "biyolojik";

  // Psikososyal
  if (lower.includes("psikososyal") || lower.includes("stres") || lower.includes("mobbing") || lower.includes("vardiya")) return "psikososyal";

  // Fiziksel (düzen, temizlik, KKD, acil durum, uyarı, diğer → hepsi fiziksel'e düş)
  // Açık eşleşme yapılamazsa varsayılan olarak fiziksel
  if (lower.includes("kkd") || lower.includes("ppe") || lower.includes("koruyucu") || lower.includes("baret")) return "fiziksel";
  if (lower.includes("düzen") || lower.includes("duzen") || lower.includes("temizlik") || lower.includes("housekeeping")) return "fiziksel";
  if (lower.includes("acil") || lower.includes("emergency") || lower.includes("çıkış") || lower.includes("cikis")) return "fiziksel";
  if (lower.includes("işaret") || lower.includes("isaret") || lower.includes("uyarı") || lower.includes("uyari") || lower.includes("levha")) return "fiziksel";

  return "fiziksel"; // varsayılan
}

/* ================================================================== */
/* UPDATE FINDING STATUS                                               */
/* ================================================================== */

export async function updateFindingStatus(
  findingId: string,
  status: "open" | "in_progress" | "resolved" | "archived",
  notes: string,
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("risk_assessment_findings")
    .update({
      tracking_status: status,
      tracking_notes: notes,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", findingId);

  if (error) {
    console.warn("[risk-assessment-api] updateFindingStatus error:", error.message);
    return false;
  }
  return true;
}

/* ================================================================== */
/* ARCHIVE / UPDATE STATUS                                             */
/* ================================================================== */

/* ================================================================== */
/* COMPUTE COMPANY RISK SCORES                                         */
/* Dinamik olarak DB verilerinden coverage, maturity, openPressure hesaplar */
/* ================================================================== */

export type ComputedRiskScores = {
  completionRate: number;
  maturityScore: number;
  openRiskScore: number;
  openActions: number;
  overdueActions: number;
  openRiskAssessments: number;
  completedTrainingCount: number;
  expiringTrainingCount: number;
  periodicControlCount: number;
  overduePeriodicControlCount: number;
  lastAnalysisDate: string;
};

/**
 * DB'deki gerçek verilerden firma risk skorlarını hesaplar.
 *
 * - coverage (completionRate): Kaç farklı risk kategorisinde tespit var + analiz sayısı + doküman oranı
 * - maturity (maturityScore): Çözülen tespit oranı + eğitim tamamlanma + kontrol güncelliği
 * - openPressure (openRiskScore): Açık kritik/yüksek tespit yoğunluğu
 */
export async function computeCompanyRiskScores(
  companyWorkspaceId: string,
): Promise<ComputedRiskScores> {
  const fallback: ComputedRiskScores = {
    completionRate: 0, maturityScore: 0, openRiskScore: 0,
    openActions: 0, overdueActions: 0, openRiskAssessments: 0,
    completedTrainingCount: 0, expiringTrainingCount: 0,
    periodicControlCount: 0, overduePeriodicControlCount: 0,
    lastAnalysisDate: "",
  };

  const supabase = createClient();
  if (!supabase) return fallback;

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  // Paralel sorgular
  const [assessmentsRes, trainingsRes, controlsRes] = await Promise.all([
    supabase.from("risk_assessments")
      .select("id, status, assessment_date")
      .eq("company_workspace_id", companyWorkspaceId),
    supabase.from("company_trainings")
      .select("status, training_date")
      .eq("company_workspace_id", companyWorkspaceId),
    supabase.from("company_periodic_controls")
      .select("status, next_inspection_date")
      .eq("company_workspace_id", companyWorkspaceId),
  ]);

  const assessments = assessmentsRes.data ?? [];
  const trainings = trainingsRes.data ?? [];
  const controls = controlsRes.data ?? [];

  // Analiz sayıları
  const completedAssessments = assessments.filter((a) => a.status === "completed");
  const openRiskAssessments = assessments.filter((a) => a.status === "draft").length;
  const lastAnalysisDate = completedAssessments
    .map((a) => a.assessment_date)
    .filter(Boolean)
    .sort()
    .pop() ?? "";

  // Eğitim metrikleri
  const completedTrainingCount = trainings.filter((t) => t.status === "completed").length;
  const expiringTrainingCount = trainings.filter((t) => t.status === "planned" && t.training_date && t.training_date <= in30Days).length;

  // Kontrol metrikleri
  const periodicControlCount = controls.length;
  const overduePeriodicControlCount = controls.filter((c) => c.next_inspection_date && c.next_inspection_date < today).length;

  // Findings sorgula — sadece completed analizlerden
  if (completedAssessments.length === 0) {
    return {
      ...fallback,
      openRiskAssessments,
      completedTrainingCount,
      expiringTrainingCount,
      periodicControlCount,
      overduePeriodicControlCount,
      lastAnalysisDate,
    };
  }

  const assessmentIds = completedAssessments.map((a) => a.id);
  const { data: findings } = await supabase
    .from("risk_assessment_findings")
    .select("category, severity, tracking_status")
    .in("assessment_id", assessmentIds);

  const allFindings = findings ?? [];
  const totalFindings = allFindings.length;

  // Kategori çeşitliliği (10 risk kategorisi)
  const uniqueCategories = new Set(allFindings.map((f) => mapCategoryToKey(f.category)));
  const categoryRatio = uniqueCategories.size / 10; // 0-1

  // Tracking durumu
  const openFindings = allFindings.filter((f) => !f.tracking_status || f.tracking_status === "open" || f.tracking_status === "in_progress");
  const resolvedFindings = allFindings.filter((f) => f.tracking_status === "resolved" || f.tracking_status === "archived");
  const criticalOpen = openFindings.filter((f) => f.severity === "critical").length;
  const highOpen = openFindings.filter((f) => f.severity === "high").length;

  // ── COVERAGE (completionRate) ──
  // Analiz sayısı ağırlığı (%40) + kategori çeşitliliği (%30) + eğitim+kontrol (%30)
  const analysisScore = Math.min(completedAssessments.length / 3, 1); // 3+ analiz = %100
  const trainingScore = completedTrainingCount > 0 ? Math.min(completedTrainingCount / 5, 1) : 0;
  const controlScore = periodicControlCount > 0 ? Math.min(periodicControlCount / 3, 1) : 0;
  const supportScore = (trainingScore + controlScore) / 2;
  const completionRate = Math.round(
    (analysisScore * 0.4 + categoryRatio * 0.3 + supportScore * 0.3) * 100,
  );

  // ── MATURITY (maturityScore) ──
  // Çözülme oranı (%50) + eğitim tamamlanma (%25) + kontrol güncelliği (%25)
  const resolveRatio = totalFindings > 0 ? resolvedFindings.length / totalFindings : 0;
  const trainingMaturity = trainings.length > 0 ? completedTrainingCount / trainings.length : 0;
  const controlUpToDate = periodicControlCount > 0 ? 1 - (overduePeriodicControlCount / periodicControlCount) : 0;
  const maturityScore = Math.round(
    (resolveRatio * 0.5 + trainingMaturity * 0.25 + controlUpToDate * 0.25) * 100,
  );

  // ── OPEN PRESSURE (openRiskScore) ──
  // Açık tespit yoğunluğu: kritik x3 + yüksek x2 + orta/düşük x1
  const weightedOpen = criticalOpen * 3 + highOpen * 2 + (openFindings.length - criticalOpen - highOpen);
  const maxPressure = totalFindings > 0 ? (totalFindings * 3) : 1; // Normalize edilecek
  const rawPressure = totalFindings > 0 ? (weightedOpen / maxPressure) * 100 : 0;
  const openRiskScore = Math.round(Math.min(rawPressure, 100));

  // Açık aksiyonlar (open + in_progress findings)
  const openActions = openFindings.length;
  // Gecikmiş aksiyonlar (basit: 30+ gün açık olan kritik/yüksek)
  const overdueActions = criticalOpen + Math.floor(highOpen * 0.5);

  return {
    completionRate: Math.min(completionRate, 100),
    maturityScore: Math.min(maturityScore, 100),
    openRiskScore: Math.min(openRiskScore, 100),
    openActions,
    overdueActions,
    openRiskAssessments,
    completedTrainingCount,
    expiringTrainingCount,
    periodicControlCount,
    overduePeriodicControlCount,
    lastAnalysisDate,
  };
}

export async function archiveRiskAssessment(assessmentId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("risk_assessments")
    .update({ status: "archived" })
    .eq("id", assessmentId);

  if (error) {
    console.warn("[risk-assessment-api] archiveRiskAssessment error:", error.message);
    return false;
  }
  return true;
}
