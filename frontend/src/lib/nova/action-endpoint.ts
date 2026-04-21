import { z } from "zod";
import { createServiceClient } from "@/lib/security/server";
import { recordNovaOutboxEvent } from "@/lib/nova/governance";
import { normalizeNovaAgentResponse, type NovaAgentResponse } from "@/lib/nova/agent";

export const novaActionConfirmSchema = z.object({
  idempotency_key: z.string().uuid(),
  context_surface: z.enum(["widget", "solution_center"]).optional().default("solution_center"),
});

export const novaActionCancelSchema = z.object({
  reason: z.string().max(500).optional(),
  context_surface: z.enum(["widget", "solution_center"]).optional().default("solution_center"),
});

export type NovaStoredActionRun = {
  id: string;
  user_id: string;
  organization_id: string | null;
  company_workspace_id: string | null;
  session_id: string;
  action_name: string;
  action_title: string;
  action_summary: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "failed" | "expired";
  language: "tr" | "en";
  result_snapshot: Record<string, unknown> | null;
  executed_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
};

function getActionLanguage(actionRun: Pick<NovaStoredActionRun, "language">) {
  return actionRun.language === "en" ? "en" : "tr";
}

function getActionSummary(actionRun: Pick<NovaStoredActionRun, "action_summary" | "action_title">) {
  return actionRun.action_summary?.trim() || actionRun.action_title;
}

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL tanimli degil.");
  }
  return value.replace(/\/+$/, "");
}

function getPublishableKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY veya NEXT_PUBLIC_SUPABASE_ANON_KEY tanimli degil.",
    );
  }

  return value;
}

function resolveWorkspaceCountryCode(
  rawWorkspace:
    | { country_code?: string | null }
    | { country_code?: string | null }[]
    | null
    | undefined,
) {
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;
  return workspace?.country_code ?? "TR";
}

async function resolveWorkspaceFallback(userId: string) {
  const client = createServiceClient();
  const { data } = await client
    .from("nova_workspace_members")
    .select(
      `
      workspace:nova_workspaces!inner (
        id,
        country_code
      )
    `,
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = data as
    | {
        workspace?:
          | { id?: string | null; country_code?: string | null }
          | { id?: string | null; country_code?: string | null }[]
          | null;
      }
    | null;

  const rawWorkspace = row?.workspace as
    | { id?: string | null; country_code?: string | null }
    | { id?: string | null; country_code?: string | null }[]
    | null
    | undefined;
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;

  return {
    workspaceId: workspace?.id ?? null,
    jurisdictionCode: workspace?.country_code ?? "TR",
  };
}

export async function loadNovaActionRunForUser(
  actionRunId: string,
  userId: string,
  organizationId: string,
) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("nova_action_runs")
    .select(`
      id,
      user_id,
      organization_id,
      company_workspace_id,
      session_id,
      action_name,
      action_title,
      action_summary,
      status,
      language,
      result_snapshot,
      executed_at,
      cancelled_at,
      expires_at
    `)
    .eq("id", actionRunId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const actionRun = data as NovaStoredActionRun | null;
  if (!actionRun) return null;
  if (actionRun.organization_id && actionRun.organization_id !== organizationId) {
    return null;
  }

  return actionRun;
}

export async function loadNovaActionRunForExecution(actionRunId: string) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("nova_action_runs")
    .select(`
      id,
      user_id,
      organization_id,
      company_workspace_id,
      session_id,
      action_name,
      action_title,
      action_summary,
      status,
      language,
      result_snapshot,
      executed_at,
      cancelled_at,
      expires_at
    `)
    .eq("id", actionRunId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as NovaStoredActionRun | null) ?? null;
}

export function buildReplayResponse(actionRun: NovaStoredActionRun): NovaAgentResponse {
  const snapshot =
    actionRun.result_snapshot && typeof actionRun.result_snapshot === "object"
      ? actionRun.result_snapshot
      : {};

  return normalizeNovaAgentResponse({
    type: actionRun.status === "failed" ? "safety_block" : "message",
    answer:
      typeof snapshot.summary === "string"
        ? snapshot.summary
        : actionRun.status === "cancelled"
          ? actionRun.language === "en"
            ? `${actionRun.action_title} was already cancelled.`
            : `${actionRun.action_title} zaten iptal edildi.`
          : actionRun.language === "en"
            ? `${actionRun.action_title} was already completed.`
            : `${actionRun.action_title} zaten tamamlandi.`,
    navigation:
      snapshot.navigation && typeof snapshot.navigation === "object" ? snapshot.navigation : null,
    workflow:
      snapshot.workflow && typeof snapshot.workflow === "object" ? snapshot.workflow : null,
    follow_up_actions: Array.isArray(snapshot.follow_up_actions) ? snapshot.follow_up_actions : [],
    action_hint: {
      action_run_id: actionRun.id,
      action_name: actionRun.action_name,
      action_title: actionRun.action_title,
      action_summary: actionRun.action_summary,
      summary:
        typeof snapshot.summary === "string" ? snapshot.summary : actionRun.action_summary,
      idempotent_replay: true,
      execution_status: actionRun.status,
      queue_task_id:
        typeof snapshot.queue_task_id === "string" ? snapshot.queue_task_id : null,
    },
    safety_block:
      actionRun.status === "failed"
        ? {
            code: "nova_action_failed",
            title: actionRun.language === "en" ? "Nova action failed" : "Nova aksiyonu basarisiz",
            message:
              typeof snapshot.error === "string"
                ? snapshot.error
                : actionRun.language === "en"
                  ? "The previous Nova action attempt failed."
                  : "Bir onceki Nova aksiyon denemesi basarisiz oldu.",
          }
        : null,
    telemetry: {
      replayed_status: actionRun.status,
      action_name: actionRun.action_name,
      action_run_id: actionRun.id,
    },
  });
}

