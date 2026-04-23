import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";

// =============================================================================
// Saha Denetimi — Checklist şablon & soru API'leri
// Mevcut corrective-actions-api / incident-api stilinde, sessiz hata + null/[]
// =============================================================================

export type ChecklistSource = "manual" | "nova" | "library" | "risk_analysis" | "imported";
export type ChecklistMode = "quick" | "standard" | "detailed";
export type ChecklistStatus = "draft" | "published" | "archived";
export type QuestionPriority = "low" | "medium" | "high" | "critical";

export type ChecklistTemplateRecord = {
  id: string;
  organizationId: string;
  companyWorkspaceId: string | null;
  title: string;
  description: string | null;
  source: ChecklistSource;
  mode: ChecklistMode;
  status: ChecklistStatus;
  version: number;
  novaPurpose: string | null;
  novaSources: Record<string, boolean>;
  libraryReferenceId: string | null;
  lastUsedAt: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  archivedByUserId: string | null;
  questionCount?: number;
};

export type ChecklistQuestionRecord = {
  id: string;
  templateId: string;
  sortOrder: number;
  section: string;
  category: string;
  text: string;
  priority: QuestionPriority;
  ruleHint: string | null;
  ruleUygunsuz: string | null;
  ruleKritik: string | null;
  suggestedActionTitle: string | null;
  suggestedActionDescription: string | null;
  sourceBadges: string[];
  whySuggested: string | null;
  linkedRiskHint: string | null;
  openActionHint: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateWithQuestions = ChecklistTemplateRecord & {
  questions: ChecklistQuestionRecord[];
};

type LooseRow = Record<string, unknown>;

function mapTemplateRow(row: LooseRow): ChecklistTemplateRecord {
  const questions = row.inspection_checklist_questions as LooseRow[] | null | undefined;
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    companyWorkspaceId: (row.company_workspace_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    source: row.source as ChecklistSource,
    mode: row.mode as ChecklistMode,
    status: row.status as ChecklistStatus,
    version: (row.version as number | null) ?? 1,
    novaPurpose: (row.nova_purpose as string | null) ?? null,
    novaSources: (row.nova_sources as Record<string, boolean> | null) ?? {},
    libraryReferenceId: (row.library_reference_id as string | null) ?? null,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    isArchived: (row.is_archived as boolean | null) ?? false,
    archivedAt: (row.archived_at as string | null) ?? null,
    archivedByUserId: (row.archived_by_user_id as string | null) ?? null,
    questionCount: Array.isArray(questions) ? questions.length : undefined,
  };
}

function mapQuestionRow(row: LooseRow): ChecklistQuestionRecord {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    sortOrder: (row.sort_order as number | null) ?? 0,
    section: row.section as string,
    category: row.category as string,
    text: row.text as string,
    priority: row.priority as QuestionPriority,
    ruleHint: (row.rule_hint as string | null) ?? null,
    ruleUygunsuz: (row.rule_uygunsuz as string | null) ?? null,
    ruleKritik: (row.rule_kritik as string | null) ?? null,
    suggestedActionTitle: (row.suggested_action_title as string | null) ?? null,
    suggestedActionDescription: (row.suggested_action_description as string | null) ?? null,
    sourceBadges: (row.source_badges as string[] | null) ?? [],
    whySuggested: (row.why_suggested as string | null) ?? null,
    linkedRiskHint: (row.linked_risk_hint as string | null) ?? null,
    openActionHint: (row.open_action_hint as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// -----------------------------------------------------------------------------
// TEMPLATES — list / get / create / update / publish / archive / clone
// -----------------------------------------------------------------------------

export type ListTemplatesOptions = {
  status?: ChecklistStatus | ChecklistStatus[];
  source?: ChecklistSource | ChecklistSource[];
  companyWorkspaceId?: string | null;
  includeArchived?: boolean;
};

export async function listChecklistTemplates(
  opts: ListTemplatesOptions = {},
): Promise<ChecklistTemplateRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("inspection_checklist_templates")
    .select("*, inspection_checklist_questions(id)")
    .order("updated_at", { ascending: false });

  if (!opts.includeArchived) query = query.eq("is_archived", false);

  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  if (opts.source) {
    query = Array.isArray(opts.source)
      ? query.in("source", opts.source)
      : query.eq("source", opts.source);
  }
  if (opts.companyWorkspaceId !== undefined) {
    query = opts.companyWorkspaceId === null
      ? query.is("company_workspace_id", null)
      : query.eq("company_workspace_id", opts.companyWorkspaceId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("listChecklistTemplates:", error.message);
    return [];
  }
  return (data ?? []).map(mapTemplateRow);
}

export async function fetchTemplateById(id: string): Promise<TemplateWithQuestions | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const [{ data: tmpl, error: te }, { data: qs, error: qe }] = await Promise.all([
    supabase.from("inspection_checklist_templates").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("inspection_checklist_questions")
      .select("*")
      .eq("template_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (te) {
    console.warn("fetchTemplateById (template):", te.message);
    return null;
  }
  if (qe) console.warn("fetchTemplateById (questions):", qe.message);
  if (!tmpl) return null;

  return {
    ...mapTemplateRow(tmpl),
    questions: (qs ?? []).map(mapQuestionRow),
  };
}

export type CreateTemplateInput = {
  title: string;
  description?: string | null;
  source?: ChecklistSource;
  mode?: ChecklistMode;
  status?: ChecklistStatus;
  companyWorkspaceId?: string | null;
  novaPurpose?: string | null;
  novaSources?: Record<string, boolean>;
  libraryReferenceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<ChecklistTemplateRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) {
    console.warn("createTemplate: no auth / organization");
    return null;
  }

  const { data, error } = await supabase
    .from("inspection_checklist_templates")
    .insert({
      organization_id: auth.orgId,
      company_workspace_id: input.companyWorkspaceId ?? null,
      title: input.title,
      description: input.description ?? null,
      source: input.source ?? "manual",
      mode: input.mode ?? "standard",
      status: input.status ?? "draft",
      nova_purpose: input.novaPurpose ?? null,
      nova_sources: input.novaSources ?? {},
      library_reference_id: input.libraryReferenceId ?? null,
      metadata: input.metadata ?? {},
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    console.warn("createTemplate:", error.message);
    return null;
  }
  return mapTemplateRow(data as LooseRow);
}

export async function updateTemplate(
  id: string,
  patch: Partial<CreateTemplateInput>,
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.source !== undefined) update.source = patch.source;
  if (patch.mode !== undefined) update.mode = patch.mode;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.companyWorkspaceId !== undefined) update.company_workspace_id = patch.companyWorkspaceId;
  if (patch.novaPurpose !== undefined) update.nova_purpose = patch.novaPurpose;
  if (patch.novaSources !== undefined) update.nova_sources = patch.novaSources;
  if (patch.libraryReferenceId !== undefined) update.library_reference_id = patch.libraryReferenceId;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;

  const { error } = await supabase
    .from("inspection_checklist_templates")
    .update(update)
    .eq("id", id);
  if (error) {
    console.warn("updateTemplate:", error.message);
    return false;
  }
  return true;
}

export async function publishTemplate(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { data: current, error: readErr } = await supabase
    .from("inspection_checklist_templates")
    .select("version")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    console.warn("publishTemplate read:", readErr.message);
    return false;
  }
  const nextVersion = ((current?.version as number | null) ?? 1) + 1;
  const { error } = await supabase
    .from("inspection_checklist_templates")
    .update({
      status: "published",
      version: nextVersion,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.warn("publishTemplate:", error.message);
    return false;
  }
  return true;
}

export async function archiveTemplate(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const auth = await resolveOrganizationId();
  const { error } = await supabase
    .from("inspection_checklist_templates")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by_user_id: auth?.userId ?? null,
      status: "archived",
    })
    .eq("id", id);
  if (error) {
    console.warn("archiveTemplate:", error.message);
    return false;
  }
  return true;
}

