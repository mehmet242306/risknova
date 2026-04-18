import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import {
  correctiveActionsRequestSchema,
  INCIDENT_AI_MAX_TOKENS,
  INCIDENT_AI_MODEL,
  parseCorrectiveActionsResponse,
} from "@/lib/incidents/ai";
import { requireAuth } from "@/lib/supabase/api-auth";
import { enforceRateLimit, parseJsonBody } from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sen Türkiye'de İSG uzmanı olarak DÖF (Düzeltici ve
Önleyici Faaliyet) önerileri hazırlıyorsun. ISO 45001 ve 6331 Sayılı Kanun'a
uygun, uygulanabilir, ölçülebilir öneriler ver.

Düzeltici Faaliyet: Mevcut uygunsuzluğu/durumu hemen düzelten kısa vadeli aksiyonlar.
Önleyici Faaliyet: Aynı sorunun tekrarını engelleyen uzun vadeli sistemsel aksiyonlar.

ÇIKTI: JSON array, başka metin yok:
[
  {
    "root_cause": "İlgili kök neden (input'tan)",
    "category": "insan|makine|metot|malzeme|olcum|cevre",
    "corrective_action": "Düzeltici faaliyet (1-2 cümle, eylem fiili ile başla)",
    "preventive_action": "Önleyici faaliyet (1-2 cümle)",
    "suggested_role": "İSG Uzmanı|İşveren Vekili|Birim Müdürü|İK|Bakım Sorumlusu",
    "suggested_deadline_days": 7-90 arası sayı,
    "priority": "Düşük|Orta|Yüksek|Kritik",
    "estimated_effort": "Saat cinsinden tahmini efor"
  }
]`;

function mapAiErrorMessage(message: string) {
  const normalized = message.toLocaleLowerCase("tr-TR");

  if (normalized.includes("anthropic_api_key")) {
    return "AI yapılandırması eksik. ANTHROPIC_API_KEY tanımlı değil.";
  }
  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return "AI istek limiti aşıldı. Lütfen kısa süre sonra tekrar deneyin.";
  }
  if (normalized.includes("json") || normalized.includes("text block")) {
    return "AI yanıtı beklenen formatta dönmedi. Manuel DÖF girişiyle devam edebilirsiniz.";
  }

  return "AI servisine şu an erişilemiyor. Manuel DÖF girişiyle devam edebilirsiniz.";
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil." }, { status: 500 });
    }

    const rateLimited = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/ai/generate-corrective-actions",
      scope: "ai",
      limit: 10,
      windowSeconds: 60,
      planKey: "incident_ai",
      metadata: { feature: "corrective_action_generation" },
    });

    if (rateLimited) return rateLimited;

    const parsedBody = await parseJsonBody(request, correctiveActionsRequestSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const payload = parsedBody.data;
    const userPrompt = `Olay Tipi: ${payload.incidentType}

Kök Nedenler:
${payload.rootCauses.map((item, index) => `${index + 1}. [${item.category}] ${item.cause}`).join("\n")}

Her kök neden için uygulanabilir DÖF önerileri üret.`;

    const response = await client.messages.create({
      model: INCIDENT_AI_MODEL,
      max_tokens: INCIDENT_AI_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Anthropic response did not include a text block.");
    }

    const result = parseCorrectiveActionsResponse(textBlock.text);

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: INCIDENT_AI_MODEL,
      endpoint: "/api/ai/generate-corrective-actions",
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      success: true,
      metadata: {
        companyWorkspaceId: payload.companyWorkspaceId ?? null,
        rootCauseCount: payload.rootCauses.length,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: INCIDENT_AI_MODEL,
      endpoint: "/api/ai/generate-corrective-actions",
      success: false,
      metadata: { error: message.slice(0, 300) },
    });
    await logErrorEvent({
      level: "error",
      source: "incident-corrective-actions-ai",
      endpoint: "/api/ai/generate-corrective-actions",
      message,
      stackTrace: error instanceof Error ? error.stack : null,
      userId: auth.userId,
      organizationId: auth.organizationId,
    });

    return NextResponse.json(
      {
        error: mapAiErrorMessage(message),
        manualFallback: true,
      },
      { status: 503 },
    );
  }
}
