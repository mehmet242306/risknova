
CREATE TABLE IF NOT EXISTS public.scan_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  markdown text NOT NULL,
  context jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reports" ON public.scan_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_reports.session_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_reports.session_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_scan_reports_session ON public.scan_reports(session_id);
;
