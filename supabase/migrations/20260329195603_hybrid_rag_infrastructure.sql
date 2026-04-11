
-- ============================================================
-- 1. Legal Sources — where we pull data from
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legal_sources (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key           text        UNIQUE NOT NULL,
  source_name          text        NOT NULL,
  base_url             text        NOT NULL,
  scrape_enabled       boolean     DEFAULT true,
  last_scraped_at      timestamptz,
  scrape_interval_hours integer    DEFAULT 24,
  created_at           timestamptz DEFAULT now()
);

INSERT INTO public.legal_sources (source_key, source_name, base_url) VALUES
  ('mevzuat_gov_tr', 'Mevzuat Bilgi Sistemi', 'https://www.mevzuat.gov.tr'),
  ('csgb',           'Çalışma ve Sosyal Güvenlik Bakanlığı', 'https://www.csgb.gov.tr'),
  ('isggm',          'İSG Genel Müdürlüğü', 'https://www.isggm.gov.tr'),
  ('casgem',         'ÇASGEM', 'https://www.casgem.gov.tr'),
  ('resmi_gazete',   'Resmi Gazete', 'https://www.resmigazete.gov.tr')
ON CONFLICT (source_key) DO NOTHING;

-- ============================================================
-- 2. Legal Documents — full legislation records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id              uuid        REFERENCES public.legal_sources(id),
  doc_type               text        NOT NULL CHECK (doc_type IN ('law','regulation','communique','guide','announcement','circular')),
  doc_number             text,
  title                  text        NOT NULL,
  official_gazette_date  date,
  official_gazette_number text,
  effective_date         date,
  full_text              text,
  full_text_html         text,
  source_url             text,
  source_hash            text,
  is_active              boolean     DEFAULT true,
  last_updated_at        timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON public.legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_number ON public.legal_documents(doc_number);
CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON public.legal_documents(is_active);

DROP TRIGGER IF EXISTS set_legal_documents_updated_at ON public.legal_documents;
CREATE TRIGGER set_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ============================================================
-- 3. Legal Chunks — article-level pieces with embeddings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legal_chunks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid        NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  chunk_index     integer     NOT NULL,
  article_number  text,
  article_title   text,
  content         text        NOT NULL,
  content_tokens  integer,
  embedding       vector(1536),
  metadata        jsonb       DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_document ON public.legal_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_article ON public.legal_chunks(article_number);

-- Full-text search on chunks
ALTER TABLE public.legal_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(article_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_legal_chunks_fts ON public.legal_chunks USING GIN(search_vector);

-- ============================================================
-- 4. ISG Announcements — news, updates, events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.isg_announcements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         uuid        REFERENCES public.legal_sources(id),
  title             text        NOT NULL,
  summary           text,
  content           text,
  announcement_date date,
  source_url        text,
  source_hash       text,
  category          text,
  is_active         boolean     DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- 5. Sync Logs — track scraping history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         uuid        REFERENCES public.legal_sources(id),
  sync_type         text        CHECK (sync_type IN ('full','incremental','daily')),
  status            text        CHECK (status IN ('started','completed','failed')),
  documents_added   integer     DEFAULT 0,
  documents_updated integer     DEFAULT 0,
  chunks_created    integer     DEFAULT 0,
  error_message     text,
  started_at        timestamptz DEFAULT now(),
  completed_at      timestamptz
);

-- ============================================================
-- 6. Update solution_queries to support vector cache
-- ============================================================
ALTER TABLE public.solution_queries
  ADD COLUMN IF NOT EXISTS query_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS sources_used jsonb,
  ADD COLUMN IF NOT EXISTS web_sources_used jsonb,
  ADD COLUMN IF NOT EXISTS response_tokens integer,
  ADD COLUMN IF NOT EXISTS is_cached boolean DEFAULT false;

-- ============================================================
-- 7. Vector search function for legal chunks
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_legal_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  doc_title text,
  doc_type text,
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
    ld.title AS doc_title,
    ld.doc_type,
    lc.article_number,
    lc.article_title,
    lc.content,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM public.legal_chunks lc
  JOIN public.legal_documents ld ON ld.id = lc.document_id
  WHERE ld.is_active = true
    AND lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- 8. Full-text search function for legal chunks
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_legal_text(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  doc_title text,
  doc_type text,
  doc_number text,
  article_number text,
  article_title text,
  content text,
  rank float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lc.id AS chunk_id,
    lc.document_id,
    ld.title AS doc_title,
    ld.doc_type,
    ld.doc_number,
    lc.article_number,
    lc.article_title,
    lc.content,
    ts_rank(lc.search_vector, plainto_tsquery('simple', search_query)) AS rank
  FROM public.legal_chunks lc
  JOIN public.legal_documents ld ON ld.id = lc.document_id
  WHERE lc.search_vector @@ plainto_tsquery('simple', search_query)
    AND ld.is_active = true
  ORDER BY rank DESC
  LIMIT result_limit;
$$;

-- ============================================================
-- 9. Similar query cache lookup
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_similar_query(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  id uuid,
  query_text text,
  ai_response text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sq.id,
    sq.query_text,
    sq.ai_response,
    1 - (sq.query_embedding <=> query_embedding) AS similarity
  FROM public.solution_queries sq
  WHERE sq.is_cached = true
    AND sq.ai_response IS NOT NULL
    AND sq.query_embedding IS NOT NULL
    AND 1 - (sq.query_embedding <=> query_embedding) > similarity_threshold
  ORDER BY sq.query_embedding <=> query_embedding
  LIMIT 1;
$$;

-- ============================================================
-- 10. RLS
-- ============================================================
ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isg_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read legal data
CREATE POLICY "legal_sources_read" ON public.legal_sources FOR SELECT USING (true);
CREATE POLICY "legal_documents_read" ON public.legal_documents FOR SELECT USING (true);
CREATE POLICY "legal_chunks_read" ON public.legal_chunks FOR SELECT USING (true);
CREATE POLICY "announcements_read" ON public.isg_announcements FOR SELECT USING (true);
CREATE POLICY "sync_logs_read" ON public.sync_logs FOR SELECT USING (true);
;
