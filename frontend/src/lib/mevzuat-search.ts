import { createClient } from "@/lib/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────

export type MevzuatResult = {
  chunk_id: string;
  document_id: string;
  doc_title: string;
  doc_type: string;
  doc_number: string | null;
  article_number: string | null;
  article_title: string | null;
  content: string;
  rank?: number;
  similarity?: number;
};

export type LegalDocument = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  title: string;
  is_active: boolean;
  official_gazette_date: string | null;
};

// ─── Hybrid search: full-text + keyword fallback ───────────────────────────

export async function searchMevzuat(query: string, limit = 10): Promise<MevzuatResult[]> {
  const supabase = createClient();
  if (!supabase || !query.trim()) return [];

  // 1. Try full-text search via DB function
  try {
    const { data, error } = await supabase.rpc("search_legal_text", {
      search_query: query,
      result_limit: limit,
    });
    if (!error && data && data.length > 0) {
      return data as MevzuatResult[];
    }
  } catch { /* function may not exist yet, fallback */ }

  // 2. Fallback: ILIKE keyword search
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  // Search chunks by content/title matching
  const { data: chunks } = await supabase
    .from("legal_chunks")
    .select(`
      id, document_id, article_number, article_title, content,
      legal_documents!inner(title, doc_type, doc_number, is_active)
    `)
    .or(keywords.map((k) => `content.ilike.%${k}%`).join(","))
    .limit(limit);

  if (!chunks) return [];

  return chunks.map((row) => {
    const doc = Array.isArray(row.legal_documents) ? row.legal_documents[0] : row.legal_documents;
    return {
      chunk_id: row.id,
      document_id: row.document_id,
      doc_title: doc?.title ?? "",
      doc_type: doc?.doc_type ?? "",
      doc_number: doc?.doc_number ?? null,
      article_number: row.article_number,
      article_title: row.article_title,
      content: row.content,
    };
  });
}

// ─── Also search old mevzuat_sections if they exist ────────────────────────

export async function searchMevzuatLegacy(query: string, limit = 5): Promise<MevzuatResult[]> {
  const supabase = createClient();
  if (!supabase || !query.trim()) return [];

  try {
    const { data, error } = await supabase.rpc("search_mevzuat_text", {
      search_query: query,
      result_limit: limit,
    });
    if (!error && data && data.length > 0) {
      return data.map((r: Record<string, unknown>) => ({
        chunk_id: r.section_id as string,
        document_id: "",
        doc_title: r.document_title as string,
        doc_type: r.doc_type as string,
        doc_number: null,
        article_number: r.section_no as string | null,
        article_title: r.section_title as string | null,
        content: r.section_content as string,
        rank: r.rank as number,
      }));
    }
  } catch { /* table may not exist */ }

  return [];
}

// ─── Combined search: new + legacy tables ──────────────────────────────────

export async function searchAllMevzuat(query: string, limit = 10): Promise<MevzuatResult[]> {
  const [newResults, legacyResults] = await Promise.all([
    searchMevzuat(query, limit),
    searchMevzuatLegacy(query, Math.floor(limit / 2)),
  ]);

  // Deduplicate by content similarity
  const combined = [...newResults];
  for (const legacy of legacyResults) {
    const isDuplicate = combined.some((r) =>
      r.article_number === legacy.article_number && r.doc_title === legacy.doc_title
    );
    if (!isDuplicate) combined.push(legacy);
  }

  return combined.slice(0, limit);
}

// ─── Extract ISG keywords from user text ───────────────────────────────────

export function extractISGKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    "risk": ["risk", "tehlike", "değerlendirme"],
    "kaza": ["kaza", "ramak kala", "bildirim"],
    "eğitim": ["eğitim", "çalışan", "mesleki"],
    "kkd": ["kkd", "koruyucu", "donanım"],
    "acil": ["acil durum", "tahliye", "yangın"],
    "yüksek": ["yüksekte çalışma", "iskele", "düşme"],
    "kimyasal": ["kimyasal", "madde", "maruziyet"],
    "makine": ["iş ekipmanı", "makine", "periyodik kontrol"],
    "hekim": ["işyeri hekimi", "sağlık gözetimi", "muayene"],
    "uzman": ["iş güvenliği uzmanı", "görevlendirme", "uzman"],
    "ceza": ["idari para cezası", "yaptırım", "ceza"],
    "işveren": ["işveren", "yükümlülük", "sorumluluk"],
    "çalışan": ["çalışan", "yükümlülük", "hak"],
    "inşaat": ["yapı", "inşaat", "iskele", "kazı"],
    "yangın": ["yangın", "söndürme", "acil durum"],
    "gürültü": ["gürültü", "maruziyet", "ölçüm"],
    "ergonomi": ["ergonomi", "çalışma ortamı", "elle taşıma"],
    "mevzuat": ["6331", "kanun", "yönetmelik"],
    "sağlık": ["sağlık", "muayene", "gözetim"],
    "denetim": ["denetim", "teftiş", "kontrol"],
    "isg": ["isg", "iş sağlığı", "iş güvenliği"],
    "kurul": ["kurul", "isg kurulu", "temsilci"],
    "belge": ["belge", "sertifika", "ehliyet"],
    "meslek": ["meslek hastalığı", "maruziyet"],
    "tahliye": ["tahliye", "kaçış", "toplanma"],
    "ilk yardım": ["ilk yardım", "acil müdahale"],
    "elektrik": ["elektrik", "topraklama", "kaçak"],
  };

  const found: string[] = [];
  for (const [trigger, kws] of Object.entries(keywordMap)) {
    if (lower.includes(trigger)) found.push(...kws);
  }
  return [...new Set(found)];
}

// ─── Format reference for display ──────────────────────────────────────────

export function formatMevzuatRef(result: MevzuatResult): string {
  const docName = result.doc_title;
  const article = result.article_number ?? "";
  const title = result.article_title ? ` — ${result.article_title}` : "";
  return `${docName}${article ? `, ${article}` : ""}${title}`;
}

// ─── List all legal documents ──────────────────────────────────────────────

export async function listLegalDocuments(): Promise<LegalDocument[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("legal_documents")
    .select("id, doc_type, doc_number, title, is_active, official_gazette_date")
    .eq("is_active", true)
    .order("doc_type")
    .order("title");
  return (data ?? []) as LegalDocument[];
}
