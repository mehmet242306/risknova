import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import {
  INCIDENT_AI_MAX_TOKENS,
  INCIDENT_AI_MODEL,
  ishikawaRequestSchema,
  parseIshikawaResponse,
} from "@/lib/incidents/ai";
import { requireAuth } from "@/lib/supabase/api-auth";
import { enforceRateLimit, parseJsonBody } from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sen 20+ yıl deneyimli, Türkiye'de İSG (İş Sağlığı ve Güvenliği)
uzmanı olarak görev yapan bir profesyonelsin. 6331 Sayılı İSG Kanunu,
ISO 45001 standardı ve Türkiye İSG mevzuatına hâkimsin.

Görevin: Verilen iş kazası/meslek hastalığı/ramak kala olayını
6M (Ishikawa) kök neden analizi metoduyla incelemek.

6M Kategorileri:
1. İnsan (Man) — yetersiz eğitim, dikkatsizlik, deneyimsizlik, yorgunluk
2. Makine (Machine) — ekipman arızası, koruma eksikliği, bakımsızlık
3. Metot (Method) — yanlış prosedür, eksik talimat, iletişim kopukluğu
4. Malzeme (Material) — kalitesiz malzeme, KKD eksikliği, yanlış kimyasal
5. Ölçüm (Measurement) — ölçüm hatası, kalibrasyon eksikliği
6. Çevre (Environment) — aydınlatma, gürültü, ısı, ortam koşulları

ÇIKTI FORMATI: Mutlaka aşağıdaki JSON formatında döndür, başka hiçbir
metin ekleme, markdown code fence kullanma:

{
  "analysis_summary": "Olayın 1-2 cümlelik özeti",
  "categories": {
    "insan": ["neden1", "neden2", "neden3"],
    "makine": ["neden1", "neden2"],
    "metot": ["neden1", "neden2"],
    "malzeme": ["neden1"],
    "olcum": ["neden1"],
    "cevre": ["neden1", "neden2"]
  },
  "primary_root_cause": "En kritik tek kök neden",
  "severity_assessment": "Düşük|Orta|Yüksek|Kritik"
}`;

function mapAiErrorMessage(message: string) {
  const normalized = message.toLocaleLowerCase("tr-TR");

  if (normalized.includes("anthropic_api_key")) {
    return "AI yapılandırması eksik. ANTHROPIC_API_KEY tanımlı değil.";
  }
  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return "AI istek limiti aşıldı. Lütfen kısa süre sonra tekrar deneyin.";
  }
  if (normalized.includes("json") || normalized.includes("text block")) {
    return "AI yanıtı beklenen formatta dönmedi. Manuel analizle devam edebilirsiniz.";
  }

  return "AI servisine şu an erişilemiyor. Manuel analizle devam edebilirsiniz.";
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
      endpoint: "/api/ai/ishikawa",
      scope: "ai",
      limit: 10,
      windowSeconds: 60,
      planKey: "incident_ai",
      metadata: { feature: "ishikawa_analysis" },
    });

    if (rateLimited) return rateLimited;

    const parsedBody = await parseJsonBody(request, ishikawaRequestSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const payload = parsedBody.data;
    const userPrompt = `
Olay Tipi: ${payload.incidentType}
Sektör: ${payload.companySector}
Lokasyon: ${payload.location}
Olay Anlatımı: ${payload.narrative}
Etkilenen Kişi Sayısı: ${payload.affectedCount}
${payload.witnesses ? `Tanık ifadeleri: ${payload.witnesses}` : ""}

Bu olayı 6M metoduyla analiz et.
`;

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

    const result = parseIshikawaResponse(textBlock.text);

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: INCIDENT_AI_MODEL,
      endpoint: "/api/ai/ishikawa",
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      success: true,
      metadata: {
        companyWorkspaceId: payload.companyWorkspaceId ?? null,
        incidentType: payload.incidentType,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: INCIDENT_AI_MODEL,
      endpoint: "/api/ai/ishikawa",
      success: false,
      metadata: { error: message.slice(0, 300) },
    });
    await logErrorEvent({
      level: "error",
      source: "incident-ishikawa-ai",
      endpoint: "/api/ai/ishikawa",
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
