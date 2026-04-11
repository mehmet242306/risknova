
-- =============================================
-- RLS POLİTİKALARI
-- =============================================

-- Mevzuat kaynakları - herkes okuyabilir
ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_sources_read_all" ON public.legal_sources;
CREATE POLICY "legal_sources_read_all" ON public.legal_sources 
  FOR SELECT USING (true);

-- Mevzuat dökümanları - herkes okuyabilir
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_documents_read_all" ON public.legal_documents;
CREATE POLICY "legal_documents_read_all" ON public.legal_documents 
  FOR SELECT USING (true);

-- Mevzuat maddeleri - herkes okuyabilir
ALTER TABLE public.legal_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_chunks_read_all" ON public.legal_chunks;
CREATE POLICY "legal_chunks_read_all" ON public.legal_chunks 
  FOR SELECT USING (true);

-- Duyurular - herkes okuyabilir
ALTER TABLE public.isg_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_read_all" ON public.isg_announcements;
CREATE POLICY "announcements_read_all" ON public.isg_announcements 
  FOR SELECT USING (true);

-- Sync logları - sadece servis rolü
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_logs_service_only" ON public.sync_logs;
CREATE POLICY "sync_logs_service_only" ON public.sync_logs 
  FOR ALL USING (false);

-- Çözüm merkezi sorguları - kullanıcıya özel
ALTER TABLE public.solution_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solution_queries_own_read" ON public.solution_queries;
DROP POLICY IF EXISTS "solution_queries_own_insert" ON public.solution_queries;
DROP POLICY IF EXISTS "solution_queries_own_update" ON public.solution_queries;
DROP POLICY IF EXISTS "solution_queries_own_delete" ON public.solution_queries;
CREATE POLICY "solution_queries_own_read" ON public.solution_queries 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "solution_queries_own_insert" ON public.solution_queries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "solution_queries_own_update" ON public.solution_queries 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "solution_queries_own_delete" ON public.solution_queries 
  FOR DELETE USING (auth.uid() = user_id);

-- Oluşturulan dokümanlar - sorgu sahibine özel (query üzerinden)
ALTER TABLE public.solution_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solution_documents_own" ON public.solution_documents;
CREATE POLICY "solution_documents_own" ON public.solution_documents 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.solution_queries sq 
      WHERE sq.id = solution_documents.query_id 
      AND sq.user_id = auth.uid()
    )
  );
;
