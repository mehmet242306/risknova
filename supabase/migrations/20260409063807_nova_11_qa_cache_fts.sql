
-- ai_qa_learning tablosuna search_vector kolonu ekle (generated column)
ALTER TABLE public.ai_qa_learning
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', COALESCE(question, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(question_intent, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(answer, '')), 'C')
) STORED;

-- GIN index ekle (FTS için şart)
CREATE INDEX IF NOT EXISTS idx_ai_qa_learning_search_vector
  ON public.ai_qa_learning USING gin(search_vector);

-- Eski search_qa_cache fonksiyonunu sil (embedding bazlıydı)
DROP FUNCTION IF EXISTS public.search_qa_cache(vector, uuid, float, integer);

-- Yeni search_qa_cache: FTS bazlı
CREATE OR REPLACE FUNCTION public.search_qa_cache(
  query_text text,
  org_id uuid DEFAULT NULL,
  min_rank float DEFAULT 0.1,
  max_results integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  answer_sources jsonb,
  rank float,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  -- Plainto_tsquery güvenli (özel karakterlerden etkilenmez)
  ts_query := plainto_tsquery('simple', query_text);

  -- Boş query kontrolü
  IF ts_query::text = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    qa.id,
    qa.question,
    qa.answer,
    qa.answer_sources,
    ts_rank(qa.search_vector, ts_query) AS rank,
    qa.usage_count
  FROM public.ai_qa_learning qa
  WHERE
    qa.search_vector @@ ts_query
    AND ts_rank(qa.search_vector, ts_query) > min_rank
  ORDER BY ts_rank(qa.search_vector, ts_query) DESC
  LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.search_qa_cache IS 'Semantic cache arama (FTS bazli, embedding kullanmaz). Turkce stemming ile calisir.';
;
