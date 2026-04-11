import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/supabase/api-auth";

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

/**
 * Supabase admin client (server-side).
 *
 * GÜVENLİK NOTU (Parça B Adım 3, 2026-04-11):
 * Bu fonksiyon SUPABASE_SERVICE_ROLE_KEY kullanır ve RLS'i bypass eder.
 * "Super admin öğrenme aracı" olduğu için service role meşrudur — global
 * ai_knowledge_base ve ai_learning_sessions tablolarına yazar. ANCAK bu
 * fonksiyon SADECE POST handler içinde, requireSuperAdmin guard'ı BAŞARILI
 * olduktan sonra çağrılmalıdır. Anon/public erişim yok.
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ── URL'den icerik cekme ── */
async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaAI/1.0; RiskNova Platform)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`URL fetch hatasi: ${res.status}`);
  const html = await res.text();

  // HTML'den metin cikar (basit)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 30000); // max 30k karakter
}

/* ── AI ile icerik ozetleme ve bilgi cikarma ── */
async function extractKnowledge(content: string, sourceType: string, sourceRef: string): Promise<{
  title: string;
  category: string;
  subcategory: string;
  summary: string;
  keyPoints: string[];
}> {
  const response = await ai.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: "Sen bir bilgi cikarma uzmanisin. Verilen icerigi analiz edip yapilandirilmis bilgi olarak ozetle. Turkce yaz.",
    messages: [{
      role: "user",
      content: `Bu icerigi analiz et ve asagidaki JSON formatinda ozetle. Kaynak: ${sourceType} (${sourceRef})

Icerik:
${content.slice(0, 20000)}

JSON formati:
{
  "title": "Icerigin kisa basligi",
  "category": "Kategori (ISG, Mevzuat, Teknik, Egitim, Yonetim, Saglik, Cevre, Diger)",
  "subcategory": "Alt kategori",
  "summary": "Detayli ozet (500-1000 kelime, onemli bilgileri icermeli)",
  "keyPoints": ["Anahtar bilgi 1", "Anahtar bilgi 2", ...]
}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("AI ozet uretmedi");

  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  return JSON.parse(jsonStr);
}

export async function POST(request: NextRequest) {
  // GÜVENLİK KATMANI (Parça B Adım 3):
  // Bu route "Nova AI öğrenme aracı" — URL veya PDF'ten bilgi çıkarıp
  // global ai_knowledge_base tablosuna yazar. Sadece super admin'e açık.
  // requireSuperAdmin guard:
  //   1. Authorization header'dan JWT doğrular
  //   2. user_profiles'tan profile çeker
  //   3. is_super_admin(uid) RPC çağırır
  //   4. Hata: 401/403/500
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const type = formData.get("type") as string; // "url" veya "pdf"
    const sb = getSupabase();

    if (!sb) {
      return NextResponse.json({ error: "Veritabani baglantisi yok" }, { status: 500 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key tanımlı değil" }, { status: 500 });
    }

    let rawContent = "";
    let sourceType = "";
    let sourceRef = "";

    if (type === "url") {
      const url = formData.get("url") as string;
      if (!url) return NextResponse.json({ error: "URL gerekli" }, { status: 400 });

      sourceType = "web";
      sourceRef = url;
      rawContent = await fetchUrlContent(url);

      if (rawContent.length < 100) {
        return NextResponse.json({ error: "Sayfadan yeterli icerik cikarilamadi" }, { status: 400 });
      }

    } else if (type === "pdf") {
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "PDF dosyasi gerekli" }, { status: 400 });

      sourceType = "pdf";
      sourceRef = file.name;

      // PDF'i base64'e cevir ve AI'a gonder
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      const pdfResponse = await ai.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Bu PDF dokumandaki tum metni cikar. Tablolari, maddeleri, baslik ve alt basliklari koru. Turkce ise Turkce olarak yaz. Sadece icerigi yaz, yorum ekleme.",
            },
          ],
        }],
      });

      const pdfText = pdfResponse.content.find((b) => b.type === "text");
      if (!pdfText || pdfText.type !== "text") {
        return NextResponse.json({ error: "PDF icerigi okunamadi" }, { status: 500 });
      }
      rawContent = pdfText.text;

    } else {
      return NextResponse.json({ error: "Gecersiz tip. 'url' veya 'pdf' olmali" }, { status: 400 });
    }

    // AI ile bilgi cikar
    const knowledge = await extractKnowledge(rawContent, sourceType, sourceRef);

    // Bilgi tabanina kaydet
    const fullContent = `${knowledge.summary}\n\n## Anahtar Bilgiler\n${knowledge.keyPoints.map((p) => `- ${p}`).join("\n")}`;

    const { data, error } = await sb.from("ai_knowledge_base").insert({
      category: knowledge.category,
      subcategory: knowledge.subcategory,
      title: knowledge.title,
      content: fullContent,
      source_type: sourceType,
      source_url: sourceRef,
      reliability_score: sourceType === "pdf" ? 0.9 : 0.7,
      usage_count: 0,
      is_verified: false,
      metadata: {
        key_points: knowledge.keyPoints,
        raw_length: rawContent.length,
        extracted_at: new Date().toISOString(),
      },
    }).select("id, title, category").single();

    if (error) {
      console.error(`[admin-ai/learn] [${new Date().toISOString()}] [user=${auth.userId}] DB insert error:`, error);
      return NextResponse.json({ error: `Veritabani hatasi: ${error.message}` }, { status: 500 });
    }

    // Ogrenme oturumu kaydet
    await sb.from("ai_learning_sessions").insert({
      session_type: `learn_from_${sourceType}`,
      status: "completed",
      data_processed: rawContent.length,
      new_knowledge_added: 1,
      patterns_discovered: knowledge.keyPoints.length,
      metrics: { source: sourceRef, category: knowledge.category },
    });

    return NextResponse.json({
      success: true,
      knowledge: {
        id: data?.id,
        title: knowledge.title,
        category: knowledge.category,
        keyPointCount: knowledge.keyPoints.length,
        contentLength: fullContent.length,
      },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error(`[admin-ai/learn] [${new Date().toISOString()}] [user=${auth.userId}] Learn API error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
