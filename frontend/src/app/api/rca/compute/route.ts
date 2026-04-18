/**
 * POST /api/rca/compute
 *
 * Authoritative R₂D-RCA hesaplama (tamper-proof).
 * Postgres fn_compute_r2d_rca() SECURITY DEFINER fonksiyonunu çağırır.
 *
 * Body:
 *   {
 *     incident_id?: string | null,
 *     t0: number[] (9 elemanlı, [0,1]),
 *     t1: number[] (9 elemanlı, [0,1]),
 *     tau_primary?: number (default 0.40),
 *     tau_secondary?: number (default 0.15)
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import { enforceRateLimit } from "@/lib/security/server";
import { createClient } from "@/lib/supabase/client";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const rateLimited = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/rca/compute",
      scope: "api",
      limit: 30,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { incident_id, t0, t1, tau_primary, tau_secondary } = body ?? {};

    if (!Array.isArray(t0) || !Array.isArray(t1) || t0.length !== 9 || t1.length !== 9) {
      return NextResponse.json({ error: "t0 ve t1 tam olarak 9 elemanlı dizi olmalı" }, { status: 400 });
    }

    for (const v of [...t0, ...t1]) {
      if (typeof v !== "number" || v < 0 || v > 1 || !Number.isFinite(v)) {
        return NextResponse.json({ error: "Skorlar 0-1 aralığında number olmalı" }, { status: 400 });
      }
    }

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase kullanılamıyor" }, { status: 503 });
    }

    const { data, error } = await supabase.rpc("fn_compute_r2d_rca", {
      p_incident_id: incident_id ?? null,
      p_t0: t0,
      p_t1: t1,
      p_tau_primary: tau_primary ?? 0.40,
      p_tau_secondary: tau_secondary ?? 0.15,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
