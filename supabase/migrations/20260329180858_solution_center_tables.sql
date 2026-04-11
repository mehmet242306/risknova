
CREATE TABLE IF NOT EXISTS public.solution_queries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid        REFERENCES public.organizations(id) ON DELETE SET NULL,
  query_text        text        NOT NULL,
  query_image_url   text,
  ai_response       text,
  response_metadata jsonb,
  is_saved          boolean     DEFAULT false,
  tags              text[],
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solution_queries_user ON public.solution_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_solution_queries_saved ON public.solution_queries(user_id, is_saved) WHERE is_saved = true;

ALTER TABLE public.solution_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sq_select" ON public.solution_queries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sq_insert" ON public.solution_queries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sq_update" ON public.solution_queries
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sq_delete" ON public.solution_queries
  FOR DELETE USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.solution_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id    uuid        NOT NULL REFERENCES public.solution_queries(id) ON DELETE CASCADE,
  doc_type    text        NOT NULL CHECK (doc_type IN ('procedure','training','risk_assessment','form','other')),
  doc_title   text,
  doc_url     text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.solution_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sd_select" ON public.solution_documents
  FOR SELECT USING (
    query_id IN (SELECT id FROM public.solution_queries WHERE user_id = auth.uid())
  );
CREATE POLICY "sd_insert" ON public.solution_documents
  FOR INSERT WITH CHECK (
    query_id IN (SELECT id FROM public.solution_queries WHERE user_id = auth.uid())
  );
CREATE POLICY "sd_delete" ON public.solution_documents
  FOR DELETE USING (
    query_id IN (SELECT id FROM public.solution_queries WHERE user_id = auth.uid())
  );
;
