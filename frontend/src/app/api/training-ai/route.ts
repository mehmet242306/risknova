import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  parseJsonBody,
  resolveAiDailyLimit,
} from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const trainingAiSchema = z.object({
  topic: z.string().min(3).max(300),
  questionCount: z.number().int().min(1).max(50).optional().default(10),
  optionCount: z.number().int().min(2).max(6).optional().default(4),
  type: z.enum(["exam", "survey"]).optional().default("exam"),
  description: z.string().max(2000).optional().default(""),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/training-ai",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "training_ai" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const parsedBody = await parseJsonBody(request, trainingAiSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { topic, questionCount, optionCount, type, description } = parsedBody.data;

    const isExam = type === "exam";
    const qCount = Math.min(Math.max(questionCount || 10, 1), 50);
    const oCount = Math.min(Math.max(optionCount || 4, 2), 6);

    const prompt = `Sen ISG egitim uzmanisin. Asagidaki konu icin ${isExam ? "sinav sorulari" : "anket sorulari"} olustur.

KONU: ${topic}
${description ? `ACIKLAMA: ${description}` : ""}
SORU SAYISI: ${qCount}
${isExam ? `SIK SAYISI: ${oCount}` : ""}

${isExam ? `SINAV KURALLARI:
- Tum sorular coktan secmeli olmali
- Her soruda tam olarak ${oCount} secenek bulunmali
- Her soruda yalnizca 1 dogru cevap olmali
- Sorular Turk ISG uygulamalarina uygun olmali
- Kolay, orta ve zor dagilimi dengeli olmali` : `ANKET KURALLARI:
- Sorular coktan secmeli, olcek, evet-hayir veya acik uclu olabilir
- Sorular tarafsiz ve yonlendirici olmayan dil kullanmali`}

CIKTI FORMATI:
[
  {
    "questionText": "Soru metni",
    "questionType": "${isExam ? "multiple_choice" : "mixed"}",
    "options": [
      {"label": "Secenek", "value": "A", "isCorrect": ${isExam ? "true/false" : "false"}}
    ],
    "points": 1
  }
]

${!isExam ? `Anketlerde questionType su degerlerden biri olmali: "multiple_choice", "scale", "yes_no", "open_ended"` : ""}

Sadece JSON dizisi dondur.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI yanitindan sorular cikarilamadi" },
        { status: 500 },
      );
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error(`[training-ai] [${new Date().toISOString()}] [user=${auth.userId}] error:`, error);
    await logSecurityEvent(request, "ai.training.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: "AI soru olusturma hatasi" }, { status: 500 });
  }
}
