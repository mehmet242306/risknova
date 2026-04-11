
-- İSG Uzman AI Sistemi - Kendi Kendini Eğiten Model

-- 1. Bilgi Tabanı (Knowledge Base)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'mevzuat', 'risk_assessment', 'accident_analysis', 'kkd', 'training', 'sector_specific'
  subcategory text,
  title text NOT NULL,
  content text NOT NULL,
  content_embedding vector(1536),
  source_type text, -- 'internal', 'external', 'user_generated', 'ai_generated'
  source_url text,
  reliability_score float DEFAULT 0.5, -- 0-1 arası güvenilirlik
  usage_count int DEFAULT 0,
  last_used_at timestamptz,
  is_verified boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Sektör Bilgisi
CREATE TABLE IF NOT EXISTS public.ai_sector_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nace_code text NOT NULL,
  sector_name text NOT NULL,
  hazard_class text, -- 'az_tehlikeli', 'tehlikeli', 'cok_tehlikeli'
  common_risks jsonb DEFAULT '[]', -- sık görülen riskler
  required_kkd jsonb DEFAULT '[]', -- gerekli KKD listesi
  legal_requirements jsonb DEFAULT '[]', -- yasal gereklilikler
  best_practices jsonb DEFAULT '[]', -- en iyi uygulamalar
  accident_statistics jsonb DEFAULT '{}',
  training_requirements jsonb DEFAULT '[]',
  learned_from_count int DEFAULT 0, -- kaç vaka/rapor analiz edildi
  confidence_score float DEFAULT 0.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Soru-Cevap Öğrenme
CREATE TABLE IF NOT EXISTS public.ai_qa_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  question_embedding vector(1536),
  question_intent text, -- 'mevzuat_soru', 'risk_analiz', 'kkd_secim', 'egitim', 'genel'
  answer text NOT NULL,
  answer_sources jsonb DEFAULT '[]', -- kullanılan kaynaklar
  user_feedback_score float, -- kullanıcı puanı (1-5)
  expert_verified boolean DEFAULT false,
  usage_count int DEFAULT 0,
  success_rate float DEFAULT 0, -- bu cevap kaç kez işe yaradı
  sector_context text[], -- hangi sektörler için geçerli
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Risk Pattern'leri (Öğrenilen)
CREATE TABLE IF NOT EXISTS public.ai_risk_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  risk_category text, -- 'fiziksel', 'kimyasal', 'biyolojik', 'ergonomik', 'psikososyal'
  trigger_conditions jsonb NOT NULL, -- hangi koşullarda bu risk oluşur
  severity_factors jsonb DEFAULT '[]', -- şiddeti etkileyen faktörler
  probability_factors jsonb DEFAULT '[]', -- olasılığı etkileyen faktörler
  recommended_controls jsonb DEFAULT '[]', -- önerilen önlemler
  related_accidents int DEFAULT 0, -- ilişkili kaza sayısı
  related_sectors text[],
  confidence_score float DEFAULT 0.5,
  learned_from_cases int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Eğitim Verileri (Model Training Data)
CREATE TABLE IF NOT EXISTS public.ai_training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type text NOT NULL, -- 'instruction', 'conversation', 'document', 'qa_pair'
  input_text text NOT NULL,
  output_text text,
  category text,
  quality_score float DEFAULT 0.5, -- veri kalitesi
  is_used_in_training boolean DEFAULT false,
  training_batch_id text,
  source text, -- nereden geldi
  created_at timestamptz DEFAULT now()
);

-- 6. Model Versiyonları
CREATE TABLE IF NOT EXISTS public.ai_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name text NOT NULL,
  base_model text, -- 'gpt-4', 'claude-3', 'custom-fine-tuned'
  training_data_count int DEFAULT 0,
  knowledge_base_count int DEFAULT 0,
  performance_metrics jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 7. Öğrenme Oturumları (her gün otomatik çalışacak)
CREATE TABLE IF NOT EXISTS public.ai_learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type text NOT NULL, -- 'data_collection', 'embedding_update', 'pattern_extraction', 'model_evaluation'
  status text DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  data_processed int DEFAULT 0,
  new_knowledge_added int DEFAULT 0,
  patterns_discovered int DEFAULT 0,
  metrics jsonb DEFAULT '{}',
  error_log text,
  started_at timestamptz,
  completed_at timestamptz,
  scheduled_for timestamptz DEFAULT now()
);

-- 8. Dış Kaynak Takibi
CREATE TABLE IF NOT EXISTS public.ai_external_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_type text NOT NULL, -- 'rss', 'api', 'scrape', 'manual'
  source_url text NOT NULL,
  category text, -- 'mevzuat', 'haber', 'istatistik', 'duyuru'
  is_active boolean DEFAULT true,
  check_frequency interval DEFAULT '1 day',
  last_checked_at timestamptz,
  last_new_content_at timestamptz,
  total_items_collected int DEFAULT 0,
  reliability_score float DEFAULT 0.7,
  created_at timestamptz DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.ai_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON public.ai_knowledge_base USING ivfflat (content_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_sector_nace ON public.ai_sector_knowledge(nace_code);
CREATE INDEX IF NOT EXISTS idx_qa_embedding ON public.ai_qa_learning USING ivfflat (question_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_qa_intent ON public.ai_qa_learning(question_intent);
CREATE INDEX IF NOT EXISTS idx_risk_patterns_category ON public.ai_risk_patterns(risk_category);
CREATE INDEX IF NOT EXISTS idx_training_data_type ON public.ai_training_data(data_type);

-- Bilgi tabanı arama fonksiyonu
CREATE OR REPLACE FUNCTION search_isg_knowledge(
  query_embedding vector(1536),
  category_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  content text,
  source_type text,
  reliability_score float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.title,
    kb.content,
    kb.source_type,
    kb.reliability_score,
    1 - (kb.content_embedding <=> query_embedding) as similarity
  FROM public.ai_knowledge_base kb
  WHERE 
    1 - (kb.content_embedding <=> query_embedding) > match_threshold
    AND (category_filter IS NULL OR kb.category = category_filter)
  ORDER BY kb.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Benzer soru bulma fonksiyonu
CREATE OR REPLACE FUNCTION find_similar_isg_question(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.85
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  success_rate float,
  expert_verified boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qa.id,
    qa.question,
    qa.answer,
    qa.success_rate,
    qa.expert_verified
  FROM public.ai_qa_learning qa
  WHERE 1 - (qa.question_embedding <=> query_embedding) > similarity_threshold
  ORDER BY qa.question_embedding <=> query_embedding
  LIMIT 1;
END;
$$;
;
