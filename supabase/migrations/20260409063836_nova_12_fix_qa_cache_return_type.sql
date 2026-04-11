
DROP FUNCTION IF EXISTS public.search_qa_cache(text, uuid, float, integer);

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
  rank real,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('simple', query_text);

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
    AND ts_rank(qa.search_vector, ts_query) > min_rank::real
  ORDER BY ts_rank(qa.search_vector, ts_query) DESC
  LIMIT max_results;
END;
$$;
;
