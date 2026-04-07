import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

/** Extract readable text from binary files (e.g. docx XML content) */
function extractTextFromBinary(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Try to find XML text content in docx (which is a zip with XML inside)
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(bytes);
  // Extract text between XML tags, strip tags
  const textParts = raw.match(/>([^<]+)</g);
  if (textParts && textParts.length > 10) {
    return textParts
      .map((p) => p.slice(1, -1).trim())
      .filter((p) => p.length > 1)
      .join(" ");
  }
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const SYSTEM_PROMPT = `Sen 20+ yıl deneyimli A sınıfı İSG (İş Sağlığı ve Güvenliği) uzmanısın.

GÖREVIN:
Sana verilen dosya içeriğini (PDF, Word veya görüntü) analiz ederek, profesyonel bir İSG dokümanı haline getirmek.

KURALLAR:
1. Dosya içeriğindeki bilgileri koru ve düzenle
2. Eksik bilgileri firma verileriyle tamamla
3. Başlıkları ## ile başlat (markdown heading)
4. Tabloları markdown tablo formatında yaz
5. Madde listelerini - ile yaz
6. Yasal referansları doğru ve tam ver (kanun adı + madde numarası)
7. Tarih formatı: GG.AA.YYYY
8. İmza alanları, onay bölümleri ekle
9. Doküman doğrudan yazdırılıp kullanılabilir olmalı
10. Eğer görüntüde el yazısı veya basılı form varsa, tüm içeriği oku ve dijitalleştir

DİL: Türkçe
FORMAT: Düz metin (markdown)`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentTitle = formData.get("documentTitle") as string || "";
    const groupKey = formData.get("groupKey") as string || "";
    const companyName = formData.get("companyName") as string || "";
    const sector = formData.get("sector") as string || "";
    const hazardClass = formData.get("hazardClass") as string || "";

    if (!file) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }

    // Build context
    let contextInfo = "";
    if (companyName) contextInfo += `Firma: ${companyName}\n`;
    if (sector) contextInfo += `Sektör: ${sector}\n`;
    if (hazardClass) contextInfo += `Tehlike Sınıfı: ${hazardClass}\n`;
    if (documentTitle) contextInfo += `Doküman Başlığı: ${documentTitle}\n`;
    if (groupKey) contextInfo += `Kategori: ${groupKey}\n`;

    const fileType = file.type;
    const isImage = fileType.startsWith("image/");
    const isPdf = fileType === "application/pdf";

    let contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"];

    if (isImage) {
      // Image → AI vision OCR
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
          text: `${contextInfo}\n\nYukarıdaki görüntüdeki İSG dokümanını oku ve profesyonel markdown formatında yeniden yaz. Tüm metin, tablo, form alanı ve bilgileri dijitalleştir. "${documentTitle}" dokümanı olarak düzenle.`,
        },
      ];
    } else if (isPdf) {
      // PDF → send as document
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      contentBlocks = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf" as const, data: base64 },
        },
        {
          type: "text",
          text: `${contextInfo}\n\nYukarıdaki PDF dokümanının içeriğini analiz et ve profesyonel İSG dokümanı olarak markdown formatında yeniden yaz. "${documentTitle}" dokümanı olarak düzenle. Tüm tabloları, maddeleri ve bilgileri koru.`,
        },
      ];
    } else {
      // Word/other → extract text from buffer
      const arrayBuffer = await file.arrayBuffer();
      const textContent = new TextDecoder("utf-8").decode(arrayBuffer);

      // For binary files like .docx, we'll send the raw bytes and ask AI to interpret
      // But for now, try to get text content
      const cleanText = textContent.replace(/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF\u0600-\u06FFğüşıöçĞÜŞİÖÇ\s.,;:!?()[\]{}'"-]/g, " ").trim();

      if (cleanText.length < 50) {
        // Binary file (e.g. .docx) — extract readable XML text from the zip
        const text = extractTextFromBinary(arrayBuffer);
        contentBlocks = [
          {
            type: "text",
            text: `${contextInfo}\n\nAşağıdaki Word dokümanından çıkarılan içeriği profesyonel İSG dokümanı olarak markdown formatında yeniden düzenle. "${documentTitle}" dokümanı olarak hazırla.\n\n---\n${text.slice(0, 15000)}`,
          },
        ];
      } else {
        contentBlocks = [
          {
            type: "text",
            text: `${contextInfo}\n\nAşağıdaki doküman içeriğini profesyonel İSG dokümanı olarak markdown formatında yeniden düzenle. "${documentTitle}" dokümanı olarak hazırla.\n\n---\n${cleanText.slice(0, 15000)}`,
          },
        ];
      }
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI yanıt vermedi" }, { status: 500 });
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
    console.error("Doküman import hatası:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
