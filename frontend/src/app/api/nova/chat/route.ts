import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/api-auth";

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  language: z.string().min(2).max(10).optional().default("tr"),
  session_id: z.string().uuid().nullable().optional(),
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

function getFunctionUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  }

  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/solution-chat`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = bodySchema.parse(await request.json());
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const supabase = await createClient();

    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();

    const accessToken =
      refreshData.session?.access_token ??
      (await supabase.auth.getSession()).data.session?.access_token ??
      null;

    if (!accessToken) {
      return NextResponse.json(
        {
          message:
            "Nova oturumunuzu doğrulayamadı. Lütfen çıkış yapıp tekrar girin ve yeniden deneyin.",
          detail: refreshError?.message ?? "access_token_missing",
        },
        { status: 401 },
      );
    }

    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      "";

    const response = await fetch(getFunctionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        message: payload.message,
        organization_id: auth.organizationId,
        ...(payload.session_id ? { session_id: payload.session_id } : {}),
        language: payload.language,
        history: payload.history,
      }),
      cache: "no-store",
    });

    const rawText = await response.text();

    try {
      const json = rawText ? JSON.parse(rawText) : {};
      return NextResponse.json(json, { status: response.status });
    } catch {
      return NextResponse.json(
        {
          message: rawText || "Nova servisi beklenmeyen bir yanıt döndürdü.",
        },
        { status: response.status },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ message }, { status: 500 });
  }
}
