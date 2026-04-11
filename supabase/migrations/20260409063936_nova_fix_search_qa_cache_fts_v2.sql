
-- Eski fonksiyonu doğru imzayla düşür
DROP FUNCTION IF EXISTS public.search_qa_cache(text, uuid, double precision, integer);

-- Yeni full-text search tabanlı fonksiyon
CREATE OR REPLACE FUNCTION public.search_qa_cache(
  query_text text,
  similarity_threshold double precision DEFAULT 0.05,
  max_results integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  answer_sources jsonb,
  similarity double precision,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qa.id,
    qa.question,
    qa.answer,
    qa.answer_sources,
    ts_rank(
      to_tsvector('simple', coalesce(qa.question, '')),
      plainto_tsquery('simple', query_text)
    )::double precision AS similarity,
    qa.usage_count
  FROM public.ai_qa_learning qa
  WHERE
    to_tsvector('simple', coalesce(qa.question, '')) @@ plainto_tsquery('simple', query_text)
    AND ts_rank(
      to_tsvector('simple', coalesce(qa.question, '')),
      plainto_tsquery('simple', query_text)
    ) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.search_qa_cache IS 'Semantic cache - PostgreSQL full-text search (embedding gerektirmez, sadece Claude API kullanir).';
;
