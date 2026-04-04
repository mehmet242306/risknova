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
        method_version: input.method === "r_skor" ? "r-skor-v1" : input.method === "fine_kinney" ? "fine-kinney-v1" : "l-matrix-v1",
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