export function buildActionStateResponse(actionRun: NovaStoredActionRun): NovaAgentResponse {
  if (
    actionRun.status === "completed" ||
    actionRun.status === "cancelled" ||
    actionRun.status === "failed"
  ) {
    return buildReplayResponse(actionRun);
  }

  const snapshot =
    actionRun.result_snapshot && typeof actionRun.result_snapshot === "object"
      ? actionRun.result_snapshot
      : {};
  const language = getActionLanguage(actionRun);
  const executionStatus =
    actionRun.status === "pending"
      ? "pending_confirmation"
      : snapshot.execution_state === "queued" || snapshot.execution_state === "processing"
        ? snapshot.execution_state
        : "processing";
  const queueTaskId = typeof snapshot.queue_task_id === "string" ? snapshot.queue_task_id : null;
  const answer =
    typeof snapshot.summary === "string"
      ? snapshot.summary
      : executionStatus === "queued"
        ? language === "en"
          ? `${actionRun.action_title} has been queued. Nova will continue this action in the background.`
          : `${actionRun.action_title} kuyruga alindi. Nova bu aksiyonu arka planda surdurecek.`
        : executionStatus === "processing"
          ? language === "en"
            ? `${actionRun.action_title} is being processed in the background.`
            : `${actionRun.action_title} arka planda isleniyor.`
          : language === "en"
            ? `${actionRun.action_title} is waiting for your approval.`
            : `${actionRun.action_title} onayinizi bekliyor.`;

  return normalizeNovaAgentResponse({
    type: executionStatus === "pending_confirmation" ? "tool_preview" : "workflow_started",
    answer,
    workflow:
      executionStatus === "pending_confirmation"
        ? null
        : {
            kind: "nova_action_execution",
            status: executionStatus,
            queue_task_id: queueTaskId,
            action_run_id: actionRun.id,
            title: actionRun.action_title,
          },
    action_hint: {
      action_run_id: actionRun.id,
      action_name: actionRun.action_name,
      action_title: actionRun.action_title,
      action_summary: getActionSummary(actionRun),
      summary: answer,
      execution_status: executionStatus,
      queue_task_id: queueTaskId,
    },
    telemetry: {
      action_name: actionRun.action_name,
      action_run_id: actionRun.id,
      execution_status: executionStatus,
      queue_task_id: queueTaskId,
    },
  });
}

export async function resolveNovaExecutionContext(userId: string) {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(`
      active_workspace_id,
      active_workspace:nova_workspaces!user_profiles_active_workspace_id_fkey (
        country_code
      )
    `)
    .eq("auth_user_id", userId)
    .maybeSingle();

  let workspaceId = profile?.active_workspace_id ?? null;
  let jurisdictionCode = resolveWorkspaceCountryCode(
    profile?.active_workspace as
      | { country_code?: string | null }
      | { country_code?: string | null }[]
      | null
      | undefined,
  );

  if (!workspaceId) {
    const fallback = await resolveWorkspaceFallback(userId);
    workspaceId = fallback.workspaceId;
    jurisdictionCode = fallback.jurisdictionCode;
  }

  return {
    accessToken: null,
    workspaceId,
    jurisdictionCode,
    internalServiceSecret: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
  };
}

