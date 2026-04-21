import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  parseJsonBody,
  resolveAiDailyLimit,
} from "@/lib/security/server";
import {
  buildManualFallbackResponse,
  executeWithResilience,
} from "@/lib/self-healing/resilience";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sen 20+ yil deneyimli A sinifi ISG uzmani ve profesyonel dokuman hazirlama asistansin.

Gorevin:
- ISG, personel, denetim ve operasyon dokumanlari hazirlamak
- 6331 sayili Kanun ve ilgili yonetmeliklere uygun bir metin uretmek
- Verilen firma bilgilerini dokumana yerlestirmek
- Hazir ciktisi alinabilir, resmi ve duzenli bir markdown metni sunmak

Kurallar:
1. Basliklari markdown heading ile yaz.
2. Gerekli yerlerde markdown tablo kullan.
3. Firma adini, sektoru, tehlike sinifini, NACE kodunu ve diger verilen alanlari bos birakma.
4. Tarih formatini GG.AA.YYYY kullan.
5. Imza ve onay bolumu ekle.
6. Cikti Turkce ve profesyonel olsun.`;

const documentAiSchema = z.object({
  prompt: z.string().min(10).max(8000),
  companyName: z.string().trim().max(250).optional().default(""),
  companyData: z
    .object({
      sector: z.string().max(250).optional(),
      hazard_class: z.string().max(120).optional(),
      nace_code: z.string().max(120).optional(),
      address: z.string().max(500).optional(),
      city: z.string().max(120).optional(),
      district: z.string().max(120).optional(),
      tax_number: z.string().max(80).optional(),
      employee_count: z.union([z.number().int().nonnegative(), z.string().max(40)]).optional(),
      specialist_name: z.string().max(200).optional(),
    })
    .partial()
    .optional()
    .default({}),
  documentTitle: z.string().trim().max(250).optional().default(""),
  groupKey: z.string().trim().max(120).optional().default(""),
});

type DocumentCompanyData = z.infer<typeof documentAiSchema>["companyData"];

function formatDateTr() {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

function normalizeDocumentLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCompanyInfoTable(companyName: string, companyData: DocumentCompanyData) {
  const address = [companyData.address, companyData.district, companyData.city]
    .filter(Boolean)
    .join(", ");

  return [
    "## Firma Bilgileri",
    "",
    "| Alan | Bilgi |",
    "| --- | --- |",
    `| Firma / Kurum | ${companyName || "Firma bilgisi eklenecek"} |`,
    `| Sektor | ${companyData.sector || "Sektor bilgisi eklenecek"} |`,
    `| Tehlike Sinifi | ${companyData.hazard_class || "Tehlike sinifi eklenecek"} |`,
    `| NACE Kodu | ${companyData.nace_code || "NACE bilgisi eklenecek"} |`,
    `| Calisan Sayisi | ${companyData.employee_count ? String(companyData.employee_count) : "Calisan sayisi eklenecek"} |`,
    `| Adres | ${address || "Adres bilgisi eklenecek"} |`,
    `| Vergi No | ${companyData.tax_number || "Vergi bilgisi eklenecek"} |`,
    `| ISG Profesyoneli | ${companyData.specialist_name || "Profesyonel bilgisi eklenecek"} |`,
    `| Dokuman Tarihi | ${formatDateTr()} |`,
    "",
  ].join("\n");
}

function buildSignatureSection(companyData: DocumentCompanyData) {
  return [
    "## Imza ve Onay",
    "",
    "| Taraf | Ad Soyad / Unvan | Imza | Tarih |",
    "| --- | --- | --- | --- |",
    `| Hazirlayan | ${companyData.specialist_name || "ISG Profesyoneli"} |  | ${formatDateTr()} |`,
    "| Isveren / Isveren Vekili |  |  |  |",
    "| Calisan / Ilgili Personel |  |  |  |",
    "",
  ].join("\n");
}

function buildEmploymentContractScaffold(companyName: string, companyData: DocumentCompanyData) {
  return [
    "# Is Sozlesmesi",
    "",
    buildCompanyInfoTable(companyName, companyData),
    "## 1. Taraflar",
    "",
    `Bu sozlesme, bir tarafta ${companyName || "ilgili firma"} ile diger tarafta gorevlendirilecek personel arasinda kurulmustur.`,
    "",
    "## 2. Konu ve Kapsam",
    "",
    "Bu belge; personelin gorevlendirilecegi is kapsamlarini, calisma esaslarini, is sagligi ve guvenligi yukumluluklerini ve taraflarin operasyonel sorumluluklarini duzenler.",
    "",
    "## 3. Gorev ve Sorumluluklar",
    "",
    "- Calisan, gorevlendirildigi firma ve workspace kapsamindaki gorevleri yerine getirir.",
    "- ISG, dokuman, denetim ve saha akislarinda RiskNova uzerinden kayit tutar.",
    "- Isveren / vekil gerekli bilgi, belge ve operasyonel erisimi saglar.",
    "",
    "## 4. Calisma Sekli ve Yeri",
    "",
    `Calisma yeri ${companyName || "ilgili firma"} sahalari, hizmet verilen musteriler ve uzaktan operasyon gerektiren dijital kanallari kapsar.`,
    "",
    "## 5. Ucret ve Yan Haklar",
    "",
    "| Kalem | Aciklama |",
    "| --- | --- |",
    "| Ucret | Taraflarca belirlenecektir. |",
    "| Calisma Duzeni | Tam zamanli / yari zamanli / proje bazli olarak netlestirilir. |",
    "| Ek Haklar | Yol, yemek, ekipman ve diger haklar isveren kaydina gore tanimlanir. |",
    "",
    "## 6. ISG, Gizlilik ve Veri Koruma",
    "",
    "- 6331 sayili Kanun ve ilgili yonetmelikler esas alinir.",
    "- Ticari sirlar, personel bilgileri ve saha verileri yetki disinda paylasilamaz.",
    "- Dokuman, rapor ve operasyon kayitlari firma bazli arsiv politikasina tabidir.",
    "",
    "## 7. Yasal Dayanak",
    "",
    "- 4857 sayili Is Kanunu",
    "- 6331 sayili Is Sagligi ve Guvenligi Kanunu",
    "- Isyeri Hekimi ve Is Guvenligi Uzmanlarinin Gorev, Yetki ve Sorumluluklari Hakkinda Yonetmelik",
    "",
    "## 8. Yururluk",
    "",
    "Bu sozlesme taraflarca imzalandigi tarihte yururluge girer. Ek maddeler ve ozel kosullar gerekiyorsa bu bolum altinda ayrica belirtilir.",
    "",
    buildSignatureSection(companyData),
  ].join("\n");
}

function buildPrivacyContractScaffold(companyName: string, companyData: DocumentCompanyData) {
  return [
    "# Gizlilik Sozlesmesi",
    "",
    buildCompanyInfoTable(companyName, companyData),
    "## 1. Amac",
    "",
    "Bu sozlesme, firma ve musteri verilerinin gizliligini korumak, yetkisiz erisim ve ifsayi engellemek amaciyla duzenlenmistir.",
    "",
    "## 2. Gizli Bilgi Tanimi",
    "",
    "- Personel kayitlari ve ozluk belgeleri",
    "- Risk degerlendirmeleri, DOF kayitlari ve denetim ciktilari",
    "- Saglik, maruziyet ve olcum raporlari",
    "- Musteri, tedarikci ve sozlesme bilgileri",
    "",
    "## 3. Yukumlulukler",
    "",
    "- Gizli bilgiler yalnizca gorev kapsami icinde kullanilir.",
    "- Dokumanlar izinsiz kopyalanamaz, aktarilamaz veya paylasilamaz.",
    "- Erisim loglari ve paylasim kayitlari RiskNova uzerinde izlenir.",
    "",
    "## 4. Ihlal Durumu",
    "",
    "Yetkisiz erisim, veri sizintisi veya suphesi olusan hallerde durum derhal OSGB yonetimine bildirilir ve olay kaydi acilir.",
    "",
    "## 5. Yasal Dayanak",
    "",
    "- 6698 sayili KVKK",
    "- 6331 sayili Is Sagligi ve Guvenligi Kanunu",
    "- Ticari sir ve gizlilik hukuku kapsamindaki ilgili mevzuat",
    "",
    buildSignatureSection(companyData),
  ].join("\n");
}

function buildRoleDescriptionScaffold(companyName: string, companyData: DocumentCompanyData) {
  return [
    "# Gorev Tanim Belgesi",
    "",
    buildCompanyInfoTable(companyName, companyData),
    "## 1. Pozisyon",
    "",
    "| Alan | Deger |",
    "| --- | --- |",
    "| Unvan | Belirlenecek |",
    "| Bagli Oldugu Birim | OSGB Operasyon / Musteri Hizmetleri |",
    "| Raporlama | Sorumlu mudur / operasyon yoneticisi |",
    "",
    "## 2. Temel Sorumluluklar",
    "",
    "- Atandigi firma ve workspace'lerde operasyonu takip etmek",
    "- Risk, dokuman ve gorev kayitlarini guncel tutmak",
    "- Denetim paketi icin gerekli kanitlari toplamak",
    "- Gecikme, uygunsuzluk ve kritik riskleri yonetime eskale etmek",
    "",
    "## 3. Yetki Sinirlari",
    "",
    "- Yalnizca atanmis firmalara ait verilere erisir.",
    "- Onay ve imza yetkisi varsa bu belgeye eklenir.",
    "- Firma disi veri paylasimi yasaktir.",
    "",
    "## 4. Yetkinlik ve Beklentiler",
    "",
    "- Rolun gerektirdigi sertifika ve mesleki belgeleri guncel tutmak",
    "- ISG mevzuati, dokuman disiplini ve saha operasyonlarina uygun calismak",
    "- RiskNova uzerinden is emri, dokuman ve kanit akisini eksiksiz kaydetmek",
    "",
    buildSignatureSection(companyData),
  ].join("\n");
}

function buildGenericDocumentScaffold(
  documentTitle: string,
  groupKey: string,
  companyName: string,
  companyData: DocumentCompanyData,
) {
  return [
    `# ${documentTitle || "Dokuman Taslagi"}`,
    "",
    buildCompanyInfoTable(companyName, companyData),
    "## 1. Amac ve Kapsam",
    "",
    `${documentTitle || "Bu dokuman"}, ${companyName || "ilgili firma"} icin ${groupKey || "genel dokuman"} kapsaminda hazirlanmistir.`,
    "",
    "## 2. Operasyonel Icerik",
    "",
    "- Firma bazli uygulanacak adimlar",
    "- Sorumlu personel ve onay akisleri",
    "- Kanit ve arsiv gereksinimleri",
    "",
    "## 3. Yasal Dayanak ve Referans",
    "",
    "- 6331 sayili Is Sagligi ve Guvenligi Kanunu",
    "- Ilgili yonetmelik ve ic prosedurler",
    "",
    "## 4. Notlar",
    "",
    "Bu taslak yerel korumali modda olusturulmustur. Gerekli alanlari firma, personel ve operasyon bilgileriyle netlestiriniz.",
    "",
    buildSignatureSection(companyData),
  ].join("\n");
}

