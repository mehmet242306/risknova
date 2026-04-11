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

export const maxDuration = 90;

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

const trainingSlidesSchema = z.object({
  topic: z.string().min(3).max(300),
  slideCount: z.number().int().min(5).max(30).optional().default(10),
  category: z.string().max(80).optional().default("genel"),
  language: z.enum(["tr", "en"]).optional().default("tr"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(req, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/training-slides-ai",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "training_slides_ai" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const parsedBody = await parseJsonBody(req, trainingSlidesSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { topic, slideCount, category, language } = parsedBody.data;
    const count = Math.min(Math.max(Number(slideCount) || 10, 5), 30);
    const categoryLabel = CATEGORY_LABELS[category] || "Genel ISG";

    const prompt = `Sen uzman bir ISG egitmeni ve profesyonel sunum tasarimcisisin. ${topic} konusu icin ${count} slaytlik egitim sunumu hazirla.

KATEGORI: ${categoryLabel}
DIL: ${language === "en" ? "English" : "Turkce"}

KURALLAR:
- Ilk slayt kapak, son slayt ozet olsun
- Orta slaytlarda title_content, bullet_list, two_column ve quote layout'lari kullan
- Her slaytta speaker_notes olsun
- Slaytlarda dekoratif sekiller ve vurgu renkleri olsun
- ISG uygulamalarina ve mevzuat baglamina uygun icerik uret

CIKTI:
{
  "title": "Deck basligi",
  "description": "Kisa aciklama",
  "estimated_duration_minutes": sayi,
  "slides": [
    {
      "layout": "cover",
      "content": {
        "title": "...",
        "subtitle": "...",
        "decorations": []
      },
      "speaker_notes": "..."
    }
  ]
}

Sadece JSON don.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI yaniti islenemedi" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
    if (slides.length === 0) {
      return NextResponse.json({ error: "Slaytlar olusturulamadi" }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Organizasyon bulunamadi" }, { status: 400 });
    }

    const { data: deck, error: deckErr } = await supabase
      .from("slide_decks")
      .insert({
        organization_id: profile.organization_id,
        created_by: user.id,
        title: parsed.title || topic.slice(0, 40),
        description: parsed.description || null,
        category: category || "genel",
        theme: "modern",
        language: language || "tr",
        visibility: "private",
        source: "ai_generated",
        estimated_duration_minutes: parsed.estimated_duration_minutes || null,
      })
      .select()
      .single();

    if (deckErr || !deck) {
      console.error("Deck insert error:", deckErr);
      return NextResponse.json(
        { error: `Deck olusturulamadi: ${deckErr?.message || "unknown"}` },
        { status: 500 },
      );
    }

    const slideRows = slides.map((slide: any, index: number) => ({
      deck_id: deck.id,
      sort_order: index,
      layout: slide.layout || "title_content",
      content: slide.content || {},
      speaker_notes: slide.speaker_notes || null,
    }));

    const { error: slidesErr } = await supabase.from("slides").insert(slideRows);
    if (slidesErr) {
      console.error("Slides insert error:", slidesErr);
      await supabase.from("slide_decks").delete().eq("id", deck.id);
      return NextResponse.json(
        { error: `Slaytlar kaydedilemedi: ${slidesErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      deckId: deck.id,
      slideCount: slideRows.length,
      title: deck.title,
    });
  } catch (error) {
    console.error("training-slides-ai error:", error);
    await logSecurityEvent(req, "ai.training_slides.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: "AI slayt olusturma hatasi" }, { status: 500 });
  }
}
