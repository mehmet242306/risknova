import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import { normalizeNovaAgentResponse, novaChatRequestSchema } from "@/lib/nova/agent";
import { assertNovaFeatureEnabled } from "@/lib/nova/governance";
import { parseJsonBody } from "@/lib/security/server";
import { requireAuth } from "@/lib/supabase/api-auth";

export const maxDuration = 60;

const NOVA_READ_MODEL =
  process.env.NOVA_READ_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-20250514";

function buildReadOnlyNovaSystemPrompt(language?: string | null) {
  const isEnglish = String(language || "").toLowerCase().startsWith("en");

  if (isEnglish) {
    return [
      "You are Nova, RiskNova's OHS assistant.",
      "Answer normal user questions directly. Do not respond with permission errors for general OHS, regulation, risk, field inspection, document, or image-context questions.",
      "You may explain Turkish OHS practice from general professional knowledge. If an exact legal citation is needed but not available in the prompt, say the official citation should be checked, then continue with useful guidance.",
      "Do not invent law article numbers, official dates, or direct quotations.",
      "Do not access or summarize private tenant records in this read-only route. If the user asks for private company data or record creation, explain what you can answer generally and what needs authorization.",
      "If the prompt includes [Gorsel Baglami], use that image context as visual evidence and give OHS observations, risks, and next steps.",
      "Keep answers practical, concise, and in the user's language.",
    ].join("\n");
  }

  return [
    "Sen Nova'sin, RiskNova'nin ISG asistanisin.",
    "Normal kullanici sorularina dogrudan cevap ver. Genel ISG, mevzuat, risk, saha denetimi, dokuman veya gorsel baglami sorularinda yetki hatasi cevabi verme.",
    "Turkiye ISG uygulamalarini genel uzmanlik bilgisiyle aciklayabilirsin. Kesin resmi atif gerekiyorsa ve prompt icinde yoksa resmi kaynaktan kontrol edilmesi gerektigini belirt, sonra kullanisli rehberlige devam et.",
    "Kanun maddesi, resmi tarih veya dogrudan alinti uydurma.",
    "Bu read-only hatta tenant'a ozel gizli kayitlari okuma veya ozetleme. Kullanici firma verisi ya da kayit olusturma isterse genel bilgi ver ve bunun yetkili ajan akisi gerektirdigini belirt.",
    "Prompt icinde [Gorsel Baglami] varsa bunu gorsel kanit olarak kullan; ISG gozlemleri, riskler ve sonraki adimlari yaz.",
    "Cevabi kullanicinin dilinde, pratik, net ve uygulanabilir ver.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, novaChatRequestSchema);
  if (!parsed.ok) return parsed.response;

  const payload = parsed.data;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rolloutResponse = await assertNovaFeatureEnabled({
    featureKey: "nova.agent.chat",
    userId: auth.userId,
    organizationId: auth.organizationId,
    workspaceId: null,
    fallbackMessage:
      "Nova bu hesap icin su anda kapali. Lutfen daha sonra tekrar deneyin.",
  });
  if (rolloutResponse) {
    return rolloutResponse;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { message: "ANTHROPIC_API_KEY tanimli degil." },
      { status: 500 },
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: NOVA_READ_MODEL,
      max_tokens: 1200,
      temperature: 0.2,
      system: buildReadOnlyNovaSystemPrompt(payload.language),
      messages: [
        ...payload.history.slice(-8).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: "user",
          content: payload.message,
        },
      ],
    });

    const answer =
      response.content.find((block) => block.type === "text")?.text?.trim() ||
      "Nova su anda yanit uretmedi. Lutfen sorunuzu biraz daha acik yazar misiniz?";

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: NOVA_READ_MODEL,
      endpoint: "/api/nova/legal-chat",
      promptTokens: response.usage?.input_tokens ?? 0,
      completionTokens: response.usage?.output_tokens ?? 0,
      success: true,
      metadata: {
        gateway_mode: "read",
        context_surface: payload.context_surface,
        current_page: payload.current_page ?? null,
        company_workspace_id: null,
      },
    });

    return NextResponse.json(
      normalizeNovaAgentResponse({
        type: "message",
        answer,
        sources: [],
        session_id: payload.session_id ?? null,
        as_of_date: payload.as_of_date ?? new Date().toISOString().slice(0, 10),
        answer_mode: "extractive",
        jurisdiction_code: payload.jurisdiction_code ?? "TR",
        cached: false,
        telemetry: {
          gateway_mode: "read",
          context_surface: payload.context_surface,
          current_page: payload.current_page ?? null,
          company_workspace_id: null,
          model: NOVA_READ_MODEL,
        },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await logErrorEvent({
      level: "error",
      source: "nova-legal-chat",
      endpoint: "/api/nova/legal-chat",
      message,
      userId: auth.userId,
      organizationId: auth.organizationId,
    });

    return NextResponse.json(
      {
        message:
          "Nova su anda yanit uretirken hata aldi. Lutfen bir kez daha deneyin.",
      },
      { status: 500 },
    );
  }
}
