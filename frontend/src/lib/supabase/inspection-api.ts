import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";
import type { ChecklistQuestionRecord, TemplateWithQuestions } from "./checklist-api";

// =============================================================================
// Saha Denetimi — Denetim oturumu (run) + cevaplar + Nova önerileri
// =============================================================================

export type InspectionRunMode = "official" | "preview";
export type InspectionRunStatus =
  | "in_progress"
  | "completed"
  | "abandoned"
  | "report_ready";

export type ResponseStatus = "uygun" | "uygunsuz" | "kritik" | "na";
export type SuggestionDecision =
  | "pending"
  | "reviewed"
  | "ignored"
  | "linked_risk"
  | "linked_action"
  | "started_dof"
  | "created_risk";

export type DecisionTargetTable =
  | "risk_assessments"
  | "risk_assessment_findings"
  | "corrective_actions";

export type SuggestionType =
  | "linked_risk"
  | "linked_action"
  | "repeat_dof"
  | "new_risk_draft"
  | "memory_note";

export type InspectionRunRecord = {
  id: string;
  code: string | null;
  organizationId: string;
  companyWorkspaceId: string | null;
  templateId: string;
  runMode: InspectionRunMode;
  status: InspectionRunStatus;
  siteLabel: string | null;
  location: string | null;
  lineOrShift: string | null;
  readinessScore: number;
  totalQuestions: number;
  answeredCount: number;
  uygunCount: number;
  uygunsuzCount: number;
  kritikCount: number;
  naCount: number;
  reportStoragePath: string | null;
  clientGeneratedAt: string | null;
  syncedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  archivedByUserId: string | null;
  templateTitle?: string | null;
};

