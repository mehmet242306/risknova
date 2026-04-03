import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

type LegalReference = {
  law: string;
  article: string;
  description: string;
};

type DetectedRisk = {
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  recommendation: string;
  correctiveActionRequired: boolean;
  pinX: number;
  pinY: number;
  boxX?: number;
  boxY?: number;
  boxW?: number;
  boxH?: number;
  legalReferences: LegalReference[];
};

const SYSTEM_PROMPT = `Sen deneyimli bir Türk İSG uzmanısın. Görseli analiz ederek İŞ GÜVENLİĞİ risklerini tespit edeceksin.

KRİTİK KURAL: SADECE GÖRSELDEKİ GERÇEK DURUMLARI TESPİT ET.
- Görselde ne görüyorsan SADECE onu yaz.
- Görselde olmayan şeyleri UYDURMA. Baret yoksa "baret eksik" yazma — görselde çalışan biri varsa ve baret takmamışsa yaz.
- Görselde insan yoksa KKD riski yazma.
- Görselde yükseklik yoksa "yüksekte çalışma" yazma.
- Görselde LPG tüpü varsa LPG ile ilgili riskleri yaz, genel "ergonomi" veya "baret" yazma.
- Her tespit görseldeki somut bir nesne veya duruma dayanmalı.

ÇIKTI FORMATI:
- Kategori (Türkçe): Depolama, Yangın, Elektrik, Kimyasal, KKD, Düzen/Temizlik, Makine, Çevre, Acil Durum, Ergonomi, Yüksekte Çalışma, İskele, Trafik, Diğer
- Ciddiyet: low (düşük), medium (orta), high (yüksek), critical (kritik)
- Öneri: EN AZ 2-3 cümle yaz. Ne yapılacak, nasıl yapılacak, kim yapacak belirt. "Kontrol edin" gibi genel ifadeler YASAK. Somut aksiyon planı ver.
- Mevzuat: HER TESPİT İÇİN en az 1 mevzuat referansı ver. Kanun/yönetmelik adı + madde numarası + maddenin ne söylediğini 1 cümle ile açıkla. Emin olmadığın mevzuatı yazma ama bildiklerini mutlaka yaz.
- Konum: Riskin görseldeki konumu (x,y yüzde 0-100)

KURALLAR:
- Kaç risk varsa o kadar yaz. Sayı sınırı yok.
- Aynı riski tekrarlama. Farklı görselde aynı risk varsa BİR KEZ yaz.
- Görselde risk yoksa boş dizi dön.
- TÜRKÇE yaz.
- Sadece JSON döndür.`;

const USER_PROMPT = `Bu görselde ne görüyorsan sadece onu analiz et. Görselde olmayan riskleri uydurma.

JSON formatı:
{
  "risks": [
    {
      "title": "Görseldeki somut risk",
      "category": "Türkçe kategori",
      "severity": "low|medium|high|critical",
      "confidence": 0.85,
      "recommendation": "Kısa net öneri",
      "correctiveActionRequired": true,
      "pinX": 50,
      "pinY": 30,
      "boxX": 40,
      "boxY": 20,
      "boxW": 20,
      "boxH": 30,
      "legalReferences": [
        {
          "law": "Kanun/yönetmelik adı",
          "article": "Madde X",
          "description": "Kısa açıklama"
        }
      ]
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "imageBase64 ve mimeType gerekli" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: USER_PROMPT,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI yanıt vermedi" }, { status: 500 });
    }

    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as { risks: DetectedRisk[] };

    return NextResponse.json({ risks: parsed.risks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    const stack = error instanceof Error ? error.stack : "";
    console.error("Risk analizi API hatası:", message, stack);
    return NextResponse.json({ error: message, detail: stack?.slice(0, 500) }, { status: 500 });
  }
}