function buildLocalDocumentScaffold({
  documentTitle,
  groupKey,
  companyName,
  companyData,
}: {
  documentTitle: string;
  groupKey: string;
  companyName: string;
  companyData: DocumentCompanyData;
}) {
  const normalizedTitle = normalizeDocumentLabel(documentTitle);

  if (normalizedTitle.includes("is sozlesmesi")) {
    return buildEmploymentContractScaffold(companyName, companyData);
  }

  if (normalizedTitle.includes("gizlilik sozlesmesi")) {
    return buildPrivacyContractScaffold(companyName, companyData);
  }

  if (normalizedTitle.includes("gorev tanim")) {
    return buildRoleDescriptionScaffold(companyName, companyData);
  }

  return buildGenericDocumentScaffold(documentTitle, groupKey, companyName, companyData);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/document-ai",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "document_ai" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const parsedBody = await parseJsonBody(request, documentAiSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { prompt, companyName, companyData, documentTitle, groupKey } = parsedBody.data;

    if (!prompt) {
      return NextResponse.json({ error: "prompt gerekli" }, { status: 400 });
    }

    let contextInfo = "";
    if (companyName || companyData) {
      contextInfo = "\n\nFIRMA BILGILERI:\n";
      if (companyName) contextInfo += `- Firma Adi: ${companyName}\n`;
      if (companyData) {
        if (companyData.sector) contextInfo += `- Sektor: ${companyData.sector}\n`;
        if (companyData.hazard_class) contextInfo += `- Tehlike Sinifi: ${companyData.hazard_class}\n`;
        if (companyData.nace_code) contextInfo += `- NACE Kodu: ${companyData.nace_code}\n`;
        if (companyData.address) contextInfo += `- Adres: ${companyData.address}\n`;
        if (companyData.city) contextInfo += `- Sehir: ${companyData.city}\n`;
        if (companyData.district) contextInfo += `- Ilce: ${companyData.district}\n`;
        if (companyData.tax_number) contextInfo += `- Vergi No: ${companyData.tax_number}\n`;
        if (companyData.employee_count) contextInfo += `- Calisan Sayisi: ${companyData.employee_count}\n`;
        if (companyData.specialist_name) contextInfo += `- ISG Uzm: ${companyData.specialist_name}\n`;
      }
    }
    if (documentTitle) contextInfo += `\nDOKUMAN BASLIGI: ${documentTitle}\n`;
    if (groupKey) contextInfo += `DOKUMAN KATEGORISI: ${groupKey}\n`;

    const userMessage = `${contextInfo}\n\nKULLANICI ISTEGI:\n${prompt}`;
    const localFallbackContent = buildLocalDocumentScaffold({
      documentTitle,
      groupKey,
      companyName,
      companyData,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      return buildManualFallbackResponse({
        message:
          "AI dokuman servisi ana modele ulasamadi. Yerel taslak olusturuldu; editorde duzenleyip kaydedebilirsiniz.",
        manualActionLabel: "Yerel taslagi editora ekle",
        extra: {
          content: localFallbackContent,
          fallback: {
            type: "local_scaffold",
            label: "Yerel taslagi editora ekle",
          },
          fallbackSource: "local_scaffold",
        },
      });
    }

    const resilientResponse = await executeWithResilience({
      serviceKey: "anthropic.api",
      displayName: "Anthropic API",
      serviceType: "external_api",
      operationName: "document_ai_generate",
      endpoint: request.nextUrl.pathname,
      userId: auth.userId,
      organizationId: auth.organizationId,
      fallbackMessage:
        "AI dokuman servisi gecici olarak yanit vermiyor. Yerel taslakla devam edebilir veya islemi kuyruga birakabilirsiniz.",
      queueTask: {
        taskType: "ai.document.generate",
        payload: {
          prompt,
          companyName,
          companyData,
          documentTitle,
          groupKey,
        },
        organizationId: auth.organizationId,
        createdBy: auth.userId,
        maxRetries: 5,
      },
      operation: () =>
        client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
    });

    if (!resilientResponse.ok) {
      await logAiUsage({
        userId: auth.userId,
        organizationId: auth.organizationId,
        model: "claude-sonnet-4-20250514",
        endpoint: "/api/document-ai",
        success: false,
        metadata: {
          fallback: true,
          queueTaskId: resilientResponse.queuedTaskId ?? null,
          documentTitle,
          groupKey,
        },
      });

      return buildManualFallbackResponse({
        message: resilientResponse.fallbackMessage,
        queueTaskId: resilientResponse.queuedTaskId,
        manualActionLabel: "Yerel taslagi editora ekle",
        extra: {
          content: localFallbackContent,
          fallback: {
            type: "local_scaffold",
            label: "Yerel taslagi editora ekle",
          },
          fallbackSource: "local_scaffold",
        },
      });
    }

    const response = resilientResponse.data;
    const textBlock = response.content.find((block) => block.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      await logAiUsage({
        userId: auth.userId,
        organizationId: auth.organizationId,
        model: "claude-sonnet-4-20250514",
        endpoint: "/api/document-ai",
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        cachedTokens: Number(
          (
            response.usage as {
              cache_read_input_tokens?: number;
            } | undefined
          )?.cache_read_input_tokens ?? 0,
        ),
        success: false,
        metadata: { reason: "missing_text_block", documentTitle, groupKey },
      });

      await logErrorEvent({
        level: "error",
        source: "document-ai",
        endpoint: "/api/document-ai",
        message: "Anthropic response did not include a text block.",
        context: { documentTitle, groupKey, companyName },
        userId: auth.userId,
        organizationId: auth.organizationId,
      });

      return buildManualFallbackResponse({
        message:
          "AI servisi yanit metni uretmedi. Yerel taslak hazirlandi; duzenleyerek devam edebilirsiniz.",
        manualActionLabel: "Yerel taslagi editora ekle",
        extra: {
          content: localFallbackContent,
          fallback: {
            type: "local_scaffold",
            label: "Yerel taslagi editora ekle",
          },
          fallbackSource: "local_scaffold",
        },
      });
    }

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: "claude-sonnet-4-20250514",
      endpoint: "/api/document-ai",
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      cachedTokens: Number(
        (
          response.usage as {
            cache_read_input_tokens?: number;
          } | undefined
        )?.cache_read_input_tokens ?? 0,
      ),
      success: true,
      metadata: { documentTitle, groupKey, companyName },
    });

    return NextResponse.json({
      content: textBlock.text,
      degraded: resilientResponse.degraded,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error("Dokuman AI hatasi:", message);
    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: "claude-sonnet-4-20250514",
      endpoint: "/api/document-ai",
      success: false,
      metadata: { error: message.slice(0, 300) },
    });
    await logErrorEvent({
      level: "error",
      source: "document-ai",
      endpoint: "/api/document-ai",
      message,
      stackTrace: error instanceof Error ? error.stack : null,
      context: { feature: "document_generation" },
      userId: auth.userId,
      organizationId: auth.organizationId,
    });
    await logSecurityEvent(request, "ai.document.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: { message: message.slice(0, 300) },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
