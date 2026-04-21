import { z } from "zod";

export type RiskClass = "read" | "draft" | "mutate_low" | "mutate_high" | "external";

export type AgentActionDef<T extends z.ZodTypeAny> = {
  name: string;
  description: string;
  permissionCode: string;
  requiresConfirmation: boolean;
  riskClass: RiskClass;
  inputSchema: T;
  uiSurfaceHints: Array<"widget" | "solution_center">;
  telemetryKey: string;
};

export type NovaAgentSource = {
  doc_title?: string;
  doc_type?: string;
  doc_number?: string;
  law?: string;
  article?: string;
  article_number?: string;
  article_title?: string;
  title?: string;
  citation_id?: string | null;
  corpus_scope?: "official" | "tenant_private" | null;
  jurisdiction_code?: string | null;
};

export type NovaAgentNavigation = {
  action: "navigate";
  url: string;
  label: string;
  reason: string;
  destination: string;
  auto_navigate: boolean;
};

export type NovaAgentToolPreview = {
  toolName: string;
  title: string;
  summary: string;
  riskClass: RiskClass;
  requiresConfirmation: boolean;
  actionSurface: "read" | "draft";
};

export type NovaActionHint = {
  action_run_id?: string | null;
  action_name?: string | null;
  action_title?: string | null;
  action_summary?: string | null;
  summary?: string | null;
  confirmation_prompt?: string | null;
  idempotent_replay?: boolean;
  execution_status?:
    | "pending_confirmation"
    | "queued"
    | "processing"
    | "completed"
    | "cancelled"
    | "failed"
    | null;
  queue_task_id?: string | null;
};

export type NovaDraftPayload = {
  kind: "incident" | "document" | "training_plan" | "workflow" | "summary";
  title: string;
  summary?: string | null;
};

export type NovaSafetyBlock = {
  code: string;
  title: string;
  message: string;
};

export type NovaAgentResponseType =
  | "message"
  | "tool_preview"
  | "draft_ready"
  | "workflow_started"
  | "safety_block";

export type NovaAgentResponse = {
  type: NovaAgentResponseType;
  answer: string;
  session_id?: string | null;
  query_id?: string | null;
  retrieval_run_id?: string | null;
  as_of_date?: string | null;
  answer_mode?: "extractive" | "polish";
  jurisdiction_code?: string | null;
  cached?: boolean;
  sources?: NovaAgentSource[];
  navigation?: NovaAgentNavigation | null;
  workflow?: Record<string, unknown> | null;
  follow_up_actions?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  action_hint?: NovaActionHint | string | null;
  tool_preview?: NovaAgentToolPreview | null;
  draft?: NovaDraftPayload | null;
  safety_block?: NovaSafetyBlock | null;
  telemetry?: Record<string, unknown> | null;
};

export const novaChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  language: z.string().min(2).max(10).optional().default("tr"),
  session_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  company_workspace_id: z.string().uuid().nullable().optional(),
  jurisdiction_code: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  answer_mode: z.enum(["extractive", "polish"]).optional().default("extractive"),
  access_token: z.string().min(20).nullable().optional(),
  mode: z.enum(["read", "agent"]).optional().default("agent"),
  context_surface: z.enum(["widget", "solution_center"]).optional().default("solution_center"),
  confirmation_token: z.string().uuid().nullable().optional(),
  current_page: z.string().max(512).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

export type NovaChatRequest = z.infer<typeof novaChatRequestSchema>;

