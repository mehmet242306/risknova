import Anthropic from "@anthropic-ai/sdk";
import {
  invokeNovaActionExecutor,
  loadNovaActionRunForExecution,
  resolveNovaExecutionContext,
} from "@/lib/nova/action-endpoint";
import { recordNovaOutboxEvent } from "@/lib/nova/governance";
import { createServiceClient } from "@/lib/security/server";
import { runSnapshotBackup } from "@/lib/self-healing/backup";
import { runSelfHealingHealthChecks } from "@/lib/self-healing/health";

type TaskQueueRow = {
  id: string;
  task_type: string;
  payload: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
  organization_id: string | null;
  company_workspace_id: string | null;
};

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function completeTask(taskId: string, result: Record<string, unknown>) {
  const supabase = createServiceClient();
  await supabase.rpc("complete_task_queue", {
    p_task_id: taskId,
    p_result: result,
  });
}

async function failTask(taskId: string, message: string, retryDelaySeconds = 60) {
  const supabase = createServiceClient();
  await supabase.rpc("fail_task_queue", {
    p_task_id: taskId,
    p_error_message: message,
    p_retry_delay_seconds: retryDelaySeconds,
  });
}

async function updateNovaOutboxForTask(
  task: TaskQueueRow,
  patch: Record<string, unknown>,
) {
  if (task.task_type !== "nova.action.execute") return;

  const supabase = createServiceClient();
  const actionRunId = String(task.payload?.action_run_id ?? "").trim();
  if (!actionRunId) return;

  await supabase
    .from("nova_outbox")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("action_run_id", actionRunId);
}

async function reclaimStuckTasks() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("task_queue")
    .update({
      status: "pending",
      locked_by: null,
      processing_started_at: null,
      scheduled_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt(
      "processing_started_at",
      new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    )
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return {
    reclaimed: (data ?? []).length,
  };
}

async function processTrainingGeneration(task: TaskQueueRow) {
  if (!anthropicClient) {
    throw new Error("ANTHROPIC_API_KEY tanimli degil.");
  }

  const topic = String(task.payload?.topic ?? "").trim();
  const questionCount = Number(task.payload?.questionCount ?? 10);
  const optionCount = Number(task.payload?.optionCount ?? 4);
  const type = String(task.payload?.type ?? "exam");
  const description = String(task.payload?.description ?? "");

  if (!topic) {
    throw new Error("Eksik training queue payload: topic");
  }

  const prompt = `Sen ISG egitim uzmanisin. Asagidaki konu icin ${type === "exam" ? "sinav sorulari" : "anket sorulari"} olustur.

KONU: ${topic}
${description ? `ACIKLAMA: ${description}` : ""}
SORU SAYISI: ${questionCount}
${type === "exam" ? `SIK SAYISI: ${optionCount}` : ""}

Sadece JSON dizisi dondur.`;

  const message = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI queue yanitindan soru JSON'u cikarilamadi.");
  }

  const questions = JSON.parse(jsonMatch[0]);
  await completeTask(task.id, {
    topic,
    type,
    questions,
    usage: message.usage,
  });
}

async function processDocumentGeneration(task: TaskQueueRow) {
  if (!anthropicClient) {
    throw new Error("ANTHROPIC_API_KEY tanimli degil.");
  }

  const prompt = String(task.payload?.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("Eksik document queue payload: prompt");
  }

  const companyName = String(task.payload?.companyName ?? "");
  const companyData = (task.payload?.companyData ?? {}) as Record<string, unknown>;
  const documentTitle = String(task.payload?.documentTitle ?? "");
  const groupKey = String(task.payload?.groupKey ?? "");

  let contextInfo = "\n\nFIRMA BILGILERI:\n";
  if (companyName) contextInfo += `- Firma Adi: ${companyName}\n`;
  for (const [key, value] of Object.entries(companyData)) {
    if (value) contextInfo += `- ${key}: ${String(value)}\n`;
  }
  if (documentTitle) contextInfo += `\nDOKUMAN BASLIGI: ${documentTitle}\n`;
  if (groupKey) contextInfo += `DOKUMAN KATEGORISI: ${groupKey}\n`;

  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: `${contextInfo}\n\nISTEK:\n${prompt}` }],
  });

  const textBlock = response.content.find((item) => item.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Document queue icin AI metin uretmedi.");
  }

  await completeTask(task.id, {
    content: textBlock.text,
    usage: response.usage,
  });
}