export async function cloneTemplate(
  sourceId: string,
  overrides?: { title?: string; asDraft?: boolean },
): Promise<ChecklistTemplateRecord | null> {
  const existing = await fetchTemplateById(sourceId);
  if (!existing) return null;

  const created = await createTemplate({
    title: overrides?.title ?? `${existing.title} (kopya)`,
    description: existing.description,
    source: existing.source,
    mode: existing.mode,
    status: overrides?.asDraft === false ? existing.status : "draft",
    companyWorkspaceId: existing.companyWorkspaceId,
    novaPurpose: existing.novaPurpose,
    novaSources: existing.novaSources,
    libraryReferenceId: existing.libraryReferenceId ?? sourceId,
    metadata: existing.metadata,
  });
  if (!created) return null;

  if (existing.questions.length > 0) {
    const supabase = createClient();
    if (supabase) {
      const rows = existing.questions.map((q, index) => ({
        template_id: created.id,
        sort_order: index,
        section: q.section,
        category: q.category,
        text: q.text,
        priority: q.priority,
        rule_hint: q.ruleHint,
        rule_uygunsuz: q.ruleUygunsuz,
        rule_kritik: q.ruleKritik,
        suggested_action_title: q.suggestedActionTitle,
        suggested_action_description: q.suggestedActionDescription,
        source_badges: q.sourceBadges,
        why_suggested: q.whySuggested,
        linked_risk_hint: q.linkedRiskHint,
        open_action_hint: q.openActionHint,
      }));
      const { error } = await supabase.from("inspection_checklist_questions").insert(rows);
      if (error) console.warn("cloneTemplate questions:", error.message);
    }
  }
  return created;
}

