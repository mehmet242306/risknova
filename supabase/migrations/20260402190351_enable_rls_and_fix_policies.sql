
-- ============================================================
-- MIGRATION: Enable RLS on unprotected tables & fix dangerous policies
-- Date: 2026-04-02
-- ============================================================

-- PART 1: Enable RLS on all tables that currently have it disabled
-- These tables are completely open to anyone with the anon key

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sector_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_qa_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_risk_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_cross_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_article_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_sector_relevance ENABLE ROW LEVEL SECURITY;

-- PART 2: Drop dangerous "Service role full access" policies
-- These use USING(true) on ALL operations for the public role,
-- meaning anon users can read/write/delete everything.
-- Service role already bypasses RLS, so these policies are unnecessary AND dangerous.

DROP POLICY IF EXISTS "Service role full access" ON public.ai_daily_summary;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_external_data;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_learned_patterns;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_search_queries;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_training_logs;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_user_interactions;

-- PART 3: Add read-only policies for authenticated users on legal reference tables
-- (these are public legal data that authenticated users should be able to read)

CREATE POLICY "authenticated_read_legal_cross_references"
  ON public.legal_cross_references
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_legal_article_history"
  ON public.legal_article_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_legal_sector_relevance"
  ON public.legal_sector_relevance
  FOR SELECT
  TO authenticated
  USING (true);

-- PART 4: Add read-only policies for authenticated users on AI reference tables
-- (knowledge base data is read by the app but should not be writable via client)

CREATE POLICY "authenticated_read_ai_knowledge_base"
  ON public.ai_knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_ai_sector_knowledge"
  ON public.ai_sector_knowledge
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_ai_risk_patterns"
  ON public.ai_risk_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_ai_external_sources"
  ON public.ai_external_sources
  FOR SELECT
  TO authenticated
  USING (true);
;
