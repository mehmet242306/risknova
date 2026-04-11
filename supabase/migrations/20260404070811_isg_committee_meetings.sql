
-- İSG Kurul Toplantıları ve Kararları
CREATE TABLE IF NOT EXISTS public.company_committee_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id),
  company_workspace_id uuid NOT NULL,
  meeting_date date NOT NULL,
  meeting_number integer DEFAULT 1,
  attendees text DEFAULT '',
  agenda text DEFAULT '',
  decisions jsonb DEFAULT '[]',
  next_meeting_date date,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_committee_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.company_committee_meetings FOR ALL USING (organization_id = auth.uid());
;
