import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Sen bir İSG (İş Sağlığı ve Güvenliği) uzmanısın. Türk mevzuatına göre soruları yanıtlıyorsun.

Görevlerin:
- 6331 sayılı İş Sağlığı ve Güvenliği Kanunu ve ilgili yönetmeliklere dayanarak yanıt ver
- Yanıtlarında ilgili mevzuat maddelerine referans ver
- Pratik ve uygulanabilir çözümler öner
- Tehlike sınıfları, risk değerlendirmesi ve kontrol hiyerarşisini dikkate al
- Yanıtlarını Türkçe ver

Yanıt verirken:
1. Önce sorunun özünü anla
2. İlgili mevzuat hükümlerini belirt
3. Pratik çözüm önerilerini sırala
4. Gerekiyorsa uyarı ve dikkat edilmesi gereken noktaları ekle`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY yapilandirilmamis." },
        { status: 500 },
      );
    }

    const { query, context, history } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { error: "Soru en az 3 karakter olmalidir." },
        { status: 400 },
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build messages from history if provided
    const messages: Anthropic.MessageParam[] = [];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Build user message with context from search results
    let userContent = query;
    if (context && typeof context === "string") {
      userContent = `Aşağıdaki mevzuat bölümleri bu soruyla ilgili olabilir:\n\n${context}\n\n---\n\nKullanıcı sorusu: ${query}`;
    }

    messages.push({ role: "user", content: userContent });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });

    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent?.text ?? "Yanit olusturulamadi.";

    return NextResponse.json({
      response: responseText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}
