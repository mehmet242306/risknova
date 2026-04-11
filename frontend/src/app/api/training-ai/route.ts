import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/supabase/api-auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // GÜVENLİK KATMANI (Parça B Adım 4):
  // Bu route AI sınav/anket sorusu üretimi yapar. Authenticated kullanıcılara
  // sınırlı — anonim Anthropic API çağrısı engellenmeli.
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { topic, questionCount, optionCount, type, description } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "Konu gerekli" }, { status: 400 });
    }

    const isExam = type === "exam";
    const qCount = Math.min(Math.max(questionCount || 10, 1), 50);
    const oCount = Math.min(Math.max(optionCount || 4, 2), 6);

    const prompt = `Sen İSG (İş Sağlığı ve Güvenliği) eğitim uzmanısın. Aşağıdaki konu için ${isExam ? "sınav soruları" : "anket soruları"} oluştur.

KONU: ${topic}
${description ? `AÇIKLAMA: ${description}` : ""}
SORU SAYISI: ${qCount}
${isExam ? `ŞIK SAYISI: ${oCount} (her soruda ${oCount} seçenek olacak, biri doğru)` : ""}

${isExam ? `SINAV SORU KURALLARI:
- Tüm sorular çoktan seçmeli olmalı
- Her sorunun tam olarak ${oCount} şıkkı olmalı (A, B, C${oCount >= 4 ? ", D" : ""}${oCount >= 5 ? ", E" : ""}${oCount >= 6 ? ", F" : ""})
- Her soruda sadece 1 doğru cevap olmalı
- Sorular İSG mevzuatı, uygulamaları ve güvenlik kurallarına uygun olmalı
- Şıklar birbirine yakın ama ayırt edilebilir olmalı
- Kolay, orta ve zor sorular dengeli dağılmalı` : `ANKET SORU KURALLARI:
- Sorular çeşitli tiplerde olabilir: çoktan seçmeli, ölçek (1-5), evet/hayır, açık uçlu
- Sorular çalışan memnuniyeti, güvenlik kültürü, eğitim ihtiyaçları gibi konularda olmalı
- Sorular tarafsız ve yönlendirici olmamalı`}

ÇIKTI FORMATI (JSON dizisi, başka metin ekleme):
[
  {
    "questionText": "Soru metni",
    "questionType": "${isExam ? "multiple_choice" : "mixed"}",
    "options": [
      {"label": "Şık metni", "value": "A", "isCorrect": ${isExam ? "true/false" : "false"}},
      ...
    ],
    "points": 1
  },
  ...
]

${!isExam ? `Anket soruları için questionType şu değerlerden biri olmalı: "multiple_choice", "scale", "yes_no", "open_ended"
- scale tipinde options boş dizi [] olmalı
- yes_no tipinde options: [{"label":"Evet","value":"yes"},{"label":"Hayır","value":"no"}]
- open_ended tipinde options boş dizi [] olmalı` : ""}

SADECE JSON dizisi döndür, başka açıklama ekleme.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI yanıtından sorular çıkarılamadı" }, { status: 500 });
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error(`[training-ai] [${new Date().toISOString()}] [user=${auth.userId}] error:`, error);
    return NextResponse.json({ error: "AI soru oluşturma hatası" }, { status: 500 });
  }
}
