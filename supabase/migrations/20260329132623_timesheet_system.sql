
-- ============================================================
-- A) Add timesheet fields to isg_tasks
-- ============================================================
ALTER TABLE public.isg_tasks
ADD COLUMN IF NOT EXISTS include_in_timesheet boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS timesheet_hours numeric(4,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) DEFAULT NULL;

-- ============================================================
-- B) Timesheets — monthly summary per professional per company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timesheets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id      uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_workspace_id uuid        REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  month                integer     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                 integer     NOT NULL,
  total_days           integer     DEFAULT 0,
  total_hours          numeric(6,2) DEFAULT 0,
  total_amount         numeric(12,2) DEFAULT 0,
  status               text        DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid')),
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE(professional_id, company_workspace_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_org ON public.timesheets(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_prof ON public.timesheets(professional_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_period ON public.timesheets(year, month);

DROP TRIGGER IF EXISTS set_timesheets_updated_at ON public.timesheets;
CREATE TRIGGER set_timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON public.timesheets
  FOR SELECT USING (
    organization_id = current_organization_id()
    OR professional_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "timesheets_insert" ON public.timesheets
  FOR INSERT WITH CHECK (organization_id = current_organization_id());
CREATE POLICY "timesheets_update" ON public.timesheets
  FOR UPDATE USING (organization_id = current_organization_id());
CREATE POLICY "timesheets_delete" ON public.timesheets
  FOR DELETE USING (organization_id = current_organization_id());

-- ============================================================
-- C) Timesheet entries — individual day/task rows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id  uuid        NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  task_id       uuid        REFERENCES public.isg_tasks(id) ON DELETE SET NULL,
  entry_date    date        NOT NULL,
  description   text,
  hours         numeric(4,2) NOT NULL DEFAULT 0,
  rate          numeric(10,2),
  amount        numeric(10,2),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_ts ON public.timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON public.timesheet_entries(entry_date);

ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheet_entries_select" ON public.timesheet_entries
  FOR SELECT USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets
      WHERE organization_id = current_organization_id()
         OR professional_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    )
  );
CREATE POLICY "timesheet_entries_insert" ON public.timesheet_entries
  FOR INSERT WITH CHECK (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id = current_organization_id()
    )
  );
CREATE POLICY "timesheet_entries_update" ON public.timesheet_entries
  FOR UPDATE USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id = current_organization_id()
    )
  );
CREATE POLICY "timesheet_entries_delete" ON public.timesheet_entries
  FOR DELETE USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id = current_organization_id()
    )
  );
;
