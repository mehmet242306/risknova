ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE OR REPLACE FUNCTION get_legal_docs_with_counts()
RETURNS TABLE(
  id uuid,
  title text,
  doc_type text,
  doc_number text,
  source_url text,
  last_synced_at timestamptz,
  chunk_count bigint
) LANGUAGE sql STABLE AS $$
  SELECT 
    ld.id, ld.title, ld.doc_type, ld.doc_number, ld.source_url, ld.last_synced_at,
    COALESCE(cc.cnt, 0) as chunk_count
  FROM legal_documents ld
  LEFT JOIN (SELECT document_id, count(*) as cnt FROM legal_chunks GROUP BY document_id) cc 
    ON cc.document_id = ld.id
  ORDER BY ld.title;
$$;;
