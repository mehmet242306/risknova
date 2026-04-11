// mevzuat.gov.tr'den mevzuat çekme ve parse etme
// Strateji: PDF yerine .htm dosyalarını kullan (daha hızlı, pdf-parse gereksiz)

export interface MevzuatInfo {
  title: string;
  docNumber: string;
  docType: "law" | "regulation" | "communique" | "circular" | "guide";
  officialGazetteDate: string | null;
  officialGazetteNumber: string | null;
  sourceUrl: string | null;
}

export interface ScrapedArticle {
  articleNumber: string;
  articleTitle: string | null;
  content: string;
}

// ─── Fetch with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── HTML to plain text ─────────────────────────────────────────────────

export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&szlig;/gi, "ş")
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

// ─── Extract text from mevzuat URL (HTM only, no pdf-parse) ────────────

export async function extractMevzuatText(url: string): Promise<string> {
  // .pdf URL'yi .htm'e çevir
  const htmUrl = url.replace(/\.pdf$/i, ".htm");

  const res = await fetchWithTimeout(htmUrl);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${htmUrl}`);

  // mevzuat.gov.tr HTM dosyaları Windows-1254 kodlamalı
  const rawBuf = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "";
  let html: string;
  if (contentType.includes("utf-8")) {
    html = new TextDecoder("utf-8").decode(rawBuf);
  } else {
    html = new TextDecoder("windows-1254").decode(rawBuf);
  }

  const text = htmlToText(html);
  if (text.length < 100) throw new Error("Extracted text too short");
  return text;
}

// ─── Known ISG Mevzuat List ──────────────────────────────────────────────
// sourceUrl artık doğrudan .htm uzantılı

export const ISG_MEVZUAT_LIST: MevzuatInfo[] = [
  { title: "İş Sağlığı ve Güvenliği Kanunu", docNumber: "6331", docType: "law", officialGazetteDate: "2012-06-30", officialGazetteNumber: "28339", sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6331.htm" },
  { title: "İş Kanunu", docNumber: "4857", docType: "law", officialGazetteDate: "2003-06-10", officialGazetteNumber: "25134", sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.4857.htm" },
  { title: "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu", docNumber: "5510", docType: "law", officialGazetteDate: "2006-06-16", officialGazetteNumber: "26200", sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5510.htm" },
  { title: "İSG Risk Değerlendirmesi Yönetmeliği", docNumber: "16925", docType: "regulation", officialGazetteDate: "2012-12-29", officialGazetteNumber: "28512", sourceUrl: null },
  { title: "KKD İşyerlerinde Kullanılması Yönetmeliği", docNumber: "18331", docType: "regulation", officialGazetteDate: "2013-07-02", officialGazetteNumber: "28695", sourceUrl: null },
  { title: "Yapı İşlerinde İSG Yönetmeliği", docNumber: "18581", docType: "regulation", officialGazetteDate: "2013-10-05", officialGazetteNumber: "28786", sourceUrl: null },
  { title: "Kimyasal Maddeler Yönetmeliği", docNumber: "18190", docType: "regulation", officialGazetteDate: "2013-04-12", officialGazetteNumber: "28648", sourceUrl: null },
  { title: "Gürültü Yönetmeliği", docNumber: "18417", docType: "regulation", officialGazetteDate: "2013-07-28", officialGazetteNumber: "28721", sourceUrl: null },
  { title: "Elle Taşıma İşleri Yönetmeliği", docNumber: "18400", docType: "regulation", officialGazetteDate: "2013-07-24", officialGazetteNumber: "28717", sourceUrl: null },
  { title: "İş Ekipmanları Yönetmeliği", docNumber: "18132", docType: "regulation", officialGazetteDate: "2013-04-25", officialGazetteNumber: "28628", sourceUrl: null },
  { title: "Acil Durumlar Yönetmeliği", docNumber: "18282", docType: "regulation", officialGazetteDate: "2013-06-18", officialGazetteNumber: "28681", sourceUrl: null },
  { title: "İSG Eğitimleri Yönetmeliği", docNumber: "18318", docType: "regulation", officialGazetteDate: "2013-05-15", officialGazetteNumber: "28648", sourceUrl: null },
  { title: "İGU Görev ve Yetki Yönetmeliği", docNumber: "16924", docType: "regulation", officialGazetteDate: "2012-12-29", officialGazetteNumber: "28512", sourceUrl: null },
  { title: "İşyeri Hekimi Yönetmeliği", docNumber: "18615", docType: "regulation", officialGazetteDate: "2013-07-20", officialGazetteNumber: "28713", sourceUrl: null },
  { title: "İSG Hizmetleri Yönetmeliği", docNumber: "16923", docType: "regulation", officialGazetteDate: "2012-12-29", officialGazetteNumber: "28512", sourceUrl: null },
  { title: "İSG Kurulları Yönetmeliği", docNumber: "17906", docType: "regulation", officialGazetteDate: "2013-01-18", officialGazetteNumber: "28532", sourceUrl: null },
  { title: "Asbestle Çalışmalar Yönetmeliği", docNumber: "17930", docType: "regulation", officialGazetteDate: "2013-01-25", officialGazetteNumber: "28539", sourceUrl: null },
  { title: "Titreşim Yönetmeliği", docNumber: "18449", docType: "regulation", officialGazetteDate: "2013-08-22", officialGazetteNumber: "28741", sourceUrl: null },
  { title: "İşyeri Bina Yönetmeliği", docNumber: "18592", docType: "regulation", officialGazetteDate: "2013-07-17", officialGazetteNumber: "28710", sourceUrl: null },
  { title: "Sağlık ve Güvenlik İşaretleri Yönetmeliği", docNumber: "18536", docType: "regulation", officialGazetteDate: "2013-09-11", officialGazetteNumber: "28762", sourceUrl: null },
  { title: "Ekranlı Araçlar Yönetmeliği", docNumber: "18105", docType: "regulation", officialGazetteDate: "2013-04-16", officialGazetteNumber: "28620", sourceUrl: null },
  { title: "Tozla Mücadele Yönetmeliği", docNumber: "18632", docType: "regulation", officialGazetteDate: "2013-11-05", officialGazetteNumber: "28812", sourceUrl: null },
  { title: "Biyolojik Etkenler Yönetmeliği", docNumber: "18271", docType: "regulation", officialGazetteDate: "2013-06-15", officialGazetteNumber: "28678", sourceUrl: null },
  { title: "Patlayıcı Ortamlar Yönetmeliği", docNumber: "18154", docType: "regulation", officialGazetteDate: "2013-04-30", officialGazetteNumber: "28633", sourceUrl: null },
  { title: "Büyük Endüstriyel Kazalar Yönetmeliği", docNumber: "18872", docType: "regulation", officialGazetteDate: "2013-12-30", officialGazetteNumber: "28867", sourceUrl: null },
];

// ─── Parse Legal Text to Articles ─────────────────────────────────────────

export function parseLegalTextToArticles(fullText: string): ScrapedArticle[] {
  // \r\n temizle — mevzuat.gov.tr HTM dosyaları \r\n içerir
  const cleanText = fullText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const articles: ScrapedArticle[] = [];
  const regex = /(?=(?:MADDE|Madde|EK\s+MADDE|Ek Madde|GEÇİCİ\s+MADDE|Geçici Madde)\s+\d+)/gi;
  const parts = cleanText.split(regex).filter((p) => p.trim());

  for (const part of parts) {
    const headerMatch = part.match(/^((?:MADDE|Madde|EK\s+MADDE|Ek Madde|GEÇİCİ\s+MADDE|Geçici Madde)\s+\d+(?:\/[A-Z])?)\s*[–\-:]/i);
    if (!headerMatch) continue;

    const articleNumber = headerMatch[1].replace(/\s+/g, " ").trim();
    const body = part.substring(headerMatch[0].length).trim();
    const firstLine = body.split("\n")[0]?.trim() || "";
    const articleTitle = firstLine.length > 5 && firstLine.length < 80 ? firstLine : null;

    if (body.length > 50) {
      articles.push({ articleNumber, articleTitle, content: body });
    }
  }
  return articles;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
