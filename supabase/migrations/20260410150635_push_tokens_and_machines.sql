
-- Push notification tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  device_type text,
  device_info jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Machines registry (QR scan lookup)
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  machine_code text NOT NULL,
  qr_code text UNIQUE,
  name text NOT NULL,
  category text,
  manufacturer text,
  model text,
  serial_number text,
  installation_date date,
  last_maintenance_date date,
  next_maintenance_date date,
  location text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access machines via company" ON public.machines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.company_workspaces cw 
            WHERE cw.id = machines.company_id 
            AND cw.organization_id = current_user_organization_id())
  );

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_machines_qr ON public.machines(qr_code);
CREATE INDEX IF NOT EXISTS idx_machines_company ON public.machines(company_id);
;
