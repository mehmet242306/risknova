import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EDGE_FUNCTION_URL =
  "https://xbnvedbagfmkrvicvoam.supabase.co/functions/v1/sync-mevzuat";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Edge Function (timeout 60s) ─────────────────────────────────────────

async function callEdgeFunction(
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Local fallback: HTML scraping ───────────────────────────────────────

async function fetchHTM(url: string, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html: string): string {
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

// ─── mevzuat.gov.tr URL helpers ─────────────────────────────────────────

const MEVZUAT_TUR_MAP: Record<string, string> = {
  "1": "Kanun",
  "2": "KanunHukmundeKararname",
  "4": "CumhurbaskanligiKararnamesi",
  "7": "KurumVeKurulusYonetmeligi",
  "9": "Teblig",
  "11": "Tuzuk",
  "21": "BakanlarKuruluKarari",
};

function parseMevzuatParams(
  url: string
): { no: string; tur: string; tertip: string } | null {
  const match = url.match(
    /[?&]MevzuatNo=(\d+).*?[?&]MevzuatTur=(\d+).*?[?&]MevzuatTertip=(\d+)/
  );
  if (!match) return null;
  return { no: match[1], tur: match[2], tertip: match[3] };
}

/** Build candidate URLs for a regulation, ordered by reliability */
function buildRegulationUrls(params: {
  no: string;
  tur: string;
  tertip: string;
}): string[] {
  const turStr = MEVZUAT_TUR_MAP[params.tur];
  const urls: string[] = [];

  // 1. iframe with string MevzuatTur (works for some regs)
  if (turStr) {
    urls.push(
      `https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=${turStr}&MevzuatNo=${params.no}&MevzuatTertip=${params.tertip}`
    );
  }

  // 2. iframe with numeric MevzuatTur (works for others)
  urls.push(
    `https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=${params.tur}&MevzuatNo=${params.no}&MevzuatTertip=${params.tertip}`
  );

  // 3. Metin.Aspx (older but stable endpoint)
  urls.push(
    `https://www.mevzuat.gov.tr/Metin.Aspx?MevzuatIliski=0&MevzuatKod=${params.tur}.${params.tertip}.${params.no}`
  );

  return urls;
}

async function fetchAndDecodeHtml(
  url: string,
  expectUtf8: boolean
): Promise<string> {
  const res = await fetchHTM(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const rawBuf = await res.arrayBuffer();
  let html: string;

  if (expectUtf8) {
    html = new TextDecoder("utf-8").decode(rawBuf);
  } else {
    const ct = res.headers.get("content-type") || "";
    html = ct.includes("utf-8")
      ? new TextDecoder("utf-8").decode(rawBuf)
      : new TextDecoder("windows-1254").decode(rawBuf);
  }

  const text = htmlToText(html);
  if (text.length < 100) throw new Error("Text too short");
  return text;
}

async function extractTextFromURL(url: string): Promise<string> {
  // ── Law PDF → convert to .htm ──
  if (!url.includes("MevzuatNo=")) {
    return fetchAndDecodeHtml(url.replace(/\.pdf$/i, ".htm"), false);
  }

  // ── Regulation → try multiple URL patterns ──
  const params = parseMevzuatParams(url);
  if (!params) throw new Error("Cannot parse mevzuat URL parameters");

  const candidates = buildRegulationUrls(params);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await fetchAndDecodeHtml(candidate, true);
    } catch (err) {
      errors.push(`${candidate}: ${(err as Error).message}`);
    }
  }

  throw new Error(
    `All URL patterns failed for MevzuatNo=${params.no}: ${errors.join("; ")}`
  );
}

interface ChunkData {
  chunk_index: number;
  article_number: string | null;
  article_title: string | null;
  article_type: "normal" | "gecici" | "ek" | "mukerrer";
  content: string;
  content_tokens: number;
}

function chunkLegalText(rawText: string): ChunkData[] {
  const fullText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks: ChunkData[] = [];
  const re =
    /(?:(?:MADDE|Madde|EK\s+MADDE|Ek Madde|GEÇİCİ\s+MADDE|Geçici Madde)\s+\d+(?:\/[A-Z])?)\s*[–\-:]/gi;
  const parts = fullText.split(re);
  const matches = fullText.match(re) || [];

  if (parts[0] && parts[0].trim().length > 100) {
    chunks.push({
      chunk_index: 0,
      article_number: "Giris",
      article_title: null,
      article_type: "normal",
      content: parts[0].trim().slice(0, 3000),
      content_tokens: Math.ceil(parts[0].trim().length / 4),
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const body = (parts[i + 1] || "").trim();
    if (body.length < 50) continue;

    const h = matches[i].replace(/\s+/g, " ").trim();
    const numMatch = h.match(/(\d+(?:\/[A-Z])?)/);
    let prefix = "Madde";
    let aType: ChunkData["article_type"] = "normal";
    if (/EK\s+MADDE/i.test(h)) {
      prefix = "Ek Madde";
      aType = "ek";
    } else if (/GEÇİCİ\s+MADDE/i.test(h)) {
      prefix = "Gecici Madde";
      aType = "gecici";
    }
    if (numMatch?.[1]?.includes("/")) aType = "mukerrer";
    const artNum = `${prefix} ${numMatch?.[1] ?? i + 1}`;

    const firstLine = body.split("\n")[0]?.trim() || "";
    const artTitle =
      firstLine.length > 5 && firstLine.length < 100 ? firstLine : null;

    if (body.length > 4000) {
      const sentences = body.split(/(?<=[.!?])\s+/);
      let cur = "";
      let sub = 0;
      for (const s of sentences) {
        if ((cur + s).length > 3500 && cur) {
          chunks.push({
            chunk_index: chunks.length,
            article_number: `${artNum}${sub > 0 ? ` (${sub + 1})` : ""}`,
            article_title: artTitle,
            article_type: aType,
            content: cur.trim(),
            content_tokens: Math.ceil(cur.length / 4),
          });
          cur = s;
          sub++;
        } else {
          cur += (cur ? " " : "") + s;
        }
      }
      if (cur)
        chunks.push({
          chunk_index: chunks.length,
          article_number: `${artNum}${sub > 0 ? ` (${sub + 1})` : ""}`,
          article_title: artTitle,
          article_type: aType,
          content: cur.trim(),
          content_tokens: Math.ceil(cur.length / 4),
        });
    } else {
      chunks.push({
        chunk_index: chunks.length,
        article_number: artNum,
        article_title: artTitle,
        article_type: aType,
        content: body,
        content_tokens: Math.ceil(body.length / 4),
      });
    }
  }

  if (chunks.length === 0) {
    fullText
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 100)
      .forEach((p, i) => {
        chunks.push({
          chunk_index: i,
          article_number: `Bolum ${i + 1}`,
          article_title: null,
          article_type: "normal",
          content: p.trim().slice(0, 3500),
          content_tokens: Math.ceil(p.trim().length / 4),
        });
      });
  }

  return chunks;
}

function md5(text: string): string {
  const crypto = require("crypto");
  return crypto.createHash("md5").update(text).digest("hex");
}

// ─── Local sync (fallback) ───────────────────────────────────────────────

async function localSyncDocument(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  docId: string
) {
  const { data: doc } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("id", docId)
    .single();
  if (!doc?.source_url)
    return { success: false, chunksCreated: 0, error: "No source URL" };

  let fullText: string;
  try {
    fullText = await extractTextFromURL(doc.source_url);
  } catch (e) {
    return {
      success: false,
      chunksCreated: 0,
      error: (e as Error).message,
    };
  }

  const newHash = md5(fullText);
  if (doc.source_hash === newHash)
    return { success: true, chunksCreated: 0, error: "No changes" };

  await supabase
    .from("legal_documents")
    .update({
      full_text: fullText,
      source_hash: newHash,
      last_updated_at: new Date().toISOString(),
    })
    .eq("id", docId);
  await supabase.from("legal_chunks").delete().eq("document_id", docId);

  const chunks = chunkLegalText(fullText);
  let created = 0;

  for (const c of chunks) {
    const { error } = await supabase.from("legal_chunks").insert({
      document_id: docId,
      chunk_index: c.chunk_index,
      article_number: c.article_number,
      article_title: c.article_title,
      article_type: c.article_type,
      content: c.content,
      content_tokens: c.content_tokens,
    });
    if (!error) created++;
  }

  return { success: true, chunksCreated: created };
}

// ─── Sync single: Edge Function first, local fallback ────────────────────

async function syncSingle(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  documentId: string
) {
  // Try Edge Function
  const edgeResult = await callEdgeFunction({
    action: "sync_single",
    document_id: documentId,
  });

  if (edgeResult && !edgeResult.error) {
    return {
      success: true,
      chunksCreated:
        (edgeResult.articles_added as number) ||
        (edgeResult.chunksCreated as number) ||
        0,
      source: "edge",
    };
  }

  // Fallback to local
  const localResult = await localSyncDocument(supabase, documentId);
  return { ...localResult, source: "local" };
}

// ─── POST handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, documentId } = body;

    const supabase = getSupabaseAdmin();

    // ── single ──
    if (mode === "single" && documentId) {
      const result = await syncSingle(supabase, documentId);
      return NextResponse.json(result);
    }

    // ── all ──
    if (mode === "all") {
      const { data: docs, error } = await supabase
        .from("legal_documents")
        .select("id, title, source_url")
        .not("source_url", "is", null)
        .eq("is_active", true);

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      let totalChunks = 0;
      let processed = 0;
      const errors: string[] = [];

      for (const doc of docs || []) {
        try {
          const r = await syncSingle(supabase, doc.id);
          if (r.success) {
            processed++;
            totalChunks += r.chunksCreated;
          } else if ("error" in r && r.error) {
            errors.push(`${doc.title}: ${r.error}`);
          }
        } catch (err) {
          errors.push(
            `${doc.title}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        // Rate limit
        await new Promise((r) => setTimeout(r, 500));
      }

      return NextResponse.json({
        success: true,
        processed,
        totalChunks,
        totalDocuments: docs?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ── unknown ──
    return NextResponse.json(
      { error: "Gecersiz mode", validModes: ["single", "all"], received: mode },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}

// ─── GET handler — status ────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [docs, chunks] = await Promise.all([
      supabase
        .from("legal_documents")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("legal_chunks")
        .select("id", { count: "exact", head: true }),
    ]);
    const { count: withEmb } = await supabase
      .from("legal_chunks")
      .select("id", { count: "exact", head: true })
      .not("embedding", "is", null);

    return NextResponse.json({
      status: "ok",
      stats: {
        totalDocuments: docs.count || 0,
        totalChunks: chunks.count || 0,
        chunksWithEmbeddings: withEmb || 0,
        chunksWithoutEmbeddings: (chunks.count || 0) - (withEmb || 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