export type InspectionAnswerRecord = {
  id: string;
  runId: string;
  questionId: string;
  organizationId: string;
  responseStatus: ResponseStatus | null;
  note: string | null;
  photoUrls: string[];
  voiceNoteUrl: string | null;
  actionTitle: string | null;
  actionResponsibleUserId: string | null;
  actionDeadline: string | null;
  naReason: string | null;
  suggestionReviewed: boolean;
  decision: SuggestionDecision;
  decisionTargetTable: DecisionTargetTable | null;
  decisionTargetId: string | null;
  decisionAt: string | null;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuggestionLogRecord = {
  id: string;
  answerId: string;
  organizationId: string;
  suggestionType: SuggestionType;
  suggestionTitle: string;
  suggestionDescription: string | null;
  suggestionReason: string[];
  aiConfidence: number | null;
  aiModel: string | null;
  decision: "pending" | "accepted" | "ignored";
  targetTable: string | null;
  targetId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type RunWithAnswers = InspectionRunRecord & {
  template?: TemplateWithQuestions | null;
  answers: InspectionAnswerRecord[];
};

type LooseRow = Record<string, unknown>;

function mapRunRow(row: LooseRow): InspectionRunRecord {
  const tmpl = row.inspection_checklist_templates as { title?: string } | null | undefined;
  return {
    id: row.id as string,
    code: (row.code as string | null) ?? null,
    organizationId: row.organization_id as string,
    companyWorkspaceId: (row.company_workspace_id as string | null) ?? null,
    templateId: row.template_id as string,
    runMode: row.run_mode as InspectionRunMode,
    status: row.status as InspectionRunStatus,
    siteLabel: (row.site_label as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    lineOrShift: (row.line_or_shift as string | null) ?? null,
    readinessScore: (row.readiness_score as number | null) ?? 0,
    totalQuestions: (row.total_questions as number | null) ?? 0,
    answeredCount: (row.answered_count as number | null) ?? 0,
    uygunCount: (row.uygun_count as number | null) ?? 0,
    uygunsuzCount: (row.uygunsuz_count as number | null) ?? 0,
    kritikCount: (row.kritik_count as number | null) ?? 0,
    naCount: (row.na_count as number | null) ?? 0,
    reportStoragePath: (row.report_storage_path as string | null) ?? null,
    clientGeneratedAt: (row.client_generated_at as string | null) ?? null,
    syncedAt: (row.synced_at as string | null) ?? null,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    createdBy: row.created_by as string,
    updatedBy: (row.updated_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    isArchived: (row.is_archived as boolean | null) ?? false,
    archivedAt: (row.archived_at as string | null) ?? null,
    archivedByUserId: (row.archived_by_user_id as string | null) ?? null,
    templateTitle: tmpl?.title ?? null,
  };
}

function mapAnswerRow(row: LooseRow): InspectionAnswerRecord {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    questionId: row.question_id as string,
    organizationId: row.organization_id as string,
    responseStatus: (row.response_status as ResponseStatus | null) ?? null,
    note: (row.note as string | null) ?? null,
    photoUrls: (row.photo_urls as string[] | null) ?? [],
    voiceNoteUrl: (row.voice_note_url as string | null) ?? null,
    actionTitle: (row.action_title as string | null) ?? null,
    actionResponsibleUserId: (row.action_responsible_user_id as string | null) ?? null,
    actionDeadline: (row.action_deadline as string | null) ?? null,
    naReason: (row.na_reason as string | null) ?? null,
    suggestionReviewed: (row.suggestion_reviewed as boolean | null) ?? false,
    decision: (row.decision as SuggestionDecision) ?? "pending",
    decisionTargetTable: (row.decision_target_table as DecisionTargetTable | null) ?? null,
    decisionTargetId: (row.decision_target_id as string | null) ?? null,
    decisionAt: (row.decision_at as string | null) ?? null,
    answeredAt: (row.answered_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSuggestionRow(row: LooseRow): SuggestionLogRecord {
  return {
    id: row.id as string,
    answerId: row.answer_id as string,
    organizationId: row.organization_id as string,
    suggestionType: row.suggestion_type as SuggestionType,
    suggestionTitle: row.suggestion_title as string,
    suggestionDescription: (row.suggestion_description as string | null) ?? null,
    suggestionReason: (row.suggestion_reason as string[] | null) ?? [],
    aiConfidence: (row.ai_confidence as number | null) ?? null,
    aiModel: (row.ai_model as string | null) ?? null,
    decision: (row.decision as "pending" | "accepted" | "ignored") ?? "pending",
    targetTable: (row.target_table as string | null) ?? null,
    targetId: (row.target_id as string | null) ?? null,
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// -----------------------------------------------------------------------------
// RUNS
// -----------------------------------------------------------------------------

export type ListRunsOptions = {
  status?: InspectionRunStatus | InspectionRunStatus[];
  runMode?: InspectionRunMode;
  templateId?: string;
  companyWorkspaceId?: string | null;
  onlyMine?: boolean;
  limit?: number;
};

export async function listInspectionRuns(
  opts: ListRunsOptions = {},
): Promise<InspectionRunRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("inspection_runs")
    .select("*, inspection_checklist_templates(title)")
    .eq("is_archived", false)
    .order("started_at", { ascending: false });

  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  if (opts.runMode) query = query.eq("run_mode", opts.runMode);
  if (opts.templateId) query = query.eq("template_id", opts.templateId);
  if (opts.companyWorkspaceId !== undefined) {
    query = opts.companyWorkspaceId === null
      ? query.is("company_workspace_id", null)
      : query.eq("company_workspace_id", opts.companyWorkspaceId);
  }
  if (opts.onlyMine) {
    const auth = await resolveOrganizationId();
    if (auth) query = query.eq("created_by", auth.userId);
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.warn("listInspectionRuns:", error.message);
    return [];
  }
  return (data ?? []).map(mapRunRow);
}

export async function fetchRunById(id: string): Promise<InspectionRunRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inspection_runs")
    .select("*, inspection_checklist_templates(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("fetchRunById:", error.message);
    return null;
  }
  return data ? mapRunRow(data) : null;
}

export async function fetchAnswers(runId: string): Promise<InspectionAnswerRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("inspection_answers")
    .select("*")
    .eq("run_id", runId);
  if (error) {
    console.warn("fetchAnswers:", error.message);
    return [];
  }
  return (data ?? []).map(mapAnswerRow);
}

export type CreateRunInput = {
  templateId: string;
  runMode?: InspectionRunMode;
  siteLabel?: string | null;
  location?: string | null;
  lineOrShift?: string | null;
  companyWorkspaceId?: string | null;
  totalQuestions?: number;
  clientGeneratedAt?: string | null;
};

export async function createInspectionRun(
  input: CreateRunInput,
): Promise<InspectionRunRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) {
    console.warn("createInspectionRun: no auth / organization");
    return null;
  }

  const { data, error } = await supabase
    .from("inspection_runs")
    .insert({
      organization_id: auth.orgId,
      company_workspace_id: input.companyWorkspaceId ?? null,
      template_id: input.templateId,
      run_mode: input.runMode ?? "official",
      site_label: input.siteLabel ?? null,
      location: input.location ?? null,
      line_or_shift: input.lineOrShift ?? null,
      total_questions: input.totalQuestions ?? 0,
      client_generated_at: input.clientGeneratedAt ?? null,
      synced_at: new Date().toISOString(),
      created_by: auth.userId,
    })
    .select("*, inspection_checklist_templates(title)")
    .single();

  if (error) {
    console.warn("createInspectionRun:", error.message);
    return null;
  }
  return mapRunRow(data as LooseRow);
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: InspectionRunStatus;
    siteLabel: string | null;
    location: string | null;
    lineOrShift: string | null;
    readinessScore: number;
    totalQuestions: number;
    answeredCount: number;
    uygunCount: number;
    uygunsuzCount: number;
    kritikCount: number;
    naCount: number;
    reportStoragePath: string | null;
    completedAt: string | null;
    syncedAt: string | null;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.siteLabel !== undefined) update.site_label = patch.siteLabel;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.lineOrShift !== undefined) update.line_or_shift = patch.lineOrShift;
  if (patch.readinessScore !== undefined) update.readiness_score = patch.readinessScore;
  if (patch.totalQuestions !== undefined) update.total_questions = patch.totalQuestions;
  if (patch.answeredCount !== undefined) update.answered_count = patch.answeredCount;
  if (patch.uygunCount !== undefined) update.uygun_count = patch.uygunCount;
  if (patch.uygunsuzCount !== undefined) update.uygunsuz_count = patch.uygunsuzCount;
  if (patch.kritikCount !== undefined) update.kritik_count = patch.kritikCount;
  if (patch.naCount !== undefined) update.na_count = patch.naCount;
  if (patch.reportStoragePath !== undefined) update.report_storage_path = patch.reportStoragePath;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
  if (patch.syncedAt !== undefined) update.synced_at = patch.syncedAt;

  const { error } = await supabase.from("inspection_runs").update(update).eq("id", id);
  if (error) {
    console.warn("updateRun:", error.message);
    return false;
  }
  return true;
}

export async function completeRun(id: string): Promise<boolean> {
  return updateRun(id, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export async function markReportReady(id: string, storagePath: string): Promise<boolean> {
  return updateRun(id, {
    status: "report_ready",
    reportStoragePath: storagePath,
  });
}

export async function abandonRun(id: string): Promise<boolean> {
  return updateRun(id, { status: "abandoned" });
}

export async function getResumableRun(
  templateId: string,
  runMode: InspectionRunMode = "official",
): Promise<InspectionRunRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) return null;

  const { data, error } = await supabase
    .from("inspection_runs")
    .select("*, inspection_checklist_templates(title)")
    .eq("template_id", templateId)
    .eq("run_mode", runMode)
    .eq("created_by", auth.userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("getResumableRun:", error.message);
    return null;
  }
  return data ? mapRunRow(data) : null;
}

// -----------------------------------------------------------------------------
// ANSWERS — upsert (unique constraint on run_id+question_id)
// -----------------------------------------------------------------------------

export type UpsertAnswerInput = {
  runId: string;
  questionId: string;
  responseStatus?: ResponseStatus | null;
  note?: string | null;
  photoUrls?: string[];
  voiceNoteUrl?: string | null;
  actionTitle?: string | null;
  actionResponsibleUserId?: string | null;
  actionDeadline?: string | null;
  naReason?: string | null;
  suggestionReviewed?: boolean;
  decision?: SuggestionDecision;
};

export async function upsertAnswer(
  input: UpsertAnswerInput,
): Promise<InspectionAnswerRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) {
    console.warn("upsertAnswer: no auth / organization");
    return null;
  }

  const payload: Record<string, unknown> = {
    run_id: input.runId,
    question_id: input.questionId,
    organization_id: auth.orgId,
    answered_at: input.responseStatus ? new Date().toISOString() : null,
  };
  if (input.responseStatus !== undefined) payload.response_status = input.responseStatus;
  if (input.note !== undefined) payload.note = input.note;
  if (input.photoUrls !== undefined) payload.photo_urls = input.photoUrls;
  if (input.voiceNoteUrl !== undefined) payload.voice_note_url = input.voiceNoteUrl;
  if (input.actionTitle !== undefined) payload.action_title = input.actionTitle;
  if (input.actionResponsibleUserId !== undefined)
    payload.action_responsible_user_id = input.actionResponsibleUserId;
  if (input.actionDeadline !== undefined) payload.action_deadline = input.actionDeadline;
  if (input.naReason !== undefined) payload.na_reason = input.naReason;
  if (input.suggestionReviewed !== undefined)
    payload.suggestion_reviewed = input.suggestionReviewed;
  if (input.decision !== undefined) payload.decision = input.decision;

  const { data, error } = await supabase
    .from("inspection_answers")
    .upsert(payload, { onConflict: "run_id,question_id" })
    .select()
    .single();

  if (error) {
    console.warn("upsertAnswer:", error.message);
    return null;
  }
  return mapAnswerRow(data as LooseRow);
}

