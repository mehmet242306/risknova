import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  parseJsonBody,
  resolveAiDailyLimit,
} from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 45;

const CATEGORY_LABELS: Record<string, string> = {
  yangin: "Yangin Guvenligi",
  kkd: "Kisisel Koruyucu Donanim",
  yuksekte_calisma: "Yuksekte Calisma",
  elektrik: "Elektrik Guvenligi",
  kimyasal: "Kimyasal Guvenlik",
  ilkyardim: "Ilk Yardim",
  ergonomi: "Ergonomi",
  makine: "Makine Guvenligi",
  genel: "Genel ISG",
};

const slideSingleSchema = z.object({
  deckId: z.string().uuid(),
  prompt: z.string().min(5).max(4000),
  layout: z
    .enum([
      "cover",
      "section_header",
      "title_content",
      "bullet_list",
      "two_column",
      "quote",
      "summary",
      "image_text",
      "video",
    ])
    .optional(),
  insertAfter: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(req, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/slide-single-ai",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "slide_single_ai" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const parsedBody = await parseJsonBody(req, slideSingleSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { deckId, prompt: userPrompt, layout, insertAfter } = parsedBody.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

    const { data: deck } = await supabase
      .from("slide_decks")
      .select("*")
      .eq("id", deckId)
      .maybeSingle();

    if (!deck) {
      return NextResponse.json({ error: "Deck bulunamadi" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("slides")
      .select("sort_order, layout, content")
      .eq("deck_id", deckId)
      .order("sort_order", { ascending: true });

    const contextTitles = (existing || [])
      .map((slide: any, index: number) => `${index + 1}. [${slide.layout}] ${slide.content?.title || "-"}`)
      .join("\n");

    const categoryLabel = CATEGORY_LABELS[deck.category] || "Genel ISG";
    const systemPrompt = `Sen uzman bir ISG egitmeni ve slayt tasarimcisisin.

DECK: ${deck.title}
KATEGORI: ${categoryLabel}
ACIKLAMA: ${deck.description || "yok"}

MEVCUT SLAYTLAR:
${contextTitles || "(bos)"}

KULLANICI ISTEGI:
${userPrompt}

${layout ? `ISTENEN LAYOUT: ${layout}` : "Uygun layoutu sen sec."}

KURALLAR:
- Tekrar eden icerik uretme
- Kisa, ogretici ve profesyonel ol
- Speaker notes ekle
- Decorations alanini doldur

CIKTI:
{
  "layout": "title_content",
  "content": {
    "title": "...",
    "body": "...",
    "decorations": []
  },
  "speaker_notes": "..."
}

Sadece JSON don.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: systemPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI yaniti islenemedi" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    let sortOrder = existing?.length || 0;
    if (typeof insertAfter === "number") {
      sortOrder = insertAfter + 1;
      for (const slide of (existing as Array<{ sort_order: number }> | null) ?? []) {
        if (slide.sort_order >= sortOrder) {
          await supabase
            .from("slides")
            .update({ sort_order: slide.sort_order + 1 })
            .eq("deck_id", deckId)
            .eq("sort_order", slide.sort_order);
        }
      }
    }

    const { data: newSlide, error: insertErr } = await supabase
      .from("slides")
      .insert({
        deck_id: deckId,
        sort_order: sortOrder,
        layout: parsed.layout || layout || "title_content",
        content: parsed.content || {},
        speaker_notes: parsed.speaker_notes || null,
      })
      .select()
      .single();

    if (insertErr || !newSlide) {
      console.error("slide insert error:", insertErr);
      return NextResponse.json({ error: "Slayt eklenemedi" }, { status: 500 });
    }

    return NextResponse.json({ slide: newSlide });
  } catch (error) {
    console.error("slide-single-ai error:", error);
    await logSecurityEvent(req, "ai.slide_single.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: "Tek slayt olusturma hatasi" }, { status: 500 });
  }
}
