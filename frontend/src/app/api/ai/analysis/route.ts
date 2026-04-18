import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import { enforceRateLimit } from "@/lib/security/server";
import type { AnalysisMethod } from "@/lib/analysis/types";
import { R2D_RCA_COMPACT_PROMPT } from "@/lib/prompts/r2d_rca_prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2000;

export const maxDuration = 60;

/* ------------------------------------------------------------------ */
/*  Yonteme gore system prompt                                         */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(method: AnalysisMethod): string {
  const base = `Sen 20+ yil deneyimli, Turkiye'de ISG uzmanisin. 6331 Sayili Kanun, ISO 45001 ve Turkiye ISG mevzuatina hakimsin. SADECE gecerli JSON don, aciklama YAZMA.`;

  const specific: Record<AnalysisMethod, string> = {
    ishikawa: `${base}\nIshikawa (6M) analizi yap. 6 kategoride her biri icin 2-4 kok neden uret.`,
    five_why: `${base}\n5 Neden (5 Why) analizi yap. Verilen baglamda bir sonraki neden sorusunu uret veya kok nedeni belirle.`,
    fault_tree: `${base}\nHata Agaci (FTA) analizi yap. Ust olay, alt olaylar, VE/VEYA kapilari ve temel olaylar iceren bir agac yapisi olustur.`,
    scat: `${base}\nSCAT (Bird modeli) analizi yap. 4 seviye: anlik olay, anlik nedenler, temel nedenler, kontrol eksiklikleri.`,
    bow_tie: `${base}\nBow-Tie analizi yap. Tehlike, kritik olay, tehditler, sonuclar, onleyici ve hafifletici bariyerler.`,
    mort: `${base}\nMORT analizi yap. Yonetim gozden gecirme ve risk agaci cercevesinde analiz olustur.`,
    r2d_rca: `${base}\n\nSen bir R\u2082D-RCA (C1-C9) uzmanisin. 9 boyutlu R\u2082D risk metrik vektoru: C1 Tehlike Yogunlugu, C2 KKD Uygunsuzlugu, C3 Davranis Riski, C4 Cevresel Stres, C5 Kimyasal/Atmosferik, C6 Erisim/Engel, C7 Makine/Proses, C8 Arac-Trafik, C9 Orgutsel Yuk. Skorlar [0,1] araliginda SUREKLI (yuksek = yuksek risk). Verilen olaya gore olay oncesi (t0) ve olay ANI (t1) skorlari ure. Risk bir boyutta artmissa t1 > t0 olmali. Ayrica kisa Turkce narrative (2-3 cumle).`,
  };

  return specific[method];
}

/* ------------------------------------------------------------------ */
/*  Yonteme gore kullanici promptu                                     */
/* ------------------------------------------------------------------ */