export async function recordDecision(
  answerId: string,
  decision: SuggestionDecision,
  target?: { table: DecisionTargetTable; id: string },
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("inspection_answers")
    .update({
      decision,
      decision_target_table: target?.table ?? null,
      decision_target_id: target?.id ?? null,
      decision_at: new Date().toISOString(),
      suggestion_reviewed: true,
    })
    .eq("id", answerId);
  if (error) {
    console.warn("recordDecision:", error.message);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// SUGGESTIONS
// -----------------------------------------------------------------------------

export async function listSuggestions(answerId: string): Promise<SuggestionLogRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("inspection_suggestion_log")
    .select("*")
    .eq("answer_id", answerId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("listSuggestions:", error.message);
    return [];
  }
  return (data ?? []).map(mapSuggestionRow);
}

export type RecordSuggestionInput = {
  answerId: string;
  suggestionType: SuggestionType;
  suggestionTitle: string;
  suggestionDescription?: string | null;
  suggestionReason?: string[];
  aiConfidence?: number | null;
  aiModel?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
};

export async function recordSuggestion(
  input: RecordSuggestionInput,
): Promise<SuggestionLogRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) return null;

  const { data, error } = await supabase
    .from("inspection_suggestion_log")
    .insert({
      answer_id: input.answerId,
      organization_id: auth.orgId,
      suggestion_type: input.suggestionType,
      suggestion_title: input.suggestionTitle,
      suggestion_description: input.suggestionDescription ?? null,
      suggestion_reason: input.suggestionReason ?? [],
      ai_confidence: input.aiConfidence ?? null,
      ai_model: input.aiModel ?? null,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn("recordSuggestion:", error.message);
    return null;
  }
  return mapSuggestionRow(data as LooseRow);
}

