import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const body = await req.json();
    const { document_id, all } = body;

    // Get documents to process
    let q = supabase.from("legal_documents").select("id, title, source_url, doc_type").eq("is_active", true).is("full_text", null);
    if (document_id && !all) q = q.eq("id", document_id);
    const { data: docs } = await q;
    if (!docs?.length) return jsonResp({ message: "No documents" });

    const results: any[] = [];

    for (const doc of docs) {
      try {
        if (!doc.source_url) { results.push({ id: doc.id, title: doc.title, status: "skip" }); continue; }

        // Convert URL to iframe endpoint
        const url = new URL(doc.source_url);
        const mevNo = url.searchParams.get("MevzuatNo");
        const mevTur = url.searchParams.get("MevzuatTur");
        const mevTer = url.searchParams.get("MevzuatTertip");
        const iframeUrl = `https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatNo=${mevNo}&MevzuatTur=${mevTur}&MevzuatTertip=${mevTer}`;

        const resp = await fetch(iframeUrl, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "tr-TR" } });
        if (!resp.ok) { results.push({ id: doc.id, title: doc.title, status: "error", reason: `HTTP ${resp.status}` }); continue; }

        let html = await resp.text();

        // Strip style, script, head tags and their content
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
        html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
        html = html.replace(/<!--[\s\S]*?-->/g, "");
        
        // Replace common HTML entities
        html = html.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ouml;/g, "\u00f6").replace(/&uuml;/g, "\u00fc").replace(/&ccedil;/g, "\u00e7").replace(/&Ouml;/g, "\u00d6").replace(/&Uuml;/g, "\u00dc").replace(/&Ccedil;/g, "\u00c7");
        html = html.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        html = html.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
        
        // Replace block elements with newlines
        html = html.replace(/<\/?(?:p|div|br|tr|li|h[1-6]|section|article)[^>]*>/gi, "\n");
        html = html.replace(/<td[^>]*>/gi, "\t");
        
        // Strip remaining HTML tags
        html = html.replace(/<[^>]+>/g, "");
        
        // Clean whitespace
        let fullText = html.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/^\s+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

        // Remove font-face definitions and CSS remnants
        fullText = fullText.replace(/@font-face[\s\S]*?\}/g, "").replace(/\{[^}]*\}/g, "").replace(/@media[^{]*\{/g, "").trim();
        fullText = fullText.replace(/\n{3,}/g, "\n\n").trim();

        if (fullText.length < 500) {
          results.push({ id: doc.id, title: doc.title, status: "error", reason: "Text too short", len: fullText.length });
          continue;
        }

        // Update full_text
        await supabase.from("legal_documents").update({ full_text: fullText }).eq("id", doc.id);

        // Chunk by MADDE
        const chunks = chunkByArticle(fullText, doc.id);

        if (chunks.length > 0) {
          await supabase.from("legal_chunks").delete().eq("document_id", doc.id);
          for (let i = 0; i < chunks.length; i += 50) {
            await supabase.from("legal_chunks").insert(chunks.slice(i, i + 50));
          }
        }

        results.push({ id: doc.id, title: doc.title, status: "ok", textLen: fullText.length, chunks: chunks.length });
      } catch (e) {
        results.push({ id: doc.id, title: doc.title, status: "error", reason: e.message });
      }
    }

    return jsonResp({ processed: results.length, results });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
});

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function chunkByArticle(text: string, docId: string) {
  const chunks: any[] = [];
  const pattern = /(?:^|\n)\s*((?:MADDE|Madde)\s+\d+[/A-Za-z]*)/gm;
  const matches: { idx: number; num: string }[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) matches.push({ idx: m.index, num: m[1].trim() });

  if (matches.length === 0) {
    // No MADDE found - split by paragraphs
    const paras = text.split(/\n\n+/);
    let buf = "", ci = 0;
    for (const p of paras) {
      if (buf.length + p.length > 2000 && buf.length > 200) {
        chunks.push({ document_id: docId, chunk_index: ci, article_number: `Bolum ${ci+1}`, article_title: "", content: buf.trim(), content_tokens: Math.ceil(buf.length/4), metadata: {}, keywords: [] });
        ci++; buf = "";
      }
      buf += p + "\n\n";
    }
    if (buf.trim().length > 50) chunks.push({ document_id: docId, chunk_index: ci, article_number: `Bolum ${ci+1}`, article_title: "", content: buf.trim(), content_tokens: Math.ceil(buf.length/4), metadata: {}, keywords: [] });
    return chunks;
  }

  // Preamble
  if (matches[0].idx > 100) {
    const pre = text.substring(0, matches[0].idx).trim();
    if (pre.length > 50) chunks.push({ document_id: docId, chunk_index: 0, article_number: "Giris", article_title: "Genel Hukumler", content: pre.substring(0, 3000), content_tokens: Math.ceil(Math.min(pre.length, 3000)/4), metadata: {}, keywords: [] });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i+1 < matches.length ? matches[i+1].idx : text.length;
    let content = text.substring(start, end).trim();
    const titleMatch = content.split("\n")[0]?.match(/(?:MADDE|Madde)\s+\d+[/A-Za-z]*[\s\-\u2013:]+(.*)/);
    const title = titleMatch ? titleMatch[1].trim().substring(0, 200) : "";

    if (content.length > 3000) {
      const parts = splitContent(content, 2500);
      parts.forEach((p, j) => {
        chunks.push({ document_id: docId, chunk_index: chunks.length, article_number: matches[i].num + (j > 0 ? ` (${j+1})` : ""), article_title: j === 0 ? title : title + " (devam)", content: p.trim(), content_tokens: Math.ceil(p.length/4), metadata: {}, keywords: [] });
      });
    } else {
      chunks.push({ document_id: docId, chunk_index: chunks.length, article_number: matches[i].num, article_title: title, content, content_tokens: Math.ceil(content.length/4), metadata: {}, keywords: [] });
    }
  }
  return chunks;
}

function splitContent(text: string, max: number): string[] {
  const parts: string[] = []; const paras = text.split(/\n\n+/); let cur = "";
  for (const p of paras) {
    if (cur.length + p.length > max && cur.length > 200) { parts.push(cur); cur = ""; }
    cur += p + "\n\n";
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}
