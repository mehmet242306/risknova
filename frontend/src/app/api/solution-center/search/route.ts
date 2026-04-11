import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const { query, limit = 10 } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Arama sorgusu en az 2 karakter olmalidir." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Full-text search on legal_chunks using search_vector column
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .join(" & ");

    const { data: chunks, error } = await supabase
      .from("legal_chunks")
      .select(
        `
        id,
        document_id,
        article_number,
        article_title,
        article_type,
        content,
        content_tokens,
        legal_documents!inner(id, title, doc_type, doc_number, is_active)
      `,
      )
      .textSearch("search_vector", tsQuery)
      .eq("is_repealed", false)
      .limit(limit);

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (chunks ?? []).map((chunk) => {
      const doc = Array.isArray(chunk.legal_documents)
        ? chunk.legal_documents[0]
        : chunk.legal_documents;
      return {
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        doc_title: doc?.title ?? "",
        doc_type: doc?.doc_type ?? "",
        doc_number: doc?.doc_number ?? null,
        article_number: chunk.article_number,
        article_title: chunk.article_title,
        content: chunk.content,
      };
    });

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}
