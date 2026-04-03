import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

/* ── Supabase admin client (server-side) ── */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}

/* ── Build platform context from DB ── */
async function buildPlatformContext(): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "Platform veritabani baglantisi yok.";

  const parts: string[] = ["### Platform Verileri (Guncel)"];

  try {
    // Firma sayisi
    const { count: companyCount } = await sb.from("company_workspaces").select("*", { count: "exact", head: true });
    parts.push(`- Toplam firma/kurum: ${companyCount ?? "?"}`);

    // Personel
    const { count: personnelCount } = await sb.from("personnel").select("*", { count: "exact", head: true });
    parts.push(`- Toplam personel: ${personnelCount ?? "?"}`);

    // Ekip uyeleri
    const { count: teamCount } = await sb.from("team_members").select("*", { count: "exact", head: true });
    parts.push(`- Toplam ekip uyesi: ${teamCount ?? "?"}`);

    // Olaylar
    const { count: incidentCount } = await sb.from("incidents").select("*", { count: "exact", head: true });
    parts.push(`- Toplam olay kaydi: ${incidentCount ?? "?"}`);

    // Risk degerlendirmeleri
    const { count: riskCount } = await sb.from("risk_assessments").select("*", { count: "exact", head: true });
    parts.push(`- Risk degerlendirmesi: ${riskCount ?? "?"}`);

    // Mevzuat
    const { count: legalCount } = await sb.from("legal_chunks").select("*", { count: "exact", head: true });
    parts.push(`- Mevzuat chunk sayisi: ${legalCount ?? "?"}`);

    // AI ogrenme durumu
    const { count: kbCount } = await sb.from("ai_knowledge_base").select("*", { count: "exact", head: true });
    const { count: qaCount } = await sb.from("ai_qa_learning").select("*", { count: "exact", head: true });
    const { count: patternCount } = await sb.from("ai_learned_patterns").select("*", { count: "exact", head: true });
    parts.push(`\n### AI Ogrenme Durumu`);
    parts.push(`- Bilgi tabani kaydi: ${kbCount ?? 0}`);
    parts.push(`- Ogrenilmis QA: ${qaCount ?? 0}`);
    parts.push(`- Tespit edilen pattern: ${patternCount ?? 0}`);

  } catch (e) {
    parts.push(`- Veritabani sorgu hatasi: ${e instanceof Error ? e.message : "?"}`);
  }

  parts.push(`\n### Sistem\n- Tarih: ${new Date().toLocaleDateString("tr-TR")}\n- Platform: RiskNova ISG Yonetim Sistemi`);
  return parts.join("\n");
}

/* ── Fetch relevant QA from learning history ── */
async function fetchRelevantQA(question: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "";

  try {
    // Basit keyword match (embedding yoksa)
    const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    if (keywords.length === 0) return "";

    const { data } = await sb
      .from("ai_qa_learning")
      .select("question, answer, user_feedback_score, usage_count")
      .or(keywords.map((k) => `question.ilike.%${k}%`).join(","))
      .order("user_feedback_score", { ascending: false })
      .limit(3);

    if (!data || data.length === 0) return "";

    const lines = data.map((qa: { question: string; answer: string; user_feedback_score: number | null; usage_count: number | null }) =>
      `Q: ${qa.question}\nA: ${qa.answer} (skor: ${qa.user_feedback_score ?? "-"}, kullanim: ${qa.usage_count ?? 0})`
    );
    return `\n### Onceki Ogrenilmis Yanitlar\n${lines.join("\n\n")}`;
  } catch {
    return "";
  }
}

