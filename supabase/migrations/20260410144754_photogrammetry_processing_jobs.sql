
-- Photogrammetry processing jobs queue
CREATE TABLE IF NOT EXISTS public.photogrammetry_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  input_image_count integer DEFAULT 0,
  progress_percent integer DEFAULT 0,
  model_url text,
  thumbnail_url text,
  point_count integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.photogrammetry_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own photogrammetry jobs" ON public.photogrammetry_jobs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: scan bittikten sonra photogrammetry job'u otomatik oluştur
CREATE OR REPLACE FUNCTION public.create_photogrammetry_job_on_scan_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.total_frames_analyzed >= 10 THEN
    INSERT INTO public.photogrammetry_jobs (session_id, user_id, input_image_count, status)
    VALUES (NEW.id, NEW.user_id, NEW.total_frames_analyzed, 'queued');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_create_photogrammetry ON public.scan_sessions;
CREATE TRIGGER trig_create_photogrammetry
  AFTER UPDATE ON public.scan_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_photogrammetry_job_on_scan_complete();

CREATE INDEX IF NOT EXISTS idx_photogrammetry_jobs_session ON public.photogrammetry_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_photogrammetry_jobs_status ON public.photogrammetry_jobs(status);
;
