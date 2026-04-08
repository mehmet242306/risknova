-- Hallucination Reduction: confidence_tier, vision_analysis_logs, expert onay

-- 1. risk_assessment_findings: confidence_tier kolonu
ALTER TABLE public.risk_assessment_findings
  ADD COLUMN IF NOT EXISTS confidence_tier text
    CHECK (confidence_tier IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS expert_decision text DEFAULT 'pending'
    CHECK (expert_decision IN ('approved', 'rejected', 'pending')),
  ADD COLUMN IF NOT EXISTS expert_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS expert_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS expert_user_id uuid,
  ADD COLUMN IF NOT EXISTS prompt_version text DEFAULT 'v1.5';

-- 2. Vision analysis logs tablosu
CREATE TABLE IF NOT EXISTS public.vision_analysis_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  image_id text,
  method text NOT NULL,
  prompt_version text NOT NULL,
  model_name text,
  risks_detected int DEFAULT 0,
  risks_after_filter int DEFAULT 0,
  image_relevance text,
  status text CHECK (status IN ('success', 'no_risk', 'not_real_photo', 'error')),
  positive_observations_count int DEFAULT 0,
  person_count int DEFAULT 0,
  photo_quality text,
  tokens_input int,
  tokens_output int,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

-- Indeksler
CREATE INDEX IF NOT EXISTS idx_vision_logs_user ON public.vision_analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_vision_logs_version ON public.vision_analysis_logs(prompt_version);
CREATE INDEX IF NOT EXISTS idx_vision_logs_method ON public.vision_analysis_logs(method);
CREATE INDEX IF NOT EXISTS idx_vision_logs_created ON public.vision_analysis_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_vision_logs_status ON public.vision_analysis_logs(status);

-- RLS
ALTER TABLE public.vision_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.vision_analysis_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON public.vision_analysis_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
