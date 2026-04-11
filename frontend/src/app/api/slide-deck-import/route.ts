import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  sanitizePlainText,
  validateUploadedFile,
} from "@/lib/security/server";

export const maxDuration = 90;

function extractTextNodes(xml: string) {
  const result: string[] = [];
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const text = decodeXmlEntities(match[1].trim());
    if (text) result.push(text);
  }

  return result;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function buildSlideContent(texts: string[], isFirst: boolean) {
  if (texts.length === 0) {
    return { layout: "title_content", content: { title: "Bos Slayt", body: "" } };
  }

  const first = texts[0];
  const rest = texts.slice(1);

  if (isFirst) {
    return {
      layout: "cover",
      content: {
        title: first,
        subtitle: rest.join(" ") || undefined,
        decorations: [
          { type: "circle", x: -10, y: -15, w: 50, h: 50, color: "accent-soft", opacity: 0.6 },
          { type: "blob", x: 65, y: 55, w: 50, h: 50, color: "accent-soft", color2: "accent", opacity: 0.4 },
          { type: "accent_bar", x: 40, y: 85, w: 20, h: 0.7, color: "accent" },
        ],
      },
    };
  }

  if (texts.length === 1 && first.length < 60) {
    return { layout: "section_header", content: { title: first } };
  }

  if (rest.length >= 2 && rest.every((text) => text.length < 200)) {
    return { layout: "bullet_list", content: { title: first, bullets: rest } };
  }

  return {
    layout: "title_content",
    content: {
      title: first,
      body: rest.join("\n\n"),
    },
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const rateLimitResponse = await enforceRateLimit(req, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/slide-deck-import",
      scope: "api",
      limit: 60,
      windowSeconds: 60,
      metadata: { feature: "slide_deck_import" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = sanitizePlainText(String(formData.get("title") || ""), 200) || null;
    const category = sanitizePlainText(String(formData.get("category") || "genel"), 80);

    if (!file) {
      return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
    }

    const fileError = await validateUploadedFile(file, {
      allowedMimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      maxBytes: 25 * 1024 * 1024,
      allowedExtensions: [".pptx"],
    });
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles: { order: number; name: string }[] = [];
    zip.forEach((path) => {
      const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      if (match) {
        slideFiles.push({ order: parseInt(match[1], 10), name: path });
      }
    });
    slideFiles.sort((a, b) => a.order - b.order);

    if (slideFiles.length === 0) {
      return NextResponse.json({ error: "PPTX icinde slayt bulunamadi" }, { status: 400 });
    }

    const slides: Array<{ layout: string; content: any; notes: string | null }> = [];
    for (let index = 0; index < slideFiles.length; index += 1) {
      const xml = await zip.file(slideFiles[index].name)!.async("text");
      const texts = extractTextNodes(xml);

      const notesPath = `ppt/notesSlides/notesSlide${slideFiles[index].order}.xml`;
      let notes: string | null = null;
      const notesFile = zip.file(notesPath);
      if (notesFile) {
        const notesXml = await notesFile.async("text");
        const notesTexts = extractTextNodes(notesXml);
        const cleaned = notesTexts.filter((text) => !/^\d+$/.test(text) && text.length > 3);
        notes = cleaned.join("\n") || null;
      }

      const { layout, content } = buildSlideContent(texts, index === 0);
      slides.push({ layout, content, notes });
    }

    const deckTitle = title || slides[0]?.content?.title || file.name.replace(/\.pptx$/i, "");
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
        title: deckTitle.slice(0, 200),
        description: `${file.name} dosyasindan ice aktarildi`,
        category,
        theme: "modern",
        language: "tr",
        visibility: "private",
        source: "pptx_import",
      })
      .select()
      .single();

    if (deckErr || !deck) {
      console.error("Deck insert error:", deckErr);
      return NextResponse.json(
        { error: `Deck olusturulamadi: ${deckErr?.message || ""}` },
        { status: 500 },
      );
    }

    const rows = slides.map((slide, index) => ({
      deck_id: deck.id,
      sort_order: index,
      layout: slide.layout,
      content: slide.content,
      speaker_notes: slide.notes,
    }));

    const { error: slidesErr } = await supabase.from("slides").insert(rows);
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
      slideCount: rows.length,
      title: deck.title,
    });
  } catch (error) {
    console.error("slide-deck-import error:", error);
    await logSecurityEvent(req, "api.slide_deck_import.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import hatasi" }, { status: 500 });
  }
}
