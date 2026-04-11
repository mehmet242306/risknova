
-- Create a proper search function that handles Turkish characters correctly
CREATE OR REPLACE FUNCTION public.search_legal_chunks_v2(
  search_terms text[],
  result_limit integer DEFAULT 15
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  doc_title text,
  doc_type text,
  doc_number text,
  article_number text,
  article_title text,
  content text,
  rank double precision
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    lc.id as chunk_id,
    lc.document_id,
    ld.title as doc_title,
    ld.doc_type,
    ld.doc_number,
    lc.article_number,
    lc.article_title,
    lc.content,
    ts_rank(lc.search_vector, to_tsquery('simple', array_to_string(search_terms, ' | '))) as rank
  FROM public.legal_chunks lc
  JOIN public.legal_documents ld ON ld.id = lc.document_id
  WHERE ld.is_active = true
    AND lc.search_vector @@ to_tsquery('simple', array_to_string(search_terms, ' | '))
  ORDER BY rank DESC
  LIMIT result_limit;
$function$;
;