export async function decideSuggestion(
  suggestionId: string,
  decision: "accepted" | "ignored",
  target?: { table: string; id: string },
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const auth = await resolveOrganizationId();
  const { error } = await supabase
    .from("inspection_suggestion_log")
    .update({
      decision,
      target_table: target?.table ?? null,
      target_id: target?.id ?? null,
      decided_by: auth?.userId ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);
  if (error) {
    console.warn("decideSuggestion:", error.message);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// Convenience: yeniden hesaplama (sayı + skor)
// -----------------------------------------------------------------------------

export function computeRunCounts(
  answers: InspectionAnswerRecord[],
  totalQuestions: number,
  templatePublished: boolean,
  allCritical: boolean,
): {
  answered: number;
  uygun: number;
  uygunsuz: number;
  kritik: number;
  na: number;
  readinessScore: number;
} {
  const answered = answers.filter((a) => a.responseStatus).length;
  const uygun = answers.filter((a) => a.responseStatus === "uygun").length;
  const uygunsuz = answers.filter((a) => a.responseStatus === "uygunsuz").length;
  const kritik = answers.filter((a) => a.responseStatus === "kritik").length;
  const na = answers.filter((a) => a.responseStatus === "na").length;
  const completionRate = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0;
  const reviewedRate =
    answers.length > 0
      ? answers.filter((a) => a.suggestionReviewed).length / answers.length
      : 1;
  const baseScore = templatePublished ? 20 : 12;
  const reviewBonus = (uygunsuz + kritik) === 0 ? 18 : reviewedRate * 22;
  const completionBonus = allCritical ? 15 : 0;
  const readinessScore = Math.min(
    100,
    Math.round(baseScore + completionRate * 0.45 + reviewBonus + completionBonus),
  );
  return { answered, uygun, uygunsuz, kritik, na, readinessScore };
}
