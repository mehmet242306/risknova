import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

const BATCH_SIZE = 100;
const OPENAI_MODEL = "text-embedding-ada-002";

async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return texts.map(() => null);

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI API error:", res.status, err);
      return texts.map(() => null);
    }

    const data = await res.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  } catch (error) {
    console.error("Embedding batch error:", error);
    return texts.map(() => null);
  }
}

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not configured" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Count total missing
    const { count: totalMissing } = await supabase
      .from("legal_chunks")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    if (!totalMissing || totalMissing === 0) {
      return NextResponse.json({ success: true, updated: 0, remaining: 0 });
    }

    // Fetch a batch of chunks without embeddings
    const { data: chunks, error } = await supabase
      .from("legal_chunks")
      .select("id, content")
      .is("embedding", null)
      .order("chunk_index")
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ success: true, updated: 0, remaining: 0 });
    }

    // Generate embeddings in batch
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    // Update each chunk
    let updated = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (embeddings[i]) {
        const { error: updateErr } = await supabase
          .from("legal_chunks")
          .update({ embedding: embeddings[i] })
          .eq("id", chunks[i].id);
        if (!updateErr) updated++;
      }
    }

    const remaining = (totalMissing || 0) - updated;

    return NextResponse.json({
      success: true,
      updated,
      batchSize: chunks.length,
      remaining,
      totalMissing,
    });
  } catch (error) {
    console.error("Embeddings API error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [total, withEmb] = await Promise.all([
      supabase.from("legal_chunks").select("id", { count: "exact", head: true }),
      supabase.from("legal_chunks").select("id", { count: "exact", head: true }).not("embedding", "is", null),
    ]);

    return NextResponse.json({
      total: total.count || 0,
      withEmbeddings: withEmb.count || 0,
      missing: (total.count || 0) - (withEmb.count || 0),
      hasApiKey: !!process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