export const actionCatalog = {
  navigate_to_page: {
    name: "navigate_to_page",
    description: "Kullaniciyi ilgili sayfaya yonlendirir.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "read",
    inputSchema: z.object({
      url: z.string().min(1).max(512),
      label: z.string().min(1).max(180),
    }),
    uiSurfaceHints: ["widget", "solution_center"],
    telemetryKey: "navigate_to_page",
  },
  open_filtered_view: {
    name: "open_filtered_view",
    description: "Kullaniciyi filtre uygulanmis bir liste veya panele goturur.",
    permissionCode: "ai.use",
      requiresConfirmation: false,
      riskClass: "read",
      inputSchema: z.object({
        route: z.string().min(1).max(256),
        query: z.record(z.string(), z.string()).optional(),
      }),
      uiSurfaceHints: ["widget", "solution_center"],
      telemetryKey: "open_filtered_view",
  },
  summarize_records: {
    name: "summarize_records",
    description: "Var olan kayitlari ve acik operasyon adimlarini ozetler.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "read",
    inputSchema: z.object({
      scope: z.enum(["workspace", "incidents", "planner", "documents", "mixed"]),
    }),
    uiSurfaceHints: ["widget", "solution_center"],
    telemetryKey: "summarize_records",
  },
  legal_research_answer: {
    name: "legal_research_answer",
    description: "Kaynakli ve kapsam kontrollu mevzuat cevabi uretir.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "read",
    inputSchema: z.object({
      jurisdictionCode: z.string().regex(/^[A-Z]{2}$/),
      answerMode: z.enum(["extractive", "polish"]),
    }),
    uiSurfaceHints: ["widget", "solution_center"],
    telemetryKey: "legal_research_answer",
  },
  draft_incident: {
    name: "draft_incident",
    description: "Olay kaydi icin taslak veya takip akisi hazirlar.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "draft",
    inputSchema: z.object({
      title: z.string().min(1).max(180).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    }),
    uiSurfaceHints: ["widget", "solution_center"],
    telemetryKey: "draft_incident",
  },
  draft_document: {
    name: "draft_document",
    description: "Editor veya mevzuat temelli bir dokuman taslagi hazirlar.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "draft",
    inputSchema: z.object({
      title: z.string().min(1).max(180).optional(),
      docType: z.string().max(64).optional(),
    }),
    uiSurfaceHints: ["solution_center"],
    telemetryKey: "draft_document",
  },
  draft_training_or_task_plan: {
    name: "draft_training_or_task_plan",
    description: "Egitim veya operasyon gorevi icin taslak plan olusturur.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "draft",
    inputSchema: z.object({
      title: z.string().min(1).max(180).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
    uiSurfaceHints: ["widget", "solution_center"],
    telemetryKey: "draft_training_or_task_plan",
  },
  build_followup_workflow: {
    name: "build_followup_workflow",
    description: "Takip edilmesi gereken adimlari workflow olarak sekillendirir.",
    permissionCode: "ai.use",
    requiresConfirmation: false,
    riskClass: "draft",
    inputSchema: z.object({
      title: z.string().min(1).max(180).optional(),
      totalSteps: z.number().int().min(1).max(12).optional(),
    }),
    uiSurfaceHints: ["solution_center"],
    telemetryKey: "build_followup_workflow",
  },
} satisfies Record<string, AgentActionDef<z.ZodTypeAny>>;

const defaultSafetyBlock: NovaSafetyBlock = {
  code: "nova_unavailable",
  title: "Nova kullanilamiyor",
  message: "Nova bu istegi su anda tamamlayamadi.",
};

export function normalizeNovaAgentResponse(raw: Record<string, unknown>): NovaAgentResponse {
  const answer =
    typeof raw.answer === "string"
      ? raw.answer
      : typeof raw.response === "string"
        ? raw.response
        : typeof raw.message === "string"
          ? raw.message
          : defaultSafetyBlock.message;

  const sources = Array.isArray(raw.sources) ? (raw.sources as NovaAgentSource[]) : [];
  const followUpActions = Array.isArray(raw.follow_up_actions)
    ? (raw.follow_up_actions as Array<Record<string, unknown>>)
    : [];
  const documents = Array.isArray(raw.documents)
    ? (raw.documents as Array<Record<string, unknown>>)
    : [];
  const navigation =
    raw.navigation && typeof raw.navigation === "object"
      ? (raw.navigation as NovaAgentNavigation)
      : null;
  const workflow =
    raw.workflow && typeof raw.workflow === "object"
      ? (raw.workflow as Record<string, unknown>)
      : null;

  let type: NovaAgentResponseType =
    raw.type === "tool_preview" ||
    raw.type === "draft_ready" ||
    raw.type === "workflow_started" ||
    raw.type === "safety_block"
      ? (raw.type as NovaAgentResponseType)
      : "message";

  let toolPreview: NovaAgentToolPreview | null = null;
  let draft: NovaDraftPayload | null = null;
  const actionHint =
    raw.action_hint && typeof raw.action_hint === "object"
      ? (raw.action_hint as NovaActionHint)
      : typeof raw.action_hint === "string"
        ? raw.action_hint
        : null;

  if (!toolPreview && navigation) {
    toolPreview = {
      toolName: "navigate_to_page",
      title: navigation.label,
      summary: navigation.reason,
      riskClass: "read",
      requiresConfirmation: false,
      actionSurface: "read",
    };
    type = type === "message" ? "tool_preview" : type;
  }

  if (!toolPreview && followUpActions.length > 0) {
    const first = followUpActions[0];
    toolPreview = {
      toolName:
        typeof first.kind === "string" && first.kind === "prompt"
          ? "build_followup_workflow"
          : "open_filtered_view",
      title: typeof first.label === "string" ? first.label : "Nova action",
      summary:
        typeof first.description === "string"
          ? first.description
          : "Nova ilgili sonraki adimi hazirladi.",
      riskClass: "read",
      requiresConfirmation: false,
      actionSurface: "read",
    };
    type = type === "message" ? "tool_preview" : type;
  }

  if (!draft && documents.length > 0) {
    const firstDoc = documents[0];
    draft = {
      kind: "document",
      title:
        typeof firstDoc.title === "string" ? firstDoc.title : "Nova dokuman taslagi",
      summary: answer,
    };
    type = "draft_ready";
  }

  if (!toolPreview && actionHint && typeof actionHint === "object") {
    const executionStatus =
      actionHint.execution_status === "queued" ||
      actionHint.execution_status === "processing" ||
      actionHint.execution_status === "completed" ||
      actionHint.execution_status === "cancelled" ||
      actionHint.execution_status === "failed" ||
      actionHint.execution_status === "pending_confirmation"
        ? actionHint.execution_status
        : "pending_confirmation";
    toolPreview = {
      toolName:
        typeof actionHint.action_name === "string"
          ? actionHint.action_name
          : "build_followup_workflow",
      title:
        typeof actionHint.action_title === "string"
          ? actionHint.action_title
          : "Nova aksiyon hazirladi",
      summary:
        typeof actionHint.action_summary === "string"
          ? actionHint.action_summary
          : typeof actionHint.summary === "string"
            ? actionHint.summary
            : "Nova bu istek icin kontrollu bir sonraki adim hazirladi.",
      riskClass: "draft",
      requiresConfirmation: executionStatus === "pending_confirmation",
      actionSurface: "draft",
    };
    type = type === "message" ? "tool_preview" : type;
  }

  if (!draft && typeof actionHint === "string") {
    if (actionHint.includes("incident")) {
      draft = { kind: "incident", title: "Olay taslagi", summary: answer };
      type = "draft_ready";
    } else if (actionHint.includes("training") || actionHint.includes("planner")) {
      draft = { kind: "training_plan", title: "Plan taslagi", summary: answer };
      type = "draft_ready";
    }
  }

  if (workflow && type === "message") {
    type = "workflow_started";
  }

  const safetyBlock =
    raw.safety_block && typeof raw.safety_block === "object"
      ? (raw.safety_block as NovaSafetyBlock)
      : null;

  return {
    type,
    answer,
    session_id: typeof raw.session_id === "string" ? raw.session_id : null,
    query_id: typeof raw.query_id === "string" ? raw.query_id : null,
    retrieval_run_id:
      typeof raw.retrieval_run_id === "string" ? raw.retrieval_run_id : null,
    as_of_date: typeof raw.as_of_date === "string" ? raw.as_of_date : null,
    answer_mode:
      raw.answer_mode === "extractive" || raw.answer_mode === "polish"
        ? raw.answer_mode
        : undefined,
    jurisdiction_code:
      typeof raw.jurisdiction_code === "string" ? raw.jurisdiction_code : null,
    cached: raw.cached === true,
    sources,
    navigation,
    workflow,
    follow_up_actions: followUpActions,
    documents,
    action_hint: actionHint,
    tool_preview: toolPreview,
    draft,
    safety_block: safetyBlock,
    telemetry:
      raw.telemetry && typeof raw.telemetry === "object"
        ? (raw.telemetry as Record<string, unknown>)
        : null,
  };
}
