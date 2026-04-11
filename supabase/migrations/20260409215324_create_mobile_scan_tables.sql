
-- Mobile scan sessions
CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  risk_method text NOT NULL DEFAULT 'l_matrix',
  location_name text,
  gps_start_lat double precision,
  gps_start_lng double precision,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  total_risks_found integer DEFAULT 0,
  total_frames_analyzed integer DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Scan detections (real-time risk findings from mobile camera)
CREATE TABLE IF NOT EXISTS public.scan_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  frame_number integer,
  risk_name text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_category text,
  confidence integer DEFAULT 0,
  description text,
  recommended_action text,
  location_hint text,
  method_specific_data jsonb DEFAULT '{}',
  screenshot_url text,
  gps_lat double precision,
  gps_lng double precision,
  compass_heading double precision,
  transferred_to_assessment uuid REFERENCES public.risk_assessments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Scan frames (analyzed camera frames)
CREATE TABLE IF NOT EXISTS public.scan_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  frame_number integer NOT NULL,
  image_url text,
  risks_in_frame integer DEFAULT 0,
  faces_detected integer DEFAULT 0,
  analysis_result jsonb,
  gps_lat double precision,
  gps_lng double precision,
  compass_heading double precision,
  device_pitch double precision,
  device_roll double precision,
  created_at timestamptz DEFAULT now()
);

-- Digital twin spatial points
CREATE TABLE IF NOT EXISTS public.digital_twin_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  point_index integer NOT NULL,
  gps_lat double precision,
  gps_lng double precision,
  gps_altitude double precision,
  compass_heading double precision,
  device_pitch double precision,
  device_roll double precision,
  image_url text,
  risks_at_point jsonb DEFAULT '[]',
  environment_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Storage bucket for scan images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('scan-images', 'scan-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_twin_points ENABLE ROW LEVEL SECURITY;

-- Scan sessions: users can manage their own
CREATE POLICY "Users can manage own scan sessions" ON public.scan_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Scan detections: accessible via session ownership
CREATE POLICY "Users can manage detections via session" ON public.scan_detections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_detections.session_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_detections.session_id AND user_id = auth.uid())
  );

-- Scan frames: accessible via session ownership
CREATE POLICY "Users can manage frames via session" ON public.scan_frames
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_frames.session_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = scan_frames.session_id AND user_id = auth.uid())
  );

-- Digital twin points: accessible via session ownership
CREATE POLICY "Users can manage twin points via session" ON public.digital_twin_points
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = digital_twin_points.session_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = digital_twin_points.session_id AND user_id = auth.uid())
  );

-- Storage policies for scan-images bucket
CREATE POLICY "Authenticated users can upload scan images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scan-images');

CREATE POLICY "Authenticated users can read scan images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scan-images');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user ON public.scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_company ON public.scan_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_scan_detections_session ON public.scan_detections(session_id);
CREATE INDEX IF NOT EXISTS idx_scan_detections_company ON public.scan_detections(company_id);
CREATE INDEX IF NOT EXISTS idx_scan_frames_session ON public.scan_frames(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_points_session ON public.digital_twin_points(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_points_company ON public.digital_twin_points(company_id);
;
