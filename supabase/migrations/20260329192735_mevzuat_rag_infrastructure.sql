
-- ============================================================
-- 1. Enable pgvector for semantic search
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. Mevzuat document types (kanun, yönetmelik, tebliğ, vb.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_document_types (
  id          text    PRIMARY KEY,
  label       text    NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO public.mevzuat_document_types (id, label, sort_order) VALUES
  ('kanun',       'Kanun',        10),
  ('yonetmelik',  'Yönetmelik',   20),
  ('teblig',      'Tebliğ',       30),
  ('genelge',     'Genelge',      40),
  ('standart',    'Standart',     50),
  ('rehber',      'Rehber',       60),
  ('diger',       'Diğer',        70)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Main legislation documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_documents (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type        text    NOT NULL REFERENCES public.mevzuat_document_types(id),
  official_no     text,                 -- "6331", "28512" (resmi gazete no)
  title           text    NOT NULL,     -- "İş Sağlığı ve Güvenliği Kanunu"
  short_title     text,                 -- "6331 Kanun"
  publish_date    date,
  gazette_no      text,                 -- Resmi Gazete sayısı
  gazette_date    date,
  status          text    NOT NULL DEFAULT 'active' CHECK (status IN ('active','amended','repealed')),
  summary         text,
  tags            text[],               -- ['isg','genel','işveren','çalışan']
  source_url      text,                 -- Mevzuat.gov.tr linki
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_mevzuat_docs_type ON public.mevzuat_documents(doc_type);
CREATE INDEX idx_mevzuat_docs_tags ON public.mevzuat_documents USING GIN(tags);
CREATE INDEX idx_mevzuat_docs_status ON public.mevzuat_documents(status);

-- ============================================================
-- 4. Sections/Articles — individual madde/fıkra
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_sections (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid    NOT NULL REFERENCES public.mevzuat_documents(id) ON DELETE CASCADE,
  section_type    text    NOT NULL DEFAULT 'madde' CHECK (section_type IN ('bolum','kisim','madde','fikra','bent','gecici_madde','ek_madde')),
  section_no      text,                 -- "8", "Geçici Madde 2", "Ek Madde 1"
  parent_id       uuid    REFERENCES public.mevzuat_sections(id) ON DELETE CASCADE,
  title           text,                 -- Madde başlığı: "İşverenin genel yükümlülüğü"
  content         text    NOT NULL,     -- Tam metin
  summary         text,                 -- Kısa özet
  keywords        text[],               -- Arama için anahtar kelimeler
  is_amended      boolean DEFAULT false,
  amendment_note  text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_mevzuat_sections_doc ON public.mevzuat_sections(document_id);
CREATE INDEX idx_mevzuat_sections_parent ON public.mevzuat_sections(parent_id);
CREATE INDEX idx_mevzuat_sections_keywords ON public.mevzuat_sections USING GIN(keywords);
CREATE INDEX idx_mevzuat_sections_type ON public.mevzuat_sections(section_type);

-- Full-text search index (Turkish)
ALTER TABLE public.mevzuat_sections ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'C')
  ) STORED;

CREATE INDEX idx_mevzuat_sections_fts ON public.mevzuat_sections USING GIN(search_vector);

-- ============================================================
-- 5. Vector embeddings for semantic search
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_embeddings (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      uuid    NOT NULL REFERENCES public.mevzuat_sections(id) ON DELETE CASCADE,
  chunk_index     integer NOT NULL DEFAULT 0,  -- büyük metinler parçalanır
  chunk_text      text    NOT NULL,
  embedding       vector(1536),                -- OpenAI text-embedding-3-small boyutu
  created_at      timestamptz DEFAULT now(),
  UNIQUE(section_id, chunk_index)
);

CREATE INDEX idx_mevzuat_emb_section ON public.mevzuat_embeddings(section_id);

-- ============================================================
-- 6. Cross-references between sections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_references (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_section_id uuid    NOT NULL REFERENCES public.mevzuat_sections(id) ON DELETE CASCADE,
  to_section_id   uuid    NOT NULL REFERENCES public.mevzuat_sections(id) ON DELETE CASCADE,
  ref_type        text    NOT NULL DEFAULT 'reference' CHECK (ref_type IN ('reference','amendment','repeal','supplement')),
  note            text,
  UNIQUE(from_section_id, to_section_id)
);

-- ============================================================
-- 7. Topic categories for organized browsing
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mevzuat_topics (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text    NOT NULL,
  description text,
  icon        text,
  parent_id   uuid    REFERENCES public.mevzuat_topics(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mevzuat_section_topics (
  section_id  uuid    NOT NULL REFERENCES public.mevzuat_sections(id) ON DELETE CASCADE,
  topic_id    uuid    NOT NULL REFERENCES public.mevzuat_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, topic_id)
);

-- ============================================================
-- 8. RLS — mevzuat is read-only for all authenticated users
-- ============================================================
ALTER TABLE public.mevzuat_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mevzuat_section_topics ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "mevzuat_types_read" ON public.mevzuat_document_types FOR SELECT USING (true);
CREATE POLICY "mevzuat_docs_read" ON public.mevzuat_documents FOR SELECT USING (true);
CREATE POLICY "mevzuat_sections_read" ON public.mevzuat_sections FOR SELECT USING (true);
CREATE POLICY "mevzuat_embeddings_read" ON public.mevzuat_embeddings FOR SELECT USING (true);
CREATE POLICY "mevzuat_references_read" ON public.mevzuat_references FOR SELECT USING (true);
CREATE POLICY "mevzuat_topics_read" ON public.mevzuat_topics FOR SELECT USING (true);
CREATE POLICY "mevzuat_section_topics_read" ON public.mevzuat_section_topics FOR SELECT USING (true);

-- ============================================================
-- 9. Semantic search function
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_mevzuat_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  section_id uuid,
  chunk_text text,
  similarity float,
  section_title text,
  section_no text,
  section_content text,
  document_title text,
  document_short_title text,
  doc_type text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.section_id,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) AS similarity,
    s.title AS section_title,
    s.section_no,
    s.content AS section_content,
    d.title AS document_title,
    d.short_title AS document_short_title,
    d.doc_type
  FROM public.mevzuat_embeddings e
  JOIN public.mevzuat_sections s ON s.id = e.section_id
  JOIN public.mevzuat_documents d ON d.id = s.document_id
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND d.status = 'active'
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- 10. Full-text search function
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_mevzuat_text(
  search_query text,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  section_id uuid,
  section_title text,
  section_no text,
  section_content text,
  document_title text,
  document_short_title text,
  doc_type text,
  rank float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id AS section_id,
    s.title AS section_title,
    s.section_no,
    s.content AS section_content,
    d.title AS document_title,
    d.short_title AS document_short_title,
    d.doc_type,
    ts_rank(s.search_vector, plainto_tsquery('simple', search_query)) AS rank
  FROM public.mevzuat_sections s
  JOIN public.mevzuat_documents d ON d.id = s.document_id
  WHERE s.search_vector @@ plainto_tsquery('simple', search_query)
    AND d.status = 'active'
  ORDER BY rank DESC
  LIMIT result_limit;
$$;
;
