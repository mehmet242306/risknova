
-- Önce mevcut fonksiyonları kaldır
DROP FUNCTION IF EXISTS search_legal_chunks(vector, float, int);
DROP FUNCTION IF EXISTS find_similar_query(vector, float);
DROP FUNCTION IF EXISTS search_legal_fulltext(text, int);

-- =============================================
-- VECTOR INDEX (ivfflat for similarity search)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
  ON public.legal_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_solution_queries_embedding 
  ON public.solution_queries 
  USING ivfflat (query_embedding vector_cosine_ops) 
  WITH (lists = 50);

-- =============================================
-- BENZER MEVZUAT MADDESİ ARAMA FONKSİYONU
-- =============================================
CREATE OR REPLACE FUNCTION search_legal_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  doc_title text,
  doc_type text,
  doc_number text,
  article_number text,
  article_title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lc.id,
    lc.document_id,
    ld.title as doc_title,
    ld.doc_type,
    ld.doc_number,
    lc.article_number,
    lc.article_title,
    lc.content,
    1 - (lc.embedding <=> query_embedding) as similarity
  FROM public.legal_chunks lc
  JOIN public.legal_documents ld ON ld.id = lc.document_id
  WHERE ld.is_active = true
    AND lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- =============================================
-- BENZER SORU CACHE KONTROLÜ
-- =============================================
CREATE OR REPLACE FUNCTION find_similar_query(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  id uuid,
  query_text text,
  ai_response text,
  sources_used jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sq.id,
    sq.query_text,
    sq.ai_response,
    sq.sources_used,
    1 - (sq.query_embedding <=> query_embedding) as similarity
  FROM public.solution_queries sq
  WHERE sq.is_cached = true
    AND sq.ai_response IS NOT NULL
    AND sq.query_embedding IS NOT NULL
    AND 1 - (sq.query_embedding <=> query_embedding) > similarity_threshold
  ORDER BY sq.query_embedding <=> query_embedding
  LIMIT 1;
$$;

-- =============================================
-- TAM METİN ARAMA FONKSİYONU
-- =============================================
CREATE OR REPLACE FUNCTION search_legal_fulltext(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  doc_title text,
  doc_type text,
  doc_number text,
  article_number text,
  content text,
  rank float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lc.id,
    ld.title as doc_title,
    ld.doc_type,
    ld.doc_number,
    lc.article_number,
    lc.content,
    ts_rank(to_tsvector('turkish', lc.content), plainto_tsquery('turkish', search_query)) as rank
  FROM public.legal_chunks lc
  JOIN public.legal_documents ld ON ld.id = lc.document_id
  WHERE ld.is_active = true
    AND to_tsvector('turkish', lc.content) @@ plainto_tsquery('turkish', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
$$;
;
