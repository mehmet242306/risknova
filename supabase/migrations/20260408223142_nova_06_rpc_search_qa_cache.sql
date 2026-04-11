
CREATE OR REPLACE FUNCTION public.search_qa_cache(
  query_embedding vector(1536),
  org_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.92,
  max_results integer DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  answer_sources jsonb,
  similarity float,
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
    1 - (qa.question_embedding <=> query_embedding) AS similarity,
    qa.usage_count
  FROM public.ai_qa_learning qa
  WHERE
    qa.question_embedding IS NOT NULL
    AND (1 - (qa.question_embedding <=> query_embedding)) > similarity_threshold
  ORDER BY qa.question_embedding <=> query_embedding ASC
  LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.search_qa_cache IS 'Semantic cache arama. Verilen embedding e benzer Q&A bulur.';
;
