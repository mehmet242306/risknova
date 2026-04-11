import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/supabase/api-auth";

export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service role yapılandırması eksik.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractText(buffer: ArrayBuffer, mimeType: string) {
  const decoder = new TextDecoder("utf-8", { fatal: false });

  if (mimeType === "text/plain") {
    return decoder.decode(buffer).trim();
  }

  const raw = decoder.decode(new Uint8Array(buffer));
  const textParts = raw.match(/>([^<]+)</g);
  if (textParts && textParts.length > 10) {
    return textParts
      .map((part) => part.slice(1, -1).trim())
      .filter((part) => part.length > 1)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const docType = String(formData.get("docType") || "").trim();
    const docNumber = String(formData.get("docNumber") || "").trim();
    const file = formData.get("file") as File | null;

    if (!title) {
      return NextResponse.json({ error: "Baslik gerekli." }, { status: 400 });
    }

    if (!["law", "regulation", "communique", "guide", "announcement", "circular"].includes(docType)) {
      return NextResponse.json({ error: "Gecersiz belge tipi." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Desteklenmeyen dosya tipi: ${file.type}` }, { status: 400 });
    }

    const supabase = createServiceClient();
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
    const storagePath = `legal-library/${auth.organizationId}/${auth.userId}/${Date.now()}_${safeName}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from("slide-media").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: `Dosya yuklenemedi: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("slide-media").getPublicUrl(storagePath);
    const sourceUrl = publicUrlData.publicUrl;
    const fullText = extractText(buffer, file.type).slice(0, 40000) || null;

    const { data: asset } = await supabase
      .from("slide_media_assets")
      .insert({
        organization_id: auth.organizationId,
        uploaded_by: auth.userId,
        asset_type: "document",
        file_name: file.name,
        storage_path: storagePath,
        public_url: sourceUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
        category: "legal-library",
      })
      .select("id")
      .maybeSingle();

    const { data: legalDoc, error: legalInsertError } = await supabase
      .from("legal_documents")
      .insert({
        doc_type: docType,
        doc_number: docNumber || null,
        title,
        source_url: sourceUrl,
        full_text: fullText,
        source_hash: `${auth.organizationId}:${auth.userId}:${storagePath}`,
        last_updated_at: new Date().toISOString(),
      })
      .select("id, title, doc_type, source_url")
      .single();

    if (legalInsertError) {
      return NextResponse.json({ error: `Kayit olusturulamadi: ${legalInsertError.message}` }, { status: 500 });
    }

    if (fullText && fullText.length > 80) {
      await supabase.from("legal_chunks").insert({
        document_id: legalDoc.id,
        chunk_index: 0,
        article_title: title,
        content: fullText.slice(0, 12000),
        metadata: {
          source: "manual_upload",
          uploaded_by: auth.userId,
          organization_id: auth.organizationId,
          asset_id: asset?.id || null,
        },
      });
    }

    return NextResponse.json({
      id: legalDoc.id,
      title: legalDoc.title,
      docType: legalDoc.doc_type,
      sourceUrl: legalDoc.source_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
