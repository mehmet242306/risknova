-- Risk assessment findings: tracking status and notes for process management
ALTER TABLE public.risk_assessment_findings
  ADD COLUMN IF NOT EXISTS tracking_status text NOT NULL DEFAULT 'open'
    CHECK (tracking_status IN ('open', 'in_progress', 'resolved', 'archived')),
  ADD COLUMN IF NOT EXISTS tracking_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;