/* ── Fetch learned patterns ── */
async function fetchPatterns(): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "";

  try {
    const { data } = await sb
      .from("ai_learned_patterns")
      .select("pattern_type, pattern_data, confidence_score")
      .order("confidence_score", { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return "";

    const lines = data.map((p: { pattern_type: string; pattern_data: Record<string, unknown>; confidence_score: number | null }) =>
      `- [${p.pattern_type}] ${JSON.stringify(p.pattern_data)} (guven: ${p.confidence_score ?? "-"})`
    );
    return `\n### Ogrenilmis Kaliplar\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/* ── Fetch relevant knowledge from knowledge base ── */
async function fetchKnowledge(question: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "";

  try {
    const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    if (keywords.length === 0) return "";

    const { data } = await sb
      .from("ai_knowledge_base")
      .select("title, category, content, source_type, source_url, reliability_score")
      .or(keywords.map((k) => `content.ilike.%${k}%`).join(","))
      .order("reliability_score", { ascending: false })
      .limit(3);

    if (!data || data.length === 0) return "";

    const lines = data.map((kb: { title: string; category: string; content: string; source_type: string; source_url: string; reliability_score: number | null }) =>
      `#### ${kb.title} (${kb.category})\nKaynak: ${kb.source_type} — ${kb.source_url}\nGuvenilirlik: ${kb.reliability_score ?? "-"}\n${kb.content.slice(0, 1500)}`
    );
    return `\n### Bilgi Tabanindan Ilgili Icerikler\n${lines.join("\n\n")}`;
  } catch {
    return "";
  }
}

/* ── Save conversation to DB ── */
async function saveInteraction(userId: string | null, question: string, answer: string, tokens: { input: number; output: number }) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // 1. Save to ai_qa_learning
    const { data: qa } = await sb.from("ai_qa_learning").insert({
      question,
      answer,
      answer_sources: { model: "nova-ai", tokens },
      user_feedback_score: null,
      expert_verified: false,
      usage_count: 1,
    }).select("id").single();

    // 2. Save to ai_user_interactions
    await sb.from("ai_user_interactions").insert({
      user_id: userId,
      interaction_type: "nova_ai_chat",
      page_path: "/settings",
      action_data: { question_preview: question.slice(0, 200) },
      context: { tokens, qa_id: qa?.id },
    });

    return qa?.id ?? null;
  } catch {
    return null;
  }
}

/* ── System prompt ── */
const SYSTEM_PROMPT = `Sen "Nova AI" adında, RiskNova platformunun kendi yapay zekasısın. Kendini tanıtırken "Nova AI" olarak tanıt. Hiçbir zaman başka bir AI isminden bahsetme. Sen RiskNova'nın bir parçasısın.

## Temel Uzmanlık Alanların
1. **İş Sağlığı ve Güvenliği (İSG)**: Türk İSG mevzuatı, risk değerlendirmesi, iş kazası analizi, KKD, yangın güvenliği, yüksekte çalışma, kimyasal güvenlik
2. **Türk Mevzuatı**: 6331 sayılı İSG Kanunu, ilgili yönetmelikler, Çalışma Bakanlığı genelgeleri
3. **Platform Yönetimi**: RiskNova platformunun özellikleri, firma yönetimi, personel takibi, risk analizi, olay yönetimi
4. **Teknik Konular**: Mühendislik güvenliği, proses güvenliği, ergonomi, çevre yönetimi, ISO standartları
5. **Yönetim**: Eğitim planlama, denetim programları, acil durum planları, DÖF süreçleri

## Öğrenme Davranışı
- Her konuşma veritabanına kaydedilir ve gelecek cevapları iyileştirir
- Önceki sorulardan öğrenilen kalıpları kullanırsın
- Admin geri bildirimi ile cevap kaliten sürekli artar
- Platform verilerini analiz ederek proaktif öneriler sunarsın

## Davranış Kuralları
- Türkçe yanıt ver
- Mevzuat referansı verirken madde numarası belirt
- Platform verileri sağlandığında onları kullanarak analiz yap
- Emin olmadığın konularda bunu belirt
- Markdown formatı kullan`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  try {
    const { message, history, userId } = await request.json() as {
      message: string;
      history: ChatMessage[];
      userId?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Mesaj gerekli" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
    }

    // Build enriched context
    const [platformContext, relevantQA, patterns, knowledge] = await Promise.all([
      buildPlatformContext(),
      fetchRelevantQA(message),
      fetchPatterns(),
      fetchKnowledge(message),
    ]);

    const systemWithContext = `${SYSTEM_PROMPT}\n\n${platformContext}${knowledge}${relevantQA}${patterns}`;

    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemWithContext,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI yanıt vermedi" }, { status: 500 });
    }

    const tokens = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    // Save to database for learning
    const qaId = await saveInteraction(userId ?? null, message, textBlock.text, { input: tokens.inputTokens, output: tokens.outputTokens });

    return NextResponse.json({
      response: textBlock.text,
      usage: tokens,
      qaId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error("Nova AI hatası:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
