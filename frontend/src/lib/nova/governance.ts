import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/security/server";

export type NovaFeatureKey =
  | "nova.agent.chat"
  | "nova.agent.confirmations"
  | "nova.agent.async_execution"
  | "nova.agent.benchmarks";

function isMissingRelationError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? error ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("42p01");
}

type NovaFeatureFlagRow = {
  id: string;
  feature_key: string;
  organization_id: string | null;
  workspace_id: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  config: Record<string, unknown> | null;
};

type AssertNovaFeatureEnabledParams = {
  featureKey: NovaFeatureKey;
  userId: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  fallbackMessage: string;
  status?: number;
};

type NovaOutboxEventParams = {
  outboxId?: string | null;
  actionRunId: string;
  taskQueueId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

type NovaEvalRunInsert = {
  suite_key: string;
  case_key: string;
  category: string;
  organization_id?: string | null;
  workspace_id?: string | null;
  session_id?: string | null;
  action_run_id?: string | null;
  executed_by?: string | null;
  score: number;
  passed: boolean;
  latency_ms?: number | null;
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  failure_reason?: string | null;
  metadata?: Record<string, unknown>;
};

export function getRolloutBucket(identity: string) {
  const digest = createHash("sha256").update(identity).digest("hex");
  const numeric = Number.parseInt(digest.slice(0, 8), 16);
  return numeric % 100;
}

function rankFeatureFlag(row: NovaFeatureFlagRow) {
  if (row.workspace_id) return 3;
  if (row.organization_id) return 2;
  return 1;
}

export function resolveFeatureFlag(
  rows: readonly NovaFeatureFlagRow[],
  params: {
    featureKey: string;
    organizationId?: string | null;
    workspaceId?: string | null;
  },
) {
  const matches = rows
    .filter((row) => row.feature_key === params.featureKey)
    .filter((row) => {
      if (row.workspace_id && row.workspace_id !== params.workspaceId) return false;
      if (!row.workspace_id && row.organization_id && row.organization_id !== params.organizationId) {
        return false;
      }
      return true;
    })
    .sort((left, right) => rankFeatureFlag(right) - rankFeatureFlag(left));

  return matches[0] ?? null;
}

export async function getNovaFeatureGate(params: {
  featureKey: NovaFeatureKey;
  userId: string;
  organizationId?: string | null;
  workspaceId?: string | null;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("nova_feature_flags")
    .select("id, feature_key, organization_id, workspace_id, is_enabled, rollout_percentage, config")
    .eq("feature_key", params.featureKey);

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        enabled: true,
        source: "default" as const,
        rolloutPercentage: 100,
        config: {},
        bucket: getRolloutBucket(`${params.featureKey}:${params.userId}`),
      };
    }
    throw new Error(error.message);
  }

  const flag = resolveFeatureFlag((data ?? []) as NovaFeatureFlagRow[], params);
  if (!flag) {
    return {
      enabled: true,
      source: "default" as const,
      rolloutPercentage: 100,
      config: {},
      bucket: getRolloutBucket(`${params.featureKey}:${params.userId}`),
    };
  }

  const bucket = getRolloutBucket(`${params.featureKey}:${params.userId}`);
  const enabled =
    flag.is_enabled &&
    bucket < Math.max(0, Math.min(100, Number(flag.rollout_percentage ?? 100)));

  return {
    enabled,
    source: flag.workspace_id
      ? ("workspace" as const)
      : flag.organization_id
        ? ("organization" as const)
        : ("global" as const),
    rolloutPercentage: flag.rollout_percentage,
    config: flag.config ?? {},
    bucket,
    flagId: flag.id,
  };
}

export async function assertNovaFeatureEnabled(params: AssertNovaFeatureEnabledParams) {
  const gate = await getNovaFeatureGate(params);
  if (gate.enabled) {
    return null;
  }

  return NextResponse.json(
    {
      type: "safety_block",
      answer: params.fallbackMessage,
      safety_block: {
        code: "nova_feature_disabled",
        title: "Nova rollout kapali",
        message: params.fallbackMessage,
      },
      telemetry: {
        feature_key: params.featureKey,
        rollout_percentage: gate.rolloutPercentage,
        rollout_bucket: gate.bucket,
        rollout_source: gate.source,
      },
    },
    { status: params.status ?? 503 },
  );
}

export async function recordNovaOutboxEvent(params: NovaOutboxEventParams) {
  const supabase = createServiceClient();
  let outboxId = params.outboxId ?? null;

  if (!outboxId) {
    const { data, error } = await supabase
      .from("nova_outbox")
      .select("id")
      .eq("action_run_id", params.actionRunId)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return;
      }
      throw new Error(error.message);
    }

    outboxId = data?.id ?? null;
  }

  if (!outboxId) {
    return;
  }

  const { error } = await supabase.from("nova_outbox_events").insert({
    outbox_id: outboxId,
    action_run_id: params.actionRunId,
    task_queue_id: params.taskQueueId ?? null,
    actor_user_id: params.actorUserId ?? null,
    event_type: params.eventType,
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    if (isMissingRelationError(error)) {
      return;
    }
    throw new Error(error.message);
  }
}

export async function recordNovaEvalRuns(rows: NovaEvalRunInsert[]) {
  if (rows.length === 0) return;
  const supabase = createServiceClient();
  const { error } = await supabase.from("nova_eval_runs").insert(
    rows.map((row) => ({
      suite_key: row.suite_key,
      case_key: row.case_key,
      category: row.category,
      organization_id: row.organization_id ?? null,
      workspace_id: row.workspace_id ?? null,
      session_id: row.session_id ?? null,
      action_run_id: row.action_run_id ?? null,
      executed_by: row.executed_by ?? null,
      score: Number(row.score.toFixed(2)),
      passed: row.passed,
      latency_ms: row.latency_ms ?? null,
      request_payload: row.request_payload ?? {},
      response_payload: row.response_payload ?? {},
      failure_reason: row.failure_reason ?? null,
      metadata: row.metadata ?? {},
    })),
  );

  if (error) {
    if (isMissingRelationError(error)) {
      return;
    }
    throw new Error(error.message);
  }
}

export function createReplayIdempotencyKey() {
  return randomUUID();
}
