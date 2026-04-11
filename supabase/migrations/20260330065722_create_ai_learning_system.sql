
-- AI Öğrenme Sistemi Tabloları

-- 1. Kullanıcı Etkileşimleri (site içi davranışlar)
CREATE TABLE IF NOT EXISTS public.ai_user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  interaction_type text NOT NULL, -- 'page_view', 'search', 'document_create', 'button_click', 'form_submit'
  page_path text,
  action_data jsonb DEFAULT '{}', -- tıklanan buton, arama terimi, vs.
  context jsonb DEFAULT '{}', -- sayfa bağlamı, önceki sayfa, vs.
  created_at timestamptz DEFAULT now()
);

-- 2. Arama Sorguları (kullanıcıların ne aradığı)
CREATE TABLE IF NOT EXISTS public.ai_search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text text NOT NULL,
  query_embedding vector(1536),
  results_count int DEFAULT 0,
  clicked_result_id uuid,
  search_context text, -- 'mevzuat', 'document', 'general'
  is_successful boolean, -- kullanıcı sonuçla etkileşime girdi mi
  created_at timestamptz DEFAULT now()
);

-- 3. İnternet Verileri (dış kaynaklardan toplanan)
CREATE TABLE IF NOT EXISTS public.ai_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL, -- 'resmi_gazete', 'csgb', 'isggm', 'news'
  source_url text,
  title text,
  content text,
  content_embedding vector(1536),
  published_date date,
  scraped_at timestamptz DEFAULT now(),
  is_processed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'
);

-- 4. Öğrenilen Kalıplar (AI'ın çıkardığı pattern'ler)
CREATE TABLE IF NOT EXISTS public.ai_learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL, -- 'search_intent', 'document_template', 'common_question', 'workflow'
  pattern_data jsonb NOT NULL,
  confidence_score float DEFAULT 0,
  occurrence_count int DEFAULT 1,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 5. Eğitim Durumu (model eğitim logları)
CREATE TABLE IF NOT EXISTS public.ai_training_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_type text NOT NULL, -- 'embedding_update', 'pattern_extraction', 'data_scrape'
  status text DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  data_count int DEFAULT 0,
  metrics jsonb DEFAULT '{}',
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 6. Günlük Özet (dashboard için)
CREATE TABLE IF NOT EXISTS public.ai_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date date NOT NULL UNIQUE,
  total_interactions int DEFAULT 0,
  total_searches int DEFAULT 0,
  new_patterns_found int DEFAULT 0,
  external_data_collected int DEFAULT 0,
  top_search_terms jsonb DEFAULT '[]',
  top_pages jsonb DEFAULT '[]',
  insights jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON public.ai_user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_type ON public.ai_user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON public.ai_user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_search_queries_created ON public.ai_search_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_external_data_source ON public.ai_external_data(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_external_data_scraped ON public.ai_external_data(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON public.ai_learned_patterns(pattern_type);

-- RLS Politikaları
ALTER TABLE public.ai_user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_external_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_daily_summary ENABLE ROW LEVEL SECURITY;

-- Admin/sistem erişimi (service role ile)
CREATE POLICY "Service role full access" ON public.ai_user_interactions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_search_queries FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_external_data FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_learned_patterns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_training_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ai_daily_summary FOR ALL USING (true);
;
