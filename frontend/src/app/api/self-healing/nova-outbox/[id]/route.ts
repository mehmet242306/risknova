import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadNovaActionRunForExecution, queueNovaActionExecution } from "@/lib/nova/action-endpoint";
import { recordNovaOutboxEvent } from "@/lib/nova/governance";
import { requirePermission } from "@/lib/supabase/api-auth";
import { createServiceClient, parseJsonBody } from "@/lib/security/server";

const bodySchema = z.object({
  action: z.enum(["replay", "cancel", "resolve"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, "self_healing.replay.manage");
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const supabase = createServiceClient();

  const { data: outbox, error: outboxError } = await supabase
    .from("nova_outbox")
    .select("id, action_run_id, task_queue_id, status, last_error, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (outboxError) {
    return NextResponse.json({ error: outboxError.message }, { status: 500 });
  }

  if (!outbox?.id) {
    return NextResponse.json({ error: "Nova outbox kaydi bulunamadi." }, { status: 404 });
  }

  const actionRun = await loadNovaActionRunForExecution(outbox.action_run_id);
  if (!actionRun) {
    return NextResponse.json({ error: "Bagli Nova action run bulunamadi." }, { status: 404 });
  }

  if (parsed.data.action === "resolve") {
    const { error } = await supabase
      .from("nova_outbox")
      .update({
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", outbox.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordNovaOutboxEvent({
      outboxId: outbox.id,
      actionRunId: outbox.action_run_id,
      taskQueueId: outbox.task_queue_id,
      actorUserId: auth.userId,
      eventType: "manual_resolve",
      message: "Admin hatayi incelendi olarak isaretledi.",
      metadata: { previous_status: outbox.status },
    });

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "cancel") {
    if (outbox.task_queue_id) {
      await supabase
        .from("task_queue")
        .update({
          status: "cancelled",
          locked_by: null,
          processing_started_at: null,
          completed_at: new Date().toISOString(),
          error_message: "Nova outbox manuel olarak iptal edildi.",
        })
        .eq("id", outbox.task_queue_id);
    }

    await supabase
      .from("nova_outbox")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", outbox.id);

    await recordNovaOutboxEvent({
      outboxId: outbox.id,
      actionRunId: outbox.action_run_id,
      taskQueueId: outbox.task_queue_id,
      actorUserId: auth.userId,
      eventType: "manual_cancel",
      message: "Admin outbox islemini iptal etti.",
      metadata: { previous_status: outbox.status },
    });

    return NextResponse.json({ ok: true });
  }

  if (actionRun.status === "completed" || actionRun.status === "cancelled") {
    return NextResponse.json(
      { error: "Tamamlanmis veya iptal edilmis aksiyon replay edilemez." },
      { status: 409 },
    );
  }

  if (
    actionRun.status === "failed" ||
    ((outbox.status === "failed" || outbox.status === "dead_letter") && actionRun.status === "confirmed")
  ) {
    const snapshot =
      actionRun.result_snapshot && typeof actionRun.result_snapshot === "object"
        ? actionRun.result_snapshot
        : {};
    const { error } = await supabase
      .from("nova_action_runs")
      .update({
        status: "pending",
        result_snapshot: {
          ...snapshot,
          replay_requested_at: new Date().toISOString(),
          replay_requested_by: auth.userId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", actionRun.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const queuedResponse = await queueNovaActionExecution({
    actionRun: {
      ...actionRun,
      status:
        actionRun.status === "failed" ||
        ((outbox.status === "failed" || outbox.status === "dead_letter") && actionRun.status === "confirmed")
          ? "pending"
          : actionRun.status,
    },
    userId: actionRun.user_id,
    organizationId: actionRun.organization_id ?? auth.organizationId,
    contextSurface: "solution_center",
    idempotencyKey: randomUUID(),
  });

  await recordNovaOutboxEvent({
    outboxId: outbox.id,
    actionRunId: outbox.action_run_id,
    taskQueueId:
      queuedResponse.action_hint && typeof queuedResponse.action_hint === "object"
        ? queuedResponse.action_hint.queue_task_id
        : null,
    actorUserId: auth.userId,
    eventType: "manual_replay",
    message: "Admin dead-letter kaydini yeniden kuyruga aldi.",
    metadata: {
      previous_status: outbox.status,
    },
  });

  return NextResponse.json(queuedResponse);
}
