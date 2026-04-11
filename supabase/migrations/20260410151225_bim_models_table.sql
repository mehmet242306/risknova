
CREATE TABLE IF NOT EXISTS public.bim_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_size bigint,
  ifc_schema text,
  metadata jsonb DEFAULT '{}',
  thumbnail_url text,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE public.bim_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access bim_models via company" ON public.bim_models
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.company_workspaces cw WHERE cw.id = bim_models.company_id AND cw.organization_id = current_user_organization_id())
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bim-models', 'bim-models', false, 104857600, ARRAY['application/octet-stream', 'model/ifc', 'application/x-step'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload BIM models" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bim-models');

CREATE POLICY "Authenticated users can read BIM models" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'bim-models');

CREATE INDEX IF NOT EXISTS idx_bim_models_company ON public.bim_models(company_id);
;