export async function queueNovaActionExecution(params: {
  actionRun: NovaStoredActionRun;
  userId: string;
  organizationId: string;
  contextSurface: "widget" | "solution_center";
  idempotencyKey: string;
}) {
  const admin = createServiceClient();

  if (params.actionRun.status === "confirmed") {
    return buildActionStateResponse(params.actionRun);
  }

  const previousSnapshot =
    params.actionRun.result_snapshot && typeof params.actionRun.result_snapshot === "object"
      ? params.actionRun.result_snapshot
      : {};
  const nowIso = new Date().toISOString();

  const { data: queueTaskId, error: queueError } = await admin.rpc("enqueue_task", {
    p_task_type: "nova.action.execute",
    p_payload: {
      action_run_id: params.actionRun.id,
      user_id: params.userId,
      organization_id: params.organizationId,
      context_surface: params.contextSurface,
      idempotency_key: params.idempotencyKey,
    },
    p_scheduled_at: nowIso,
    p_organization_id: params.organizationId,
    p_company_workspace_id: params.actionRun.company_workspace_id,
    p_created_by: params.userId,
    p_priority: 20,
    p_max_retries: 5,
  });

  if (queueError) {
    throw new Error(queueError.message);
  }

  const snapshot = {
    ...(previousSnapshot || {}),
    execution_key: params.idempotencyKey,
    execution_state: "queued",
    queue_task_id: String(queueTaskId),
    queued_at: nowIso,
    summary:
      params.actionRun.language === "en"
        ? `${params.actionRun.action_title} has been queued. Nova will continue it in the background.`
        : `${params.actionRun.action_title} kuyruga alindi. Nova arka planda devam edecek.`,
  };

  const { error: updateError } = await admin
    .from("nova_action_runs")
    .update({
      status: "confirmed",
      confirmed_at: nowIso,
      result_snapshot: snapshot,
      updated_at: nowIso,
    })
    .eq("id", params.actionRun.id)
    .eq("user_id", params.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: outboxError } = await admin
    .from("nova_outbox")
    .upsert(
      {
        action_run_id: params.actionRun.id,
        organization_id: params.organizationId,
        company_workspace_id: params.actionRun.company_workspace_id,
        task_queue_id: String(queueTaskId),
        status: "queued",
        retry_count: 0,
        max_retries: 5,
        payload: {
          action_run_id: params.actionRun.id,
          action_name: params.actionRun.action_name,
          action_title: params.actionRun.action_title,
          context_surface: params.contextSurface,
          idempotency_key: params.idempotencyKey,
        },
        last_attempt_at: null,
        completed_at: null,
      },
      { onConflict: "action_run_id" },
    );

  if (outboxError) {
    throw new Error(outboxError.message);
  }

  await recordNovaOutboxEvent({
    actionRunId: params.actionRun.id,
    taskQueueId: String(queueTaskId),
    actorUserId: params.userId,
    eventType: "queued",
    message:
      params.actionRun.language === "en"
        ? "Nova action was queued for background execution."
        : "Nova aksiyonu arka plan isleyicisine kuyruklandi.",
    metadata: {
      action_name: params.actionRun.action_name,
      context_surface: params.contextSurface,
      idempotency_key: params.idempotencyKey,
    },
  }).catch(() => undefined);

  return buildActionStateResponse({
    ...params.actionRun,
    status: "confirmed",
    result_snapshot: snapshot,
  });
}

export async function invokeNovaActionExecutor(params: {
  actionRun: NovaStoredActionRun;
  userId: string;
  organizationId: string;
  workspaceId: string | null;
  jurisdictionCode: string;
  accessToken: string | null;
  internalServiceSecret: string | null;
  confirmationAction: "confirm" | "cancel";
  contextSurface: "widget" | "solution_center";
  idempotencyKey?: string | null;
  reason?: string | null;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: getPublishableKey(),
  };

  if (params.accessToken) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  } else {
    if (!params.internalServiceSecret) {
      throw new Error("Nova internal auth secret eksik.");
    }
    headers["x-nova-internal-auth"] = params.internalServiceSecret;
    headers["x-nova-user-id"] = params.userId;
    headers["x-nova-organization-id"] = params.organizationId;
  }

  const response = await fetch(`${getSupabaseUrl()}/functions/v1/solution-chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message:
        params.confirmationAction === "cancel"
          ? params.reason || "iptal et"
          : "onayliyorum",
      organization_id: params.organizationId,
      ...(params.workspaceId ? { workspace_id: params.workspaceId } : {}),
      ...(params.actionRun.company_workspace_id
        ? { company_workspace_id: params.actionRun.company_workspace_id }
        : {}),
      jurisdiction_code: params.jurisdictionCode,
      session_id: params.actionRun.session_id,
      language: params.actionRun.language,
      mode: "agent",
      context_surface: params.contextSurface,
      confirmation_token: params.actionRun.id,
      confirmation_action: params.confirmationAction,
      idempotency_key: params.idempotencyKey ?? null,
      history: [],
    }),
    cache: "no-store",
  });

  const rawText = await response.text();
  const parsed = rawText ? JSON.parse(rawText) : {};
  return {
    status: response.status,
    payload: normalizeNovaAgentResponse(parsed),
  };
}