function buildUserPrompt(
  method: AnalysisMethod,
  title: string,
  description?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any,
): string {
  const base = `OLAY: ${title}${description ? `\nACIKLAMA: ${description}` : ""}`;

  const prompts: Record<AnalysisMethod, string> = {
    ishikawa: `${base}\n\nSADECE JSON:\n{"insan":["n1","n2","n3"],"makine":["n1","n2","n3"],"yontem":["n1","n2","n3"],"malzeme":["n1","n2","n3"],"cevre":["n1","n2","n3"],"yonetim":["n1","n2","n3"]}`,

    five_why: `${base}

5 Neden (5 Why) analizi yap. Mevcut neden zinciri:
${JSON.stringify(context?.whys || [], null, 2)}

OLAY: ${title}
${description ? `\nAÇIKLAMA: ${description}` : ""}

KURALLAR:
1. Her "Neden?" sorusu BİR ÖNCEKİ cevabın derinine iner. İlk soruda olayı sorgular.
2. Cevap (suggestedAnswer) konkret, olay-spesifik olmalı — placeholder/genel ifadeler YASAK ("makine arızalı" yerine "Tsudakoma ZAX9100'ün otomatik durdurma sensörünün kalibrasyonu bozuk").
3. Uzman düzeltebilsin diye cevap KISA (1-2 cümle), net olsun.
4. ${(context?.whys?.length ?? 0) >= 4 || (context?.whys?.length ?? 0) >= 1 && (context?.whys ?? []).every((w: { answer: string }) => w.answer?.trim()) && (context?.whys?.length ?? 0) >= 5
      ? "Kök neden tespit zamanı — SADECE JSON: {\"nextQuestion\":\"\",\"suggestedAnswer\":\"\",\"rootCause\":\"Tek cümlede sistemik kök neden\",\"done\":true}"
      : (context?.whys?.length ?? 0) === 0 || ((context?.whys ?? []).every((w: { question: string; answer: string }) => !w.answer?.trim()))
        ? "İLK Neden sorusu üret + olay anlatımına göre konkret, dolu suggestedAnswer ver. SADECE JSON: {\"nextQuestion\":\"Neden bu olay yaşandı? (örn. 'Neden parmak makine mekanizmasına sıkıştı?')\",\"suggestedAnswer\":\"Olay anlatımından çıkarılan konkret cevap (örn. 'Operatör manuel müdahale sırasında elini koruma yokken makineye yaklaştırdı')\",\"done\":false}"
        : "Bir önceki cevaba göre SONRAKİ Neden sorusu + konkret suggestedAnswer üret. SADECE JSON: {\"nextQuestion\":\"Neden [son cevaptaki olgu]?\",\"suggestedAnswer\":\"Bir alt katman neden - konkret\",\"done\":false}"
}`,

    fault_tree: `${base}\n\nSADECE JSON:\n{"topEvent":"ust olay","nodes":[{"id":"n1","label":"...","type":"event","parentId":null,"children":["n2","n3"]},{"id":"n2","label":"...","type":"or_gate","parentId":"n1","children":["n4","n5"]},{"id":"n4","label":"...","type":"basic_event","parentId":"n2","children":[]}]}`,

    scat: `${base}

DNV-Bird modeli SCAT analizi yap. Her olay icin asagidaki kategorilerden HANGILERININ uygulandigini tespit et ve DİZİ olarak DİZİN NUMARALARINI dondur (0-indexed).

OLAY TIPI (0-12):
0 Carpma 1 Carpilma 2 Yuksekten dusme 3 Ayni seviyede dusme 4 Sikisma(pinch) 5 Takilma 6 Arada/altinda sikisma 7 Temas(elektrik/isi/kimyasal vb) 8 Anormal operasyon 9 Urun kontaminasyonu 10 Asiri yuk/basinc/ergonomik 11 Ekipman arizasi 12 Cevresel salinim

STANDART-ALTI DAVRANISLAR (0-19):
0 Yetkisiz ekipman kullanimi 1 Uyari yapmama 2 Sabitleme hatasi 3 Uygunsuz hizda calisma 4 Guvenlik cihazlarini devre disi 5 Arizali ekipman kullanma 6 KKD'yi dogru kullanmama 7 Hatali yukleme 8 Hatali yerlestirme 9 Hatali kaldirma 10 Yanlis pozisyon 11 Calisan ekipmana servis 12 Sakalasma 13 Alkol/uyusturucu 14 Ekipmani yanlis kullanma 15 Prosedur ihlali 16 Tehlike tespit etmeme 17 Kontrol/izleme hatasi 18 Tepki hatasi 19 Iletisim eksikligi

STANDART-ALTI KOSULLAR (0-19):
0 Yetersiz koruyucu 1 Yetersiz KKD 2 Arizali alet/ekipman 3 Sikisiklik 4 Yetersiz uyari sistemi 5 Yangin/patlama tehlikesi 6 Duzensizlik 7 Gurultu maruziyeti 8 Radyasyon 9 Asiri sicaklik 10 Yetersiz aydinlatma 11 Yetersiz havalandirma 12 Zararli madde 13 Yetersiz talimat/prosedur 14 Yetersiz bilgi 15 Yetersiz hazirlik/planlama 16 Yetersiz destek 17 Yetersiz iletisim donanimi 18 Yol kosullari 19 Hava kosullari

KISISEL FAKTORLER (0-7):
0 Yetersiz fiziksel kapasite 1 Yetersiz zihinsel kapasite 2 Fiziksel stres 3 Zihinsel stres 4 Bilgi eksikligi 5 Beceri eksikligi 6 Yetersiz motivasyon 7 Istismar/kotuye kullanim

IS/SISTEM FAKTORLERI (0-7):
0 Yetersiz liderlik/denetim 1 Yetersiz muhendislik 2 Yetersiz satin alma 3 Yetersiz bakim 4 Yetersiz alet/ekipman 5 Yetersiz is standartlari 6 Asiri asinma 7 Yetersiz iletisim

CAN PROGRAMLARI (0-21):
0 Liderlik/Yonetim 1 Liderlik egitimi 2 Planli denetim/bakim 3 Kritik gorev analizi 4 Olay sorusturma 5 Gorev gozlemleme 6 Acil durum hazirligi 7 Kurallar/calisma izinleri 8 Olay analizi 9 Bilgi/beceri egitimi 10 KKD 11 Saglik/hijyen kontrolu 12 Sistem degerlendirme 13 Muhendislik/degisim yonetimi 14 Kisisel iletisim 15 Grup iletisimi 16 Genel tanitim 17 Ise alim/yerlestirme 18 Malzeme/hizmet yonetimi 19 Is disi guvenlik 20 Cevresel yonetim 21 Kalite yonetimi

SADECE JSON dondur (Turkce metinler + dizin dizileri):
{
  "immediateEvent": "olayin kisa tanimi (1-2 cumle)",
  "immediateCauses": ["bu olay icin tespit edilen anlik nedenler", "..."],
  "basicCauses": ["bu olay icin tespit edilen temel nedenler", "..."],
  "controlDeficiencies": ["bu olay icin kontrol eksiklikleri", "..."],
  "suggestedTypeIndices": [4, 11],
  "suggestedActIndices": [5, 11, 15],
  "suggestedConditionIndices": [0, 2, 13],
  "suggestedPersonalFactorIndices": [4, 6],
  "suggestedJobFactorIndices": [0, 3, 5],
  "suggestedCanIndices": [2, 3, 4, 9],
  "lossSeverity": "serious",
  "probability": "moderate",
  "frequency": "moderate",
  "impactPeople": true,
  "impactProperty": false,
  "impactProcess": true,
  "impactEnvironmental": false
}

KURAL: lossSeverity in {"major","serious","minor"}; probability/frequency in {"high","moderate","low"} (frequency'de "extensive" de gecerli). Indeks dizileri SADECE yukaridaki listelerdeki gecerli sayilar. Her dizi en az 1 en fazla 5 eleman icermeli.`,

    bow_tie: `${base}\n\nSADECE JSON:\n{"hazard":"tehlike","topEvent":"kritik olay","threats":[{"id":"t1","label":"tehdit","causes":["n1","n2"]}],"consequences":[{"id":"c1","label":"sonuc","effects":["e1","e2"]}],"preventiveBarriers":[{"id":"b1","label":"bariyer","threatId":"t1","working":false}],"mitigatingBarriers":[{"id":"b2","label":"bariyer","consequenceId":"c1","working":false}]}`,

    mort: `${base}

MORT (Management Oversight and Risk Tree) — DOE/ANSI standardı yönetim-gozetim ağaç analizi yap.

YAPISI:
1. ÜST OLAY + ENERJI TIPI (enerji kaynagi → savunmasiz hedef akisi)
2. S DALI — Spesifik Kontrol Faktörleri: SA1 enerji kontrolü, SA2 hedef korumasi, SA3 genel bariyerler
3. M DALI — Yonetim Sistemi Faktörleri: politika, uygulama, risk değerlendirme, kaynak, iletişim, eğitim, izleme (her biri yeterli/LTA/değerlendirilmedi)
4. EVENT SEQUENCE — olay zinciri (sirali)
5. CHANGE ANALYSIS — ne değişti, neden, etkisi
6. ROOT CAUSE + ÖNERILER

KURALLAR (ÇOK ÖNEMLİ — PROFESYONEL MORT DENGELİ ANALİZ İÇİN):

1. Bariyer ve yönetim faktörü status DEĞERLERI:
   - "adequate" → Olayla ilgili bilgiye göre bu bariyer/faktör YETERLİ çalışmış. (Örn: Kontrol elemanı müdahale etti → "adequate")
   - "lta" → Yetersiz, eksik, devre dışı veya olaya katkıda bulunmuş. (Örn: Otomatik durdurma arızalı → "lta")
   - "not_assessed" → Olay bilgisinden çıkarım yapılamayacak, uzman denetimi gereken alanlar. Örn: denetim kayıtları, iç politika yazıları.

2. DENGELI OL — her şeyi LTA yapma. Gerçek MORT analizinde TIPIK OLARAK:
   - %30-50 LTA (olaya katkı veren yetersizlikler)
   - %30-50 adequate (çalışan bariyer/kontroller)
   - %0-20 not_assessed (bilgi eksik)
   Olay anlatımında açıkça çalışan bir bariyer var mı? (Örn: "ilk yardım yapıldı", "kontrolör müdahale etti") → adequate. Açıkça yetersiz? → lta. Belirsiz → not_assessed.

3. 7 yönetim faktörünün HEPSİ için karar ver. Bilgi yoksa "not_assessed" kullanabilirsin ama bunu 2'den fazla kullanma — olaydan ÇIKARIM yapabileceğin alanlar var (örn: eğitim eksikliği olay kaynaklıysa → "lta").

4. En az 2 SA1 + 2 SA2 + 2 SA3 bariyeri üret. En az biri her kategoride "adequate" olabilir (mevcut sistem çalışan bariyerleri de var). Her birinin notes alanı dolu.

5. eventSequence min 4 adım, recommendations min 4 SMART öneri, changeAnalysis 3 alan dolu, primaryRootCause sistemik.

6. riskAssumed: Bilinçli risk üstlenildi mi? (True: SIK karşılaşılan bir yetersizlik olmasına rağmen önlem alınmamışsa.)

SONUÇ ÜRETMEK ZORUNDASIN — DENGELI, PROFESYONEL, TARAFSIZ. Her şeyi kötü veya iyi göstermek yerine GERÇEK durumu yansıt.

SADECE JSON:
{
  "topEvent": "olay ozeti (1 cumle)",
  "energyType": "kinetik/termal/kimyasal/elektriksel/mekanik/biyolojik/radyasyon/akustik",
  "energySource": "olaydaki spesifik enerji kaynagi (orn. Dokuma makinesi mekanizmasi)",
  "vulnerableTarget": "savunmasiz hedef (orn. Operatörün elleri)",
  "sections": {
    "whatHappened": "olay akisi 2-3 cumle",
    "supervisoryControl": ["yonetici/nezaretçi eksiklikleri"],
    "managementSystem": ["yonetim sistemi eksiklikleri"],
    "lessonsLearned": ["cikarilan dersler"]
  },
  "sa1Barriers": [
    {"label":"Enerji kaynağını kontrol eden bariyer (orn. Otomatik durdurma)","status":"lta","notes":"Neden yetersiz"}
  ],
  "sa2Barriers": [
    {"label":"Hedefi koruyan bariyer (orn. Koruma kapagi)","status":"lta","notes":"..."}
  ],
  "sa3Barriers": [
    {"label":"Yonetimsel bariyer (orn. LOTO prosedürü)","status":"adequate","notes":"..."}
  ],
  "eventSequence": [
    "1. Olay öncesi durum",
    "2. Tetikleyici",
    "3. Barrier failure",
    "4. Sonuç"
  ],
  "changeAnalysis": {
    "whatChanged": "Onceki durumdan farkli olarak ne oldu",
    "whyChanged": "Bu değişiklik neden yaşandi",
    "effectOfChange": "Etkisi ne oldu"
  },
  "mortMgmtFactors": {
    "policy": "adequate|lta|not_assessed",
    "implementation": "adequate|lta|not_assessed",
    "riskAssessment": "adequate|lta|not_assessed",
    "resources": "adequate|lta|not_assessed",
    "communication": "adequate|lta|not_assessed",
    "training": "adequate|lta|not_assessed",
    "monitoring": "adequate|lta|not_assessed"
  },
  "riskAssumed": false,
  "primaryRootCause": "Tek cumlede MORT metoduna gore sistemik kök neden",
  "recommendations": ["Oneri 1","Oneri 2","Oneri 3"]
}`,

    r2d_rca: `${base}\n\nOlay aciklamasini analiz et ve 9 R\u2082D boyut icin t0 (olay oncesi) + t1 (olay ani) skorlari ure. Skorlar [0,1] arasi surekli ondalik. Olay ile ilgili boyutlarda t1 > t0 olmali.\n\nBoyut sirasi (0-indexed array): [C1, C2, C3, C4, C5, C6, C7, C8, C9]\nC1=Tehlike Yogunlugu, C2=KKD Uygunsuzlugu, C3=Davranis Riski, C4=Cevresel Stres, C5=Kimyasal/Atmosferik, C6=Erisim/Engel, C7=Makine/Proses, C8=Arac-Trafik, C9=Orgutsel Yuk\n\nSADECE JSON (array'ler 9 elemanli):\n{"t0":[0.2,0.1,0.3,0.2,0.3,0.1,0.2,0.3,0.1],"t1":[0.2,0.1,0.5,0.4,0.7,0.1,0.8,0.3,0.4],"narrative":"Kisa Turkce yorum"}`,
  };

  return prompts[method];
}

/* ------------------------------------------------------------------ */
/*  POST — AI analiz                                                   */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanimli degil." }, { status: 500 });
    }

    const rateLimited = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/ai/analysis",
      scope: "ai",
      limit: 15,
      windowSeconds: 60,
      planKey: "incident_ai",
      metadata: { feature: "root_cause_analysis" },
    });
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { method, incidentTitle, incidentDescription, context } = body as {
      method: AnalysisMethod;
      incidentTitle: string;
      incidentDescription?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context?: any;
    };

    if (!method || !incidentTitle) {
      return NextResponse.json({ error: "method ve incidentTitle zorunlu" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(method),
      messages: [{ role: "user", content: buildUserPrompt(method, incidentTitle, incidentDescription, context) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI yanit vermedi.");
    }

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleaned);

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: MODEL,
      endpoint: "/api/ai/analysis",
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      success: true,
      metadata: { method },
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";

    await logErrorEvent({
      source: "api/ai/analysis",
      message,
      userId: auth.userId,
      organizationId: auth.organizationId,
    }).catch(() => {});

    return NextResponse.json(
      { error: "AI analiz basarisiz. Manuel doldurabilirsiniz.", manualFallback: true },
      { status: 503 },
    );
  }
}