async function processNovaActionExecution(task: TaskQueueRow) {
  const actionRunId = String(task.payload?.action_run_id ?? "").trim();
  const userId = String(task.payload?.user_id ?? task.created_by ?? "").trim();
  const organizationId = String(task.payload?.organization_id ?? task.organization_id ?? "").trim();
  const contextSurface =
    task.payload?.context_surface === "widget" ? "widget" : "solution_center";
  const idempotencyKey = String(task.payload?.idempotency_key ?? "").trim();

  if (!actionRunId || !userId || !organizationId || !idempotencyKey) {
    throw new Error("Eksik Nova action queue payload.");
  }

  await updateNovaOutboxForTask(task, {
    status: "processing",
    retry_count: task.retry_count,
    max_retries: task.max_retries,
    last_attempt_at: new Date().toISOString(),
    last_error: null,
    task_queue_id: task.id,
  });

  const actionRun = await loadNovaActionRunForExecution(actionRunId);
  if (!actionRun) {
    await updateNovaOutboxForTask(task, {
      status: "dead_letter",
      retry_count: task.retry_count,
      last_error: "action_run_missing",
      completed_at: new Date().toISOString(),
    });
    await completeTask(task.id, {
      actionRunId,
      status: "skipped",
      reason: "action_run_missing",
    });
    return;
  }

  if (
    actionRun.status === "completed" ||
    actionRun.status === "cancelled" ||
    actionRun.status === "failed"
  ) {
    await updateNovaOutboxForTask(task, {
      status: actionRun.status === "completed" ? "succeeded" : actionRun.status,
      retry_count: task.retry_count,
      completed_at: new Date().toISOString(),
    });
    await completeTask(task.id, {
      actionRunId,
      status: actionRun.status,
      reason: "already_terminal",
    });
    return;
  }

  const executionContext = await resolveNovaExecutionContext(userId);
  const execution = await invokeNovaActionExecutor({
    actionRun,
    userId,
    organizationId,
    workspaceId: executionContext.workspaceId,
    jurisdictionCode: executionContext.jurisdictionCode,
    accessToken: executionContext.accessToken,
    internalServiceSecret: executionContext.internalServiceSecret,
    confirmationAction: "confirm",
    contextSurface,
    idempotencyKey,
  });

  if (execution.status >= 500) {
    throw new Error(
      typeof execution.payload.answer === "string" && execution.payload.answer
        ? execution.payload.answer
        : "Nova queue execution gecici hata verdi.",
    );
  }

  await updateNovaOutboxForTask(task, {
    status: "succeeded",
    retry_count: task.retry_count,
    completed_at: new Date().toISOString(),
    last_error: null,
  });
  await recordNovaOutboxEvent({
    actionRunId,
    taskQueueId: task.id,
    actorUserId: task.created_by,
    eventType: "worker_succeeded",
    message: "Nova queue worker aksiyonu basariyla tamamladi.",
    metadata: {
      task_type: task.task_type,
      retry_count: task.retry_count,
    },
  }).catch(() => undefined);

  await completeTask(task.id, {
    actionRunId,
    status: execution.status,
    responseType: execution.payload.type,
    executionStatus:
      typeof execution.payload.action_hint === "object" &&
      execution.payload.action_hint &&
      "execution_status" in execution.payload.action_hint
        ? execution.payload.action_hint.execution_status
        : null,
  });
}

async function processTask(task: TaskQueueRow) {
  switch (task.task_type) {
    case "health.run": {
      const result = await runSelfHealingHealthChecks({
        mode: "queued",
        createdBy: task.created_by,
      });
      await completeTask(task.id, result);
      return;
    }
    case "backup.snapshot": {
      const result = await runSnapshotBackup({
        backupType: String(task.payload?.backupType ?? "queued_snapshot"),
        initiatedBy: task.created_by,
        initiatedByName: String(task.payload?.initiatedByName ?? "Queue Worker"),
        source: "queued",
      });
      await completeTask(task.id, result);
      return;
    }
    case "system.recovery.reclaim_stuck": {
      const result = await reclaimStuckTasks();
      await completeTask(task.id, result);
      return;
    }
    case "ai.training.generate": {
      await processTrainingGeneration(task);
      return;
    }
    case "ai.document.generate": {
      await processDocumentGeneration(task);
      return;
    }
    case "nova.action.execute": {
      await processNovaActionExecution(task);
      return;
    }
    default:
      throw new Error(`Desteklenmeyen queue task: ${task.task_type}`);
  }
}

export async function processSelfHealingQueue(options?: {
  batchSize?: number;
  workerId?: string;
}) {
  const supabase = createServiceClient();
  const batchSize = options?.batchSize ?? 5;
  const workerId = options?.workerId ?? "self-healing-worker";

  const { data, error } = await supabase.rpc("claim_task_queue", {
    p_batch_size: batchSize,
    p_worker_id: workerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const tasks = (data ?? []) as TaskQueueRow[];
  const results: Array<Record<string, unknown>> = [];

  for (const task of tasks) {
    try {
      await processTask(task);
      results.push({
        taskId: task.id,
        taskType: task.task_type,
        status: "completed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen queue hatasi";
      const isDeadLetter = task.retry_count + 1 >= task.max_retries;
      await updateNovaOutboxForTask(task, {
        status: isDeadLetter ? "dead_letter" : "failed",
        retry_count: task.retry_count + 1,
        last_error: message,
        completed_at: isDeadLetter ? new Date().toISOString() : null,
        last_attempt_at: new Date().toISOString(),
      });
      if (task.task_type === "nova.action.execute") {
        const actionRunId = String(task.payload?.action_run_id ?? "").trim();
        if (actionRunId) {
          await recordNovaOutboxEvent({
            actionRunId,
            taskQueueId: task.id,
            actorUserId: task.created_by,
            eventType: isDeadLetter ? "worker_dead_letter" : "worker_failed",
            message,
            metadata: {
              task_type: task.task_type,
              retry_count: task.retry_count + 1,
              max_retries: task.max_retries,
            },
          }).catch(() => undefined);
        }
      }
      await failTask(task.id, message, 60 * (task.retry_count + 1));
      results.push({
        taskId: task.id,
        taskType: task.task_type,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    processed: tasks.length,
    results,
  };
}
