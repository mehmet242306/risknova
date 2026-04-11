
-- Fix timesheets RLS: use user_profiles lookup instead of JWT-only current_organization_id()
DROP POLICY IF EXISTS "timesheets_insert" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_update" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_delete" ON public.timesheets;
DROP POLICY IF EXISTS "timesheets_select" ON public.timesheets;

CREATE POLICY "timesheets_select" ON public.timesheets
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
    OR professional_id IN (
      SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "timesheets_insert" ON public.timesheets
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "timesheets_update" ON public.timesheets
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "timesheets_delete" ON public.timesheets
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

-- Fix timesheet_entries RLS
DROP POLICY IF EXISTS "ts_entries_select" ON public.timesheet_entries;
DROP POLICY IF EXISTS "ts_entries_insert" ON public.timesheet_entries;
DROP POLICY IF EXISTS "ts_entries_update" ON public.timesheet_entries;
DROP POLICY IF EXISTS "ts_entries_delete" ON public.timesheet_entries;

CREATE POLICY "ts_entries_select" ON public.timesheet_entries
  FOR SELECT USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "ts_entries_insert" ON public.timesheet_entries
  FOR INSERT WITH CHECK (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "ts_entries_update" ON public.timesheet_entries
  FOR UPDATE USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "ts_entries_delete" ON public.timesheet_entries
  FOR DELETE USING (
    timesheet_id IN (
      SELECT id FROM public.timesheets WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Fix timesheet_settings RLS (already uses user_profiles but let's ensure)
DROP POLICY IF EXISTS "ts_settings_select" ON public.timesheet_settings;
DROP POLICY IF EXISTS "ts_settings_insert" ON public.timesheet_settings;
DROP POLICY IF EXISTS "ts_settings_update" ON public.timesheet_settings;

CREATE POLICY "ts_settings_select" ON public.timesheet_settings
  FOR SELECT USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "ts_settings_insert" ON public.timesheet_settings
  FOR INSERT WITH CHECK (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "ts_settings_update" ON public.timesheet_settings
  FOR UPDATE USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  );
;
