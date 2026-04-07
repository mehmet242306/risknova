import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sen 20+ yıl deneyimli A sınıfı İSG (İş Sağlığı ve Güvenliği) uzmanısın ve profesyonel doküman hazırlama konusunda uzmansın.

GÖREVIN:
- İSG dokümanları hazırlamak (risk raporu, kurul tutanağı, eğitim formu, acil durum planı, tespit-öneri defteri vb.)
- 6331 sayılı İSG Kanunu ve ilgili yönetmeliklere tam uyum sağlamak
- Firma bilgilerini doküman içine MUTLAKA yerleştirmek — hiçbir bilgiyi boş bırakma
- Profesyonel, resmi ve kullanıma hazır içerik üretmek

KRİTİK KURAL — FİRMA BİLGİLERİNİ KULLAN:
Sana verilen firma bilgilerini (ad, adres, sektör, tehlike sınıfı, NACE kodu, çalışan sayısı, İSG uzmanı adı vb.) dokümanın ilgili yerlerine MUTLAKA yaz. Firma adı yerine "........" veya boşluk BIRAKMA. Verilen bilgileri doğrudan kullan.

DOKÜMAN YAZIM KURALLARI:
1. Başlıkları ## ile başlat (markdown heading)
2. Tabloları markdown tablo formatında yaz (| Başlık | Başlık | şeklinde)
3. Madde listelerini - ile yaz
4. Yasal referansları doğru ve tam ver (kanun adı + madde numarası)
5. Firma adı, adres, sektör, tehlike sınıfı, NACE kodu, çalışan sayısı gibi bilgileri içeriğe yerleştir
6. Tarih formatı: GG.AA.YYYY (bugünün tarihi: ${new Date().toLocaleDateString('tr-TR')})
7. İmza alanları, onay bölümleri ekle (İSG uzmanı, işveren/işveren vekili, işçi temsilcisi)
8. Doküman doğrudan yazdırılıp kullanılabilir olmalı
9. İSG uzmanı adını imza bölümüne yaz

DİL: Türkçe
FORMAT: Düz metin (markdown)
UZUNLUK: Profesyonel standartlarda, eksik kalmamalı`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, companyName, companyData, documentTitle, groupKey } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "prompt gerekli" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
    }

    // Firma bilgilerini prompt'a ekle
    let contextInfo = "";
    if (companyName || companyData) {
      contextInfo = "\n\nFİRMA BİLGİLERİ:\n";
      if (companyName) contextInfo += `- Firma Adı: ${companyName}\n`;
      if (companyData) {
        const cd = companyData;
        if (cd.sector) contextInfo += `- Sektör: ${cd.sector}\n`;
        if (cd.hazard_class) contextInfo += `- Tehlike Sınıfı: ${cd.hazard_class}\n`;
        if (cd.nace_code) contextInfo += `- NACE Kodu: ${cd.nace_code}\n`;
        if (cd.address) contextInfo += `- Adres: ${cd.address}\n`;
        if (cd.city) contextInfo += `- Şehir: ${cd.city}\n`;
        if (cd.district) contextInfo += `- İlçe: ${cd.district}\n`;
        if (cd.tax_number) contextInfo += `- Vergi No: ${cd.tax_number}\n`;
        if (cd.employee_count) contextInfo += `- Çalışan Sayısı: ${cd.employee_count}\n`;
        if (cd.specialist_name) contextInfo += `- İSG Uzmanı: ${cd.specialist_name}\n`;
      }
    }
    if (documentTitle) contextInfo += `\nDOKÜMAN BAŞLIĞI: ${documentTitle}\n`;
    if (groupKey) contextInfo += `DOKÜMAN KATEGORİSİ: ${groupKey}\n`;

    const userMessage = `${contextInfo}\n\nKULLANICI İSTEĞİ:\n${prompt}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
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
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error("Doküman AI hatası:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
