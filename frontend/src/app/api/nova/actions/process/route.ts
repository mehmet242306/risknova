import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertNovaFeatureEnabled } from "@/lib/nova/governance";
import { requirePermission } from "@/lib/supabase/api-auth";
import { parseJsonBody } from "@/lib/security/server";
import { processSelfHealingQueue } from "@/lib/self-healing/queue";

const bodySchema = z.object({
  batchSize: z.number().int().min(1).max(20).optional().default(5),
});

function isCronAuthorized(request: NextRequest) {
  const configuredSecret = process.env.NOVA_ACTION_QUEUE_SECRET?.trim();
  if (!configuredSecret) return false;
  return request.headers.get("x-nova-queue-key")?.trim() === configuredSecret;
}

export async function POST(request: NextRequest) {
  let workerId = "nova-action-worker";
  let userId: string | null = null;
  let organizationId: string | null = null;

  if (!isCronAuthorized(request)) {
    const auth = await requirePermission(request, "self_healing.manage");
    if (!auth.ok) return auth.response;
    workerId = `nova-manual-${auth.userId}`;
    userId = auth.userId;
    organizationId = auth.organizationId;
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (userId && organizationId) {
    const rolloutResponse = await assertNovaFeatureEnabled({
      featureKey: "nova.agent.async_execution",
      userId,
      organizationId,
      fallbackMessage: "Nova async execution bu tenant icin su anda kapali.",
    });
    if (rolloutResponse) return rolloutResponse;
  }

  const result = await processSelfHealingQueue({
    batchSize: parsed.data.batchSize,
    workerId,
  });

  return NextResponse.json(result);
}
