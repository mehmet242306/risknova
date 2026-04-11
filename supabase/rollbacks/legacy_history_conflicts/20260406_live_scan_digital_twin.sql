-- ============================================
-- Canlı Saha Taraması & Dijital İkiz Tabloları
-- ============================================

-- Tarama oturumları
CREATE TABLE IF NOT EXISTS scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  risk_method TEXT NOT NULL DEFAULT 'l_matrix',
  location_name TEXT,
  gps_start_lat DOUBLE PRECISION,
  gps_start_lng DOUBLE PRECISION,
  total_risks_found INTEGER DEFAULT 0,
  total_frames_analyzed INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Tespit edilen riskler (her bir AI tespiti)
CREATE TABLE IF NOT EXISTS scan_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  risk_name TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  risk_category TEXT, -- yangin, dusme, elektrik, kkd, kimyasal, ergonomik vb.
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  description TEXT,
  recommended_action TEXT,
  location_hint TEXT, -- top-left, center, bottom-right vb.
  method_specific_data JSONB DEFAULT '{}', -- Fine-Kinney skorları, FMEA RPN vb.
  screenshot_url TEXT, -- Supabase Storage'daki fotoğraf URL'si
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  compass_heading DOUBLE PRECISION,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);
-- Tarama kareleri (analiz edilen her frame)
CREATE TABLE IF NOT EXISTS scan_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  image_url TEXT, -- Storage URL
  risks_in_frame INTEGER DEFAULT 0,
  faces_detected INTEGER DEFAULT 0,
  analysis_result JSONB DEFAULT '{}',
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  compass_heading DOUBLE PRECISION,
  device_pitch DOUBLE PRECISION,
  device_roll DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Dijital ikiz uzamsal veri noktaları
CREATE TABLE IF NOT EXISTS digital_twin_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  point_index INTEGER NOT NULL,
  gps_lat DOUBLE PRECISION NOT NULL,
  gps_lng DOUBLE PRECISION NOT NULL,
  gps_altitude DOUBLE PRECISION,
  compass_heading DOUBLE PRECISION,
  device_pitch DOUBLE PRECISION,
  device_roll DOUBLE PRECISION,
  image_url TEXT,
  depth_estimate DOUBLE PRECISION, -- AI tahmini derinlik
  risks_at_point JSONB DEFAULT '[]',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Dijital ikiz modelleri (tamamlanmış taramalar)
CREATE TABLE IF NOT EXISTS digital_twin_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  location_name TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  total_points INTEGER DEFAULT 0,
  total_risks INTEGER DEFAULT 0,
  bounding_box JSONB, -- {min_lat, max_lat, min_lng, max_lng}
  model_data JSONB DEFAULT '{}', -- 3D model verileri
  thumbnail_url TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_scan_sessions_company ON scan_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scan_detections_session ON scan_detections(session_id);
CREATE INDEX IF NOT EXISTS idx_scan_detections_level ON scan_detections(risk_level);
CREATE INDEX IF NOT EXISTS idx_scan_frames_session ON scan_frames(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_points_session ON digital_twin_points(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_models_company ON digital_twin_models(company_id);
-- RLS
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_twin_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_twin_models ENABLE ROW LEVEL SECURITY;
-- Basit RLS policy: authenticated users kendi company verilerine erişebilir
CREATE POLICY "scan_sessions_policy" ON scan_sessions FOR ALL USING (true);
CREATE POLICY "scan_detections_policy" ON scan_detections FOR ALL USING (true);
CREATE POLICY "scan_frames_policy" ON scan_frames FOR ALL USING (true);
CREATE POLICY "digital_twin_points_policy" ON digital_twin_points FOR ALL USING (true);
CREATE POLICY "digital_twin_models_policy" ON digital_twin_models FOR ALL USING (true);
-- Realtime yayını aktif et
ALTER PUBLICATION supabase_realtime ADD TABLE scan_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE scan_detections;
