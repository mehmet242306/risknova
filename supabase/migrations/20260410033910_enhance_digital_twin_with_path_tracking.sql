
-- digital_twin_points'e ek sensor alanlari
ALTER TABLE public.digital_twin_points
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision,
  ADD COLUMN IF NOT EXISTS gps_speed double precision,
  ADD COLUMN IF NOT EXISTS acceleration_x double precision,
  ADD COLUMN IF NOT EXISTS acceleration_y double precision,
  ADD COLUMN IF NOT EXISTS acceleration_z double precision,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz DEFAULT now();

-- scan_sessions'a yol takibi icin alanlar
ALTER TABLE public.scan_sessions
  ADD COLUMN IF NOT EXISTS path_coordinates jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_distance_m double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounds_min_lat double precision,
  ADD COLUMN IF NOT EXISTS bounds_min_lng double precision,
  ADD COLUMN IF NOT EXISTS bounds_max_lat double precision,
  ADD COLUMN IF NOT EXISTS bounds_max_lng double precision;

-- scan_frames'e sensor alanlari
ALTER TABLE public.scan_frames
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz DEFAULT now();

-- Session statistics view
CREATE OR REPLACE VIEW public.scan_session_stats AS
SELECT
  s.id as session_id,
  s.company_id,
  s.user_id,
  s.location_name,
  s.status,
  s.risk_method,
  s.duration_seconds,
  s.total_risks_found,
  s.total_frames_analyzed,
  s.total_distance_m,
  s.created_at,
  s.completed_at,
  s.bounds_min_lat,
  s.bounds_min_lng,
  s.bounds_max_lat,
  s.bounds_max_lng,
  COALESCE((SELECT COUNT(*) FROM public.digital_twin_points WHERE session_id = s.id), 0) as points_count,
  COALESCE((SELECT COUNT(*) FROM public.scan_detections WHERE session_id = s.id AND risk_level = 'critical'), 0) as critical_count,
  COALESCE((SELECT COUNT(*) FROM public.scan_detections WHERE session_id = s.id AND risk_level = 'high'), 0) as high_count,
  COALESCE((SELECT COUNT(*) FROM public.scan_detections WHERE session_id = s.id AND risk_level = 'medium'), 0) as medium_count,
  COALESCE((SELECT COUNT(*) FROM public.scan_detections WHERE session_id = s.id AND risk_level = 'low'), 0) as low_count
FROM public.scan_sessions s;

-- Index on gps fields for spatial queries
CREATE INDEX IF NOT EXISTS idx_twin_points_gps ON public.digital_twin_points(gps_lat, gps_lng) WHERE gps_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_twin_points_captured ON public.digital_twin_points(captured_at);
;
