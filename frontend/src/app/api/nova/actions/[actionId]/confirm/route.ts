import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/supabase/api-auth";
import { enforceRateLimit, parseJsonBody } from "@/lib/security/server";
import {
  buildActionStateResponse,
  buildReplayResponse,
  loadNovaActionRunForUser,
  novaActionConfirmSchema,
  queueNovaActionExecution,
} from "@/lib/nova/action-endpoint";
import { assertNovaFeatureEnabled } from "@/lib/nova/governance";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> },
) {
  try {
    const auth = await requirePermission(request, "ai.use");
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, novaActionConfirmSchema);
    if (!parsed.ok) return parsed.response;

    const { actionId } = await params;

    const rateLimited = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: `/api/nova/actions/${actionId}/confirm`,
      scope: "api",
      limit: 30,
      windowSeconds: 60,
      metadata: { feature: "nova_confirm_action" },
    });
    if (rateLimited) return rateLimited;

    const actionRun = await loadNovaActionRunForUser(actionId, auth.userId, auth.organizationId);
    if (!actionRun) {
      return NextResponse.json({ message: "Nova aksiyonu bulunamadi." }, { status: 404 });
    }

    const confirmationGuard = await assertNovaFeatureEnabled({
      featureKey: "nova.agent.confirmations",
      userId: auth.userId,
      organizationId: auth.organizationId,
      fallbackMessage: "Nova onay akisi bu tenant icin su anda kapali.",
    });
    if (confirmationGuard) return confirmationGuard;

    if (
      actionRun.status === "completed" ||
      actionRun.status === "cancelled" ||
      actionRun.status === "failed"
    ) {
      return NextResponse.json(buildReplayResponse(actionRun), { status: 200 });
    }

    if (actionRun.status === "confirmed") {
      return NextResponse.json(buildActionStateResponse(actionRun), { status: 202 });
    }

    const asyncGuard = await assertNovaFeatureEnabled({
      featureKey: "nova.agent.async_execution",
      userId: auth.userId,
      organizationId: auth.organizationId,
      fallbackMessage: "Nova arka plan isleyicisi bu tenant icin su anda kapali.",
    });
    if (asyncGuard) return asyncGuard;

    const queued = await queueNovaActionExecution({
      actionRun,
      userId: auth.userId,
      organizationId: auth.organizationId,
      contextSurface: parsed.data.context_surface,
      idempotencyKey: parsed.data.idempotency_key,
    });

    return NextResponse.json(queued, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ message }, { status: 500 });
  }
}
