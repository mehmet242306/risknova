
-- pgvector extension (zaten var ama emin olalım)
CREATE EXTENSION IF NOT EXISTS vector;

-- FTS versiyonunu düşür
DROP FUNCTION IF EXISTS public.search_qa_cache(text, double precision, integer);

-- Embedding versiyonunu oluştur
CREATE OR REPLACE FUNCTION public.search_qa_cache(
  query_embedding vector(1536),
  similarity_threshold double precision DEFAULT 0.85,
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
    (1 - (qa.question_embedding <=> query_embedding))::double precision AS similarity,
    qa.usage_count
  FROM public.ai_qa_learning qa
  WHERE
    qa.question_embedding IS NOT NULL
    AND (1 - (qa.question_embedding <=> query_embedding)) > similarity_threshold
  ORDER BY qa.question_embedding <=> query_embedding ASC
  LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.search_qa_cache IS 'Semantic cache - OpenAI embeddings ile vector similarity. Cosine distance kullanir.';

-- Embedding icin index (performans)
CREATE INDEX IF NOT EXISTS idx_ai_qa_learning_embedding
  ON public.ai_qa_learning
  USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);
;
