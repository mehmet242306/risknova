
ALTER TABLE public.company_workspaces
  ADD COLUMN IF NOT EXISTS logo_url text;
;
