import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertNovaFeatureEnabled, recordNovaEvalRuns } from "@/lib/nova/governance";
import { normalizeNovaAgentResponse } from "@/lib/nova/agent";
import { NOVA_BENCHMARK_CASES, scoreNovaBenchmarkCase } from "@/lib/nova/benchmarks";
import { requireSuperAdmin } from "@/lib/supabase/api-auth";
import { parseJsonBody } from "@/lib/security/server";

const benchmarkRunSchema = z.object({
  suiteKey: z.literal("core").optional().default("core"),
  workspace_id: z.string().uuid().nullable().optional(),
  jurisdiction_code: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, benchmarkRunSchema);
  if (!parsed.ok) return parsed.response;

  const rolloutResponse = await assertNovaFeatureEnabled({
    featureKey: "nova.agent.benchmarks",
    userId: auth.userId,
    organizationId: auth.organizationId,
    workspaceId: parsed.data.workspace_id ?? null,
    fallbackMessage: "Nova benchmark kosulari bu tenant icin rollout disi.",
    status: 409,
  });
  if (rolloutResponse) return rolloutResponse;

  const origin = request.nextUrl.origin;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const suiteCases = NOVA_BENCHMARK_CASES.filter((item) => item.suiteKey === parsed.data.suiteKey);

  const results = [];
  for (const benchmarkCase of suiteCases) {
    const startedAt = Date.now();
    const response = await fetch(`${origin}/api/nova/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        ...benchmarkCase.request,
        workspace_id: parsed.data.workspace_id ?? benchmarkCase.request.workspace_id ?? null,
        jurisdiction_code:
          parsed.data.jurisdiction_code ?? benchmarkCase.request.jurisdiction_code ?? null,
      }),
      cache: "no-store",
    });

    const rawPayload = await response.json().catch(() => ({}));
    const normalized = normalizeNovaAgentResponse(rawPayload);
    const latencyMs = Date.now() - startedAt;
    const scoring = scoreNovaBenchmarkCase(benchmarkCase, normalized, latencyMs);

    results.push({
      suite_key: benchmarkCase.suiteKey,
      case_key: benchmarkCase.caseKey,
      category: benchmarkCase.category,
      organization_id: auth.organizationId,
      workspace_id: parsed.data.workspace_id ?? null,
      executed_by: auth.userId,
      score: scoring.score,
      passed: scoring.passed,
      latency_ms: latencyMs,
      request_payload: benchmarkCase.request,
      response_payload: rawPayload,
      failure_reason: scoring.failureReason,
      metadata: {
        checks: scoring.checks,
        httpStatus: response.status,
        responseType: normalized.type,
      },
    });
  }

  await recordNovaEvalRuns(results);

  return NextResponse.json({
    ok: true,
    suiteKey: parsed.data.suiteKey,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    averageScore:
      results.length > 0
        ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2))
        : 0,
    results,
  });
}
