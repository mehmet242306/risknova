
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'TR',
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'TR';
;
