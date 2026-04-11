
-- ============================================================
-- MIGRATION: Set search_path on all vulnerable functions
-- This prevents search_path hijacking attacks
-- Date: 2026-04-02
-- ============================================================

ALTER FUNCTION public.block_company_invitation_permissions_mutation()
  SET search_path = '';

ALTER FUNCTION public.check_if_repealed(content text)
  SET search_path = '';

ALTER FUNCTION public.create_company_identity_with_workspace(
  p_org_id uuid, p_official_name text, p_display_name text, 
  p_tax_number text, p_sector text, p_nace_code text, 
  p_hazard_class text, p_company_type text
) SET search_path = '';

ALTER FUNCTION public.create_detailed_reference(
  doc_number text, doc_title text, article_text text, 
  paragraph_num integer, subparagraph text
) SET search_path = '';

ALTER FUNCTION public.create_reference_format(
  doc_number text, doc_title text, article_text text
) SET search_path = '';

ALTER FUNCTION public.current_organization_id()
  SET search_path = '';

ALTER FUNCTION public.extract_amendment_info(content text)
  SET search_path = '';

ALTER FUNCTION public.extract_legal_keywords(content text)
  SET search_path = '';

ALTER FUNCTION public.extract_paragraph_numbers(content text)
  SET search_path = '';

ALTER FUNCTION public.find_similar_isg_question(
  query_embedding vector, similarity_threshold double precision
) SET search_path = '';

ALTER FUNCTION public.find_similar_query(
  query_embedding vector, similarity_threshold double precision
) SET search_path = '';

ALTER FUNCTION public.generate_company_code()
  SET search_path = '';

ALTER FUNCTION public.generate_company_join_request_code()
  SET search_path = '';

ALTER FUNCTION public.get_legal_docs_with_counts()
  SET search_path = '';

ALTER FUNCTION public.guard_company_invitation_status_transition()
  SET search_path = '';

ALTER FUNCTION public.legal_chunks_search_vector_update()
  SET search_path = '';

ALTER FUNCTION public.normalize_article_number(article_text text)
  SET search_path = '';

ALTER FUNCTION public.normalize_email(p_email text)
  SET search_path = '';

ALTER FUNCTION public.parse_article_type(article_text text)
  SET search_path = '';

ALTER FUNCTION public.search_isg_knowledge(
  query_embedding vector, category_filter text, 
  match_threshold double precision, match_count integer
) SET search_path = '';

ALTER FUNCTION public.search_legal_chunks(
  query_embedding vector, match_threshold double precision, match_count integer
) SET search_path = '';

ALTER FUNCTION public.search_legal_chunks_v2(
  search_terms text[], result_limit integer
) SET search_path = '';

ALTER FUNCTION public.search_legal_fulltext(
  search_query text, result_limit integer
) SET search_path = '';

ALTER FUNCTION public.search_legal_text(
  search_query text, result_limit integer
) SET search_path = '';

ALTER FUNCTION public.search_mevzuat_semantic(
  query_embedding vector, match_threshold double precision, match_count integer
) SET search_path = '';

ALTER FUNCTION public.search_mevzuat_text(
  search_query text, result_limit integer
) SET search_path = '';

ALTER FUNCTION public.set_current_timestamp_updated_at()
  SET search_path = '';

ALTER FUNCTION public.set_row_updated_at()
  SET search_path = '';

ALTER FUNCTION public.touch_updated_at()
  SET search_path = '';

ALTER FUNCTION public.touch_updated_at_generic()
  SET search_path = '';

ALTER FUNCTION public.turkish_ordinal_suffix(num_str text)
  SET search_path = '';

ALTER FUNCTION public.validate_company_member_module_permission_identity()
  SET search_path = '';
;
