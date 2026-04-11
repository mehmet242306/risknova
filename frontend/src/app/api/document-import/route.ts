import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  resolveAiDailyLimit,
  sanitizePlainText,
  validateUploadedFile,
} from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

function extractTextFromBinary(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(bytes);
  const textParts = raw.match(/>([^<]+)</g);

  if (textParts && textParts.length > 10) {
    return textParts
      .map((part) => part.slice(1, -1).trim())
      .filter((part) => part.length > 1)
      .join(" ");
  }

  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const SYSTEM_PROMPT = `Sen 20+ yil deneyimli A sinifi ISG uzmansin.
Verilen dosya icerigini profesyonel bir ISG dokumanina donustur.

KURALLAR:
- Dosya icerigindeki bilgileri koru ve duzenle
- Basliklari markdown formatinda yaz
- Tablolari markdown tabloya cevir
- Eksik yerleri firma bilgileriyle tamamla
- Dokuman yazdirilip kullanilabilir olsun
- Turkce yaz`;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/document-import",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "document_import_ai" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanimli degil" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentTitle = sanitizePlainText(String(formData.get("documentTitle") || ""), 250);
    const groupKey = sanitizePlainText(String(formData.get("groupKey") || ""), 120);
    const companyName = sanitizePlainText(String(formData.get("companyName") || ""), 250);
    const sector = sanitizePlainText(String(formData.get("sector") || ""), 120);
    const hazardClass = sanitizePlainText(String(formData.get("hazardClass") || ""), 120);

    if (!file) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }

    const fileError = await validateUploadedFile(file, {
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      maxBytes: 20 * 1024 * 1024,
      allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt"],
    });
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    let contextInfo = "";
    if (companyName) contextInfo += `Firma: ${companyName}\n`;
    if (sector) contextInfo += `Sektor: ${sector}\n`;
    if (hazardClass) contextInfo += `Tehlike Sinifi: ${hazardClass}\n`;
    if (documentTitle) contextInfo += `Dokuman Basligi: ${documentTitle}\n`;
    if (groupKey) contextInfo += `Kategori: ${groupKey}\n`;

    const fileType = file.type;
    const isImage = fileType.startsWith("image/");
    const isPdf = fileType === "application/pdf";

    let contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"];

    if (isImage) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mediaType = fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      contentBlocks = [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: `${contextInfo}\n\nGorseldeki ISG dokumanini okuyup profesyonel markdown metnine cevir.`,
        },
      ];
    } else if (isPdf) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      contentBlocks = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        {
          type: "text",
          text: `${contextInfo}\n\nBu PDF dokumanini profesyonel ISG dokumani olarak markdown biciminde yeniden yaz.`,
        },
      ];
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const textContent = new TextDecoder("utf-8").decode(arrayBuffer);
      const cleanText = textContent
        .replace(/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF\u0600-\u06FFğüşiöçĞÜŞİÖÇ\s.,;:!?()[\]{}'"-]/g, " ")
        .trim();

      const text =
        cleanText.length < 50
          ? extractTextFromBinary(arrayBuffer)
          : cleanText;

      contentBlocks = [
        {
          type: "text",
          text: `${contextInfo}\n\nAsagidaki icerigi profesyonel ISG dokumani olarak markdown biciminde yeniden duzenle.\n\n---\n${text.slice(0, 15000)}`,
        },
      ];
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI yanit vermedi" }, { status: 500 });
    }

    return NextResponse.json({
      content: textBlock.text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error("Dokuman import hatasi:", message);
    await logSecurityEvent(request, "ai.document_import.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: { message: message.slice(0, 300) },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
