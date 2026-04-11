
-- ============================================================
-- Drop old timesheet tables (v1) and recreate with new schema
-- ============================================================

-- Drop old tables (entries first due to FK)
DROP TABLE IF EXISTS public.timesheet_entries CASCADE;
DROP TABLE IF EXISTS public.timesheets CASCADE;

-- ============================================================
-- A) Timesheet settings — per-professional header/branding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timesheet_settings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id   uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  header_type       text        DEFAULT 'custom' CHECK (header_type IN ('custom','osgb','company','government')),
  header_logo_url   text,
  header_line1      text,
  header_line2      text,
  header_line3      text,
  professional_title text,
  certificate_no    text,
  footer_note       text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(user_profile_id)
);

ALTER TABLE public.timesheet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_settings_select" ON public.timesheet_settings
  FOR SELECT USING (
    user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "ts_settings_insert" ON public.timesheet_settings
  FOR INSERT WITH CHECK (
    user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "ts_settings_update" ON public.timesheet_settings
  FOR UPDATE USING (
    user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );

DROP TRIGGER IF EXISTS set_ts_settings_updated_at ON public.timesheet_settings;
CREATE TRIGGER set_ts_settings_updated_at
  BEFORE UPDATE ON public.timesheet_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ============================================================
-- B) Timesheets — one per professional per month (no company)
-- ============================================================
CREATE TABLE public.timesheets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  professional_id   uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  month             integer     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year              integer     NOT NULL,
  total_hours       numeric(6,2) DEFAULT 0,
  status            text        DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid')),
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(professional_id, month, year)
);

CREATE INDEX idx_timesheets_org ON public.timesheets(organization_id);
CREATE INDEX idx_timesheets_prof ON public.timesheets(professional_id);
CREATE INDEX idx_timesheets_period ON public.timesheets(year, month);

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
-- C) Timesheet entries — company + date + hours per day
-- ============================================================
CREATE TABLE public.timesheet_entries (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id         uuid        NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  company_workspace_id uuid        NOT NULL REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  entry_date           date        NOT NULL,
  hours                numeric(4,2) NOT NULL DEFAULT 8,
  task_id              uuid        REFERENCES public.isg_tasks(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(timesheet_id, company_workspace_id, entry_date)
);

CREATE INDEX idx_ts_entries_ts ON public.timesheet_entries(timesheet_id);
CREATE INDEX idx_ts_entries_date ON public.timesheet_entries(entry_date);
CREATE INDEX idx_ts_entries_company ON public.timesheet_entries(company_workspace_id);

ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_entries_select" ON public.timesheet_entries
  FOR SELECT USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets
      WHERE organization_id = current_organization_id()
         OR professional_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    )
  );
CREATE POLICY "ts_entries_insert" ON public.timesheet_entries
  FOR INSERT WITH CHECK (
    timesheet_id IN (SELECT id FROM public.timesheets WHERE organization_id = current_organization_id())
  );
CREATE POLICY "ts_entries_update" ON public.timesheet_entries
  FOR UPDATE USING (
    timesheet_id IN (SELECT id FROM public.timesheets WHERE organization_id = current_organization_id())
  );
CREATE POLICY "ts_entries_delete" ON public.timesheet_entries
  FOR DELETE USING (
    timesheet_id IN (SELECT id FROM public.timesheets WHERE organization_id = current_organization_id())
  );
;
