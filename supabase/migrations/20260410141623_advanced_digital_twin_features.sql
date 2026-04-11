
-- Ses notları
ALTER TABLE public.digital_twin_points
  ADD COLUMN IF NOT EXISTS voice_note_url text,
  ADD COLUMN IF NOT EXISTS voice_note_duration integer,
  ADD COLUMN IF NOT EXISTS text_note text,
  ADD COLUMN IF NOT EXISTS cluster_id integer;

-- Risk kümeleri tablosu (DBSCAN sonuçları)
CREATE TABLE IF NOT EXISTS public.risk_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  cluster_index integer NOT NULL,
  center_lat double precision,
  center_lng double precision,
  radius_m double precision,
  point_count integer DEFAULT 0,
  risk_count integer DEFAULT 0,
  dominant_level text,
  risk_breakdown jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-notes', 'voice-notes', true, 5242880, ARRAY['audio/m4a','audio/mp4','audio/mpeg','audio/wav','audio/webm'])
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.risk_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage clusters via session" ON public.risk_clusters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = risk_clusters.session_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = risk_clusters.session_id AND user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can upload voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Authenticated users can read voice notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes');

CREATE INDEX IF NOT EXISTS idx_risk_clusters_session ON public.risk_clusters(session_id);
;