// -----------------------------------------------------------------------------
// QUESTIONS — create / update / delete / reorder / bulk
// -----------------------------------------------------------------------------

export type CreateQuestionInput = {
  templateId: string;
  section: string;
  category: string;
  text: string;
  priority?: QuestionPriority;
  sortOrder?: number;
  ruleHint?: string | null;
  ruleUygunsuz?: string | null;
  ruleKritik?: string | null;
  suggestedActionTitle?: string | null;
  suggestedActionDescription?: string | null;
  sourceBadges?: string[];
  whySuggested?: string | null;
  linkedRiskHint?: string | null;
  openActionHint?: string | null;
};

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<ChecklistQuestionRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("inspection_checklist_questions")
    .insert({
      template_id: input.templateId,
      section: input.section,
      category: input.category,
      text: input.text,
      priority: input.priority ?? "medium",
      sort_order: input.sortOrder ?? 0,
      rule_hint: input.ruleHint ?? null,
      rule_uygunsuz: input.ruleUygunsuz ?? null,
      rule_kritik: input.ruleKritik ?? null,
      suggested_action_title: input.suggestedActionTitle ?? null,
      suggested_action_description: input.suggestedActionDescription ?? null,
      source_badges: input.sourceBadges ?? [],
      why_suggested: input.whySuggested ?? null,
      linked_risk_hint: input.linkedRiskHint ?? null,
      open_action_hint: input.openActionHint ?? null,
    })
    .select()
    .single();

  if (error) {
    console.warn("createQuestion:", error.message);
    return null;
  }
  return mapQuestionRow(data as LooseRow);
}

export async function updateQuestion(
  id: string,
  patch: Partial<CreateQuestionInput>,
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const update: Record<string, unknown> = {};
  if (patch.section !== undefined) update.section = patch.section;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.ruleHint !== undefined) update.rule_hint = patch.ruleHint;
  if (patch.ruleUygunsuz !== undefined) update.rule_uygunsuz = patch.ruleUygunsuz;
  if (patch.ruleKritik !== undefined) update.rule_kritik = patch.ruleKritik;
  if (patch.suggestedActionTitle !== undefined) update.suggested_action_title = patch.suggestedActionTitle;
  if (patch.suggestedActionDescription !== undefined) update.suggested_action_description = patch.suggestedActionDescription;
  if (patch.sourceBadges !== undefined) update.source_badges = patch.sourceBadges;
  if (patch.whySuggested !== undefined) update.why_suggested = patch.whySuggested;
  if (patch.linkedRiskHint !== undefined) update.linked_risk_hint = patch.linkedRiskHint;
  if (patch.openActionHint !== undefined) update.open_action_hint = patch.openActionHint;

  const { error } = await supabase.from("inspection_checklist_questions").update(update).eq("id", id);
  if (error) {
    console.warn("updateQuestion:", error.message);
    return false;
  }
  return true;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("inspection_checklist_questions").delete().eq("id", id);
  if (error) {
    console.warn("deleteQuestion:", error.message);
    return false;
  }
  return true;
}

