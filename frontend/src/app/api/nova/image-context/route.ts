import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  resolveAiDailyLimit,
} from "@/lib/security/server";

export const maxDuration = 60;

const NOVA_IMAGE_CONTEXT_MODEL =
  process.env.NOVA_IMAGE_CONTEXT_MODEL ||
  process.env.NOVA_READ_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-20250514";

const imageContextSchema = z.object({
  imageBase64: z.string().min(100).max(20_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  fileName: z.string().max(180).optional(),
});

function stripJsonFence(text: string) {
  const clean = text.trim();
  if (!clean.startsWith("```")) return clean;
  return clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function asStringArray(value: unknown, limit = 5) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = imageContextSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Gecersiz gorsel verisi.",
        details: z.treeifyError(parsed.error),
      },
      { status: 400 },
    );
  }

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const plan = await resolveAiDailyLimit(auth.userId);
  const rateLimitResponse = await enforceRateLimit(request, {
    userId: auth.userId,
    organizationId: auth.organizationId,
    endpoint: "/api/nova/image-context",
    scope: "ai",
    limit: plan.dailyLimit,
    windowSeconds: 24 * 60 * 60,
    planKey: plan.planKey,
    metadata: { feature: "nova_image_context" },
  });
  if (rateLimitResponse) return rateLimitResponse;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { message: "Nova gorsel analizi icin ANTHROPIC_API_KEY tanimli degil." },
      { status: 500 },
    );
  }

  const { imageBase64, mimeType, fileName } = parsed.data;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: NOVA_IMAGE_CONTEXT_MODEL,
      max_tokens: 900,
      temperature: 0,
      system: [
        "Sen Nova'nin gorsel ISG baglam cikaricisisin.",
        "Gorseli yalnizca ISG/OHS soru cevap akisina yardimci olacak kadar ozetle.",
        "Kesin gormedigin KKD eksikligi, ekipman yoklugu veya mevzuat ihlali uydurma.",
        "Sadece JSON dondur. Markdown, aciklama veya kod blogu kullanma.",
        "JSON alani: imageDescription:string, areaSummary:string, risks:string[], positiveObservations:string[], personCount:number|null.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text:
                "Bu gorseli RiskNova Nova sohbetinde kullanmak icin kisa ve guvenilir ISG baglami olarak JSON halinde ozetle.",
            },
          ],
        },
      ],
    });

    const text = response.content.find((block) => block.type === "text")?.text || "";
    let parsedJson: Record<string, unknown> = {};
    try {
      parsedJson = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    } catch {
      parsedJson = { imageDescription: text.trim() };
    }

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: NOVA_IMAGE_CONTEXT_MODEL,
      endpoint: "/api/nova/image-context",
      promptTokens: response.usage?.input_tokens ?? 0,
      completionTokens: response.usage?.output_tokens ?? 0,
      success: true,
      metadata: {
        fileName: fileName ?? null,
        mimeType,
      },
    });

    return NextResponse.json({
      imageDescription: String(parsedJson.imageDescription || "").trim(),
      areaSummary: String(parsedJson.areaSummary || "").trim(),
      risks: asStringArray(parsedJson.risks).map((title) => ({ title })),
      positiveObservations: asStringArray(parsedJson.positiveObservations),
      personCount:
        typeof parsedJson.personCount === "number" && Number.isFinite(parsedJson.personCount)
          ? parsedJson.personCount
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: NOVA_IMAGE_CONTEXT_MODEL,
      endpoint: "/api/nova/image-context",
      success: false,
      metadata: {
        fileName: fileName ?? null,
        mimeType,
        error: message.slice(0, 300),
      },
    });
    await logErrorEvent({
      level: "error",
      source: "nova-image-context",
      endpoint: "/api/nova/image-context",
      message,
      userId: auth.userId,
      organizationId: auth.organizationId,
    });

    return NextResponse.json(
      { message: "Nova gorseli su anda okuyamadi. Lutfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
