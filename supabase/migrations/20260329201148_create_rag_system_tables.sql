
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- 1. MEVZUAT KAYNAKLARI
-- =============================================
CREATE TABLE IF NOT EXISTS public.legal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE NOT NULL,
  source_name text NOT NULL,
  base_url text NOT NULL,
  scrape_enabled boolean DEFAULT true,
  last_scraped_at timestamptz,
  scrape_interval_hours integer DEFAULT 24,
  created_at timestamptz DEFAULT now()
);

-- Varsayılan kaynaklar ekle
INSERT INTO public.legal_sources (source_key, source_name, base_url) VALUES
('mevzuat_gov_tr', 'Mevzuat Bilgi Sistemi', 'https://www.mevzuat.gov.tr'),
('csgb', 'Çalışma ve Sosyal Güvenlik Bakanlığı', 'https://www.csgb.gov.tr'),
('isggm', 'İş Sağlığı ve Güvenliği Genel Müdürlüğü', 'https://www.isggm.gov.tr'),
('casgem', 'ÇASGEM', 'https://www.casgem.gov.tr'),
('resmi_gazete', 'Resmi Gazete', 'https://www.resmigazete.gov.tr')
ON CONFLICT (source_key) DO NOTHING;

-- =============================================
-- 2. MEVZUAT DÖKÜMANLARI
-- =============================================
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.legal_sources(id),
  doc_type text NOT NULL CHECK (doc_type IN ('law', 'regulation', 'communique', 'guide', 'announcement', 'circular', 'standard')),
  doc_number text,
  title text NOT NULL,
  official_gazette_date date,
  official_gazette_number text,
  effective_date date,
  full_text text,
  full_text_html text,
  source_url text,
  source_hash text,
  is_active boolean DEFAULT true,
  last_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON public.legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_number ON public.legal_documents(doc_number);
CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON public.legal_documents(is_active);

-- =============================================
-- 3. MEVZUAT MADDELERİ (CHUNKS + EMBEDDING)
-- =============================================
CREATE TABLE IF NOT EXISTS public.legal_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  article_number text,
  article_title text,
  content text NOT NULL,
  content_tokens integer,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_document ON public.legal_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_article ON public.legal_chunks(article_number);

-- =============================================
-- 4. DUYURULAR VE HABERLER
-- =============================================
CREATE TABLE IF NOT EXISTS public.isg_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.legal_sources(id),
  title text NOT NULL,
  summary text,
  content text,
  announcement_date date,
  source_url text,
  source_hash text,
  category text CHECK (category IN ('duyuru', 'haber', 'egitim', 'seminer', 'mevzuat_degisikligi', 'diger')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_date ON public.isg_announcements(announcement_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.isg_announcements(category);

-- =============================================
-- 5. SYNC LOGLARI
-- =============================================
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.legal_sources(id),
  sync_type text CHECK (sync_type IN ('full', 'incremental', 'daily')),
  status text CHECK (status IN ('started', 'completed', 'failed')),
  documents_added integer DEFAULT 0,
  documents_updated integer DEFAULT 0,
  chunks_created integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- =============================================
-- 6. ÇÖZÜM MERKEZİ SORGULARI
-- =============================================
CREATE TABLE IF NOT EXISTS public.solution_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  query_text text NOT NULL,
  query_embedding vector(1536),
  query_image_url text,
  ai_response text,
  sources_used jsonb,
  web_sources_used jsonb,
  response_tokens integer,
  is_cached boolean DEFAULT false,
  is_saved boolean DEFAULT false,
  tags text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solution_queries_user ON public.solution_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_solution_queries_saved ON public.solution_queries(is_saved) WHERE is_saved = true;

-- =============================================
-- 7. OLUŞTURULAN DOKÜMANLAR
-- =============================================
CREATE TABLE IF NOT EXISTS public.solution_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES public.solution_queries(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  doc_type text CHECK (doc_type IN ('procedure', 'training', 'risk_assessment', 'form', 'instruction', 'presentation', 'other')),
  title text NOT NULL,
  doc_url text,
  doc_content text,
  created_at timestamptz DEFAULT now()
);
;