export async function reorderQuestions(
  templateId: string,
  orderedQuestionIds: string[],
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const updates = orderedQuestionIds.map((qid, index) =>
    supabase
      .from("inspection_checklist_questions")
      .update({ sort_order: index })
      .eq("id", qid)
      .eq("template_id", templateId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.warn("reorderQuestions:", failed.error.message);
    return false;
  }
  return true;
}

export async function insertQuestionsBulk(
  templateId: string,
  questions: Omit<CreateQuestionInput, "templateId">[],
): Promise<ChecklistQuestionRecord[]> {
  if (questions.length === 0) return [];
  const supabase = createClient();
  if (!supabase) return [];

  const rows = questions.map((q, index) => ({
    template_id: templateId,
    section: q.section,
    category: q.category,
    text: q.text,
    priority: q.priority ?? "medium",
    sort_order: q.sortOrder ?? index,
    rule_hint: q.ruleHint ?? null,
    rule_uygunsuz: q.ruleUygunsuz ?? null,
    rule_kritik: q.ruleKritik ?? null,
    suggested_action_title: q.suggestedActionTitle ?? null,
    suggested_action_description: q.suggestedActionDescription ?? null,
    source_badges: q.sourceBadges ?? [],
    why_suggested: q.whySuggested ?? null,
    linked_risk_hint: q.linkedRiskHint ?? null,
    open_action_hint: q.openActionHint ?? null,
  }));

  const { data, error } = await supabase
    .from("inspection_checklist_questions")
    .insert(rows)
    .select();

  if (error) {
    console.warn("insertQuestionsBulk:", error.message);
    return [];
  }
  return (data ?? []).map(mapQuestionRow);
}

// -----------------------------------------------------------------------------
// STARTER PACK — ilk açılış için 6 hazır şablon + 10 soru seed'i
// -----------------------------------------------------------------------------
// Idempotent: org'da zaten starter pack metadata flag varsa tekrar yüklemez.
// Kullanıcı kendi org'unun checklist kütüphanesini kurmak için 1 kez çağırır.

export type SeedStarterResult = {
  created: number;
  skipped: boolean;
  reason?: string;
};

export async function hasStarterPack(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const auth = await resolveOrganizationId();
  if (!auth) return false;

  const { data, error } = await supabase
    .from("inspection_checklist_templates")
    .select("id")
    .eq("organization_id", auth.orgId)
    .contains("metadata", { starter_pack_version: 1 })
    .limit(1);
  if (error) {
    console.warn("hasStarterPack:", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

export async function seedStarterTemplates(opts?: {
  companyWorkspaceId?: string | null;
}): Promise<SeedStarterResult> {
  const supabase = createClient();
  if (!supabase) return { created: 0, skipped: true, reason: "no_client" };
  const auth = await resolveOrganizationId();
  if (!auth) return { created: 0, skipped: true, reason: "no_auth" };

  const already = await hasStarterPack();
  if (already) return { created: 0, skipped: true, reason: "already_seeded" };

  const { QUESTION_SEEDS, STARTER_TEMPLATES, STARTER_PACK_VERSION } = await import(
    "@/app/(protected)/score-history/_data/starter-templates"
  );

  let created = 0;
  for (const tmpl of STARTER_TEMPLATES) {
    const { data: insertedTmpl, error: tmplErr } = await supabase
      .from("inspection_checklist_templates")
      .insert({
        organization_id: auth.orgId,
        company_workspace_id: opts?.companyWorkspaceId ?? null,
        title: tmpl.title,
        description: tmpl.description,
        source: "library",
        mode: tmpl.mode,
        status: "published",
        nova_sources: {},
        metadata: {
          starter_pack_version: STARTER_PACK_VERSION,
          starter_slug: tmpl.slug,
          seeded_at: new Date().toISOString(),
        },
        created_by: auth.userId,
      })
      .select("id")
      .single();

    if (tmplErr || !insertedTmpl) {
      console.warn("seedStarterTemplates template:", tmplErr?.message);
      continue;
    }

    const questionRows = tmpl.questionIndexes.map((idx, order) => {
      const seed = QUESTION_SEEDS[idx];
      return {
        template_id: insertedTmpl.id as string,
        sort_order: order,
        section: seed.section,
        category: seed.category,
        text: seed.text,
        priority: seed.priority ?? "medium",
        rule_hint: seed.ruleHint ?? null,
        rule_uygunsuz: seed.ruleUygunsuz ?? null,
        rule_kritik: seed.ruleKritik ?? null,
        suggested_action_title: seed.suggestedActionTitle ?? null,
        suggested_action_description: seed.suggestedActionDescription ?? null,
        source_badges: ["Başlangıç paketi"],
        why_suggested: seed.whySuggested ?? null,
        linked_risk_hint: seed.linkedRiskHint ?? null,
        open_action_hint: seed.openActionHint ?? null,
      };
    });

    const { error: qErr } = await supabase
      .from("inspection_checklist_questions")
      .insert(questionRows);
    if (qErr) {
      console.warn(`seedStarterTemplates questions (${tmpl.slug}):`, qErr.message);
      continue;
    }
    created += 1;
  }

  return { created, skipped: false };
}
