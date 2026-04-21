import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordNovaOutboxEvent } from "@/lib/nova/governance";
import { requirePermission } from "@/lib/supabase/api-auth";
import { createServiceClient, logSecurityEventWithContext, parseJsonBody } from "@/lib/security/server";

const bodySchema = z.object({
  action: z.enum(["requeue", "cancel"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, "self_healing.manage");
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const supabase = createServiceClient();

  const { data: currentTask, error: taskError } = await supabase
    .from("task_queue")
    .select("id, task_type, status, retry_count, max_retries")
    .eq("id", id)
    .maybeSingle();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!currentTask?.id) {
    return NextResponse.json({ error: "Queue gorevi bulunamadi." }, { status: 404 });
  }

  if (parsed.data.action === "requeue") {
    const { data, error } = await supabase
      .from("task_queue")
      .update({
        status: "pending",
        locked_by: null,
        processing_started_at: null,
        last_attempt_at: null,
        completed_at: null,
        error_message: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: linkedOutbox } = await supabase
      .from("nova_outbox")
      .select("id, action_run_id")
      .eq("task_queue_id", id)
      .maybeSingle();

    if (linkedOutbox?.id) {
      await supabase
        .from("nova_outbox")
        .update({
          status: "queued",
          last_error: null,
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkedOutbox.id);

      await recordNovaOutboxEvent({
        outboxId: linkedOutbox.id,
        actionRunId: linkedOutbox.action_run_id,
        taskQueueId: id,
        actorUserId: auth.userId,
        eventType: "task_requeued",
        message: "Task queue kaydi manuel olarak yeniden kuyruga alindi.",
        metadata: {
          task_type: currentTask.task_type,
        },
      }).catch(() => undefined);
    }

    await logSecurityEventWithContext({
      eventType: "self_healing.queue.requeued",
      userId: auth.userId,
      organizationId: auth.organizationId,
      severity: "info",
      details: {
        taskId: id,
        taskType: currentTask.task_type,
      },
    });

    return NextResponse.json({ ok: true, task: data });
  }

  const { data, error } = await supabase
    .from("task_queue")
    .update({
      status: "cancelled",
      locked_by: null,
      processing_started_at: null,
      completed_at: new Date().toISOString(),
      error_message: "Manuel olarak iptal edildi.",
    })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: linkedOutbox } = await supabase
    .from("nova_outbox")
    .select("id, action_run_id")
    .eq("task_queue_id", id)
    .maybeSingle();

  if (linkedOutbox?.id) {
    await supabase
      .from("nova_outbox")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkedOutbox.id);

    await recordNovaOutboxEvent({
      outboxId: linkedOutbox.id,
      actionRunId: linkedOutbox.action_run_id,
      taskQueueId: id,
      actorUserId: auth.userId,
      eventType: "task_cancelled",
      message: "Task queue kaydi manuel olarak iptal edildi.",
      metadata: {
        task_type: currentTask.task_type,
      },
    }).catch(() => undefined);
  }

  await logSecurityEventWithContext({
    eventType: "self_healing.queue.cancelled",
    userId: auth.userId,
    organizationId: auth.organizationId,
    severity: "warning",
    details: {
      taskId: id,
      taskType: currentTask.task_type,
    },
  });

  return NextResponse.json({ ok: true, task: data });
}
