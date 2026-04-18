/**
 * POST /api/rca/narrative
 *
 * R₂D-RCA hesaplama sonucuna göre Claude AI ile Türkçe değerlendirme + aksiyon üretir.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/supabase/api-auth";
import { enforceRateLimit } from "@/lib/security/server";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1500;

const C_META = [
  "C1 Tehlike Yoğunluğu (Görsel/YOLO) w=0.120",
  "C2 KKD Uygunsuzluğu (Görsel+Kayıt) w=0.085",
  "C3 Davranış Riski (Görsel+Bölge) w=0.145",
  "C4 Çevresel Stres (Sensör) w=0.085",
  "C5 Kimyasal/Atmosferik (Sensör+SCADA) w=0.145",
  "C6 Erişim/Engel (Görsel+Sensör) w=0.075",
  "C7 Makine/Proses (Sensör+CMMS) w=0.165",
  "C8 Araç-Trafik (Görsel+RTLS) w=0.105",
  "C9 Örgütsel Yük/Yorgunluk (Kayıt+Sensör) w=0.075",
];

const SYSTEM_PROMPT = `Sen RiskNova platformunun R₂D-RCA (C1-C9) uzmanısın. 20+ yıl Türkiye İSG tecrübesine sahipsin. 6331 Sayılı Kanun, ISO 45001 ve TS İSG mevzuatına hakimsin.

R₂D-RCA 9 boyutlu kompozit risk metriğidir:
${C_META.join("\n")}

Δ̂_i = max(0, t1 - t0) (risk artışı). R_RCA = max_i Δ̂_i (override τ=0.40) veya Σ w_i Δ̂_i (base). Stabilite bozulursa dual reporting gerekir.

Verilen hesaplama sonucuna göre Türkçe narrative + 3-5 key insight + önerilen aksiyonlar üret. 6331 Sayılı Kanun madde referansı ver. Üslup: teknik, profesyonel, eylemsel. SADECE geçerli JSON döndür.`;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
    }

    const rateLimited = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/rca/narrative",
      scope: "ai",
      limit: 10,
      windowSeconds: 60,
      planKey: "incident_ai",
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const {
      t0 = [], t1 = [], deltaHat = [],
      rRcaScore = 0, calculationMode = "base_score",
      overrideTriggered = false, dualReportingRequired = false,
      maxDeltaHatIndex = 0, maxWeightedIndex = 0,
      incidentTitle = "", incidentDescription = "",
    } = body ?? {};

    const userPrompt = `Olay: ${incidentTitle}${incidentDescription ? "\nAçıklama: " + incidentDescription : ""}

t0 (olay öncesi) skorlar: [${t0.map((v: number) => v.toFixed(3)).join(", ")}]
t1 (olay anı) skorlar: [${t1.map((v: number) => v.toFixed(3)).join(", ")}]
Δ̂ (bozulma): [${deltaHat.map((v: number) => v.toFixed(3)).join(", ")}]

R_RCA = ${rRcaScore.toFixed(3)} (${calculationMode})
Override: ${overrideTriggered ? "AKTİF" : "pasif"}
Max Δ̂ boyutu: C${maxDeltaHatIndex + 1}
Max ağırlıklı boyut: C${maxWeightedIndex + 1}
${dualReportingRequired ? "⚠ Dual Reporting Protocol gerekli (i* ≠ j*)" : "Stabilite: normal"}

SADECE şu JSON şemasına uygun cevap ver:
{
  "narrative": "2-4 cümle Türkçe analiz. Hangi boyut en kritik, neden, 6331 atfı.",
  "key_insights": ["içgörü 1", "içgörü 2", "içgörü 3"],
  "actions": [
    {"title": "Aksiyon başlığı", "priority": "Kritik|Yüksek|Orta|Düşük", "deadline_days": 14, "responsible": "İSG Uzmanı"}
  ]
}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "AI boş yanıt" }, { status: 502 });
    }

    // JSON parse
    const match = text.text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Geçerli JSON bulunamadı", raw: text.text }, { status: 502 });
    }

    try {
      const parsed = JSON.parse(match[0]);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "JSON parse hatası", raw: text.text }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
