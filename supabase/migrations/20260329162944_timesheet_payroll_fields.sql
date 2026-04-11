
ALTER TABLE public.timesheet_settings
ADD COLUMN IF NOT EXISTS salary_coefficient numeric(10,6) DEFAULT 0.013304,
ADD COLUMN IF NOT EXISTS base_indicator integer DEFAULT 200,
ADD COLUMN IF NOT EXISTS stamp_tax_rate numeric(6,5) DEFAULT 0.00759,
ADD COLUMN IF NOT EXISTS is_government_employee boolean DEFAULT false;
;
