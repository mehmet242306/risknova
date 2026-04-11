-- Firma bazlı eğitim kayıtları (grup eğitim)
CREATE TABLE IF NOT EXISTS public.company_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id),
  company_workspace_id uuid NOT NULL,
  title text NOT NULL,
  training_type text NOT NULL DEFAULT 'zorunlu' CHECK (training_type IN ('zorunlu', 'istege_bagli', 'yenileme')),
  trainer_name text DEFAULT '',
  training_date date,
  duration_hours numeric(4,1) DEFAULT 0,
  location text DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.company_trainings FOR ALL USING (organization_id = auth.uid());
-- Eğitim katılımcıları
CREATE TABLE IF NOT EXISTS public.company_training_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.company_trainings(id) ON DELETE CASCADE,
  personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  personnel_name text DEFAULT '',
  attendance_status text NOT NULL DEFAULT 'attended' CHECK (attendance_status IN ('attended', 'absent', 'excused')),
  certificate_date date,
  certificate_expiry date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_training_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.company_training_attendees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_trainings t WHERE t.id = training_id AND t.organization_id = auth.uid()));
-- Periyodik kontroller
CREATE TABLE IF NOT EXISTS public.company_periodic_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id),
  company_workspace_id uuid NOT NULL,
  title text NOT NULL,
  control_type text NOT NULL DEFAULT 'diger' CHECK (control_type IN ('elektrik', 'asansor', 'yangin', 'basinc', 'vinc', 'kompressor', 'forklift', 'diger')),
  inspector_name text DEFAULT '',
  inspection_date date,
  next_inspection_date date,
  result text DEFAULT 'uygun' CHECK (result IN ('uygun', 'uygun_degil', 'sartli_uygun')),
  report_reference text DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'overdue')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_periodic_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.company_periodic_controls FOR ALL USING (organization_id = auth.uid());
