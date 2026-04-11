
-- Fix RLS policies for tracking tables to match existing pattern (current_organization_id + user_profiles fallback)

-- company_trainings
DROP POLICY IF EXISTS "org_access" ON public.company_trainings;
CREATE POLICY "trainings_select" ON public.company_trainings FOR SELECT
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "trainings_insert" ON public.company_trainings FOR INSERT WITH CHECK (true);
CREATE POLICY "trainings_update" ON public.company_trainings FOR UPDATE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "trainings_delete" ON public.company_trainings FOR DELETE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));

-- company_training_attendees
DROP POLICY IF EXISTS "org_access" ON public.company_training_attendees;
CREATE POLICY "attendees_select" ON public.company_training_attendees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_trainings t WHERE t.id = training_id AND (
    t.organization_id = current_organization_id() OR t.organization_id IN (
      SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
    )
  )));
CREATE POLICY "attendees_insert" ON public.company_training_attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "attendees_delete" ON public.company_training_attendees FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_trainings t WHERE t.id = training_id AND (
    t.organization_id = current_organization_id() OR t.organization_id IN (
      SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
    )
  )));

-- company_periodic_controls
DROP POLICY IF EXISTS "org_access" ON public.company_periodic_controls;
CREATE POLICY "controls_select" ON public.company_periodic_controls FOR SELECT
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "controls_insert" ON public.company_periodic_controls FOR INSERT WITH CHECK (true);
CREATE POLICY "controls_update" ON public.company_periodic_controls FOR UPDATE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "controls_delete" ON public.company_periodic_controls FOR DELETE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));

-- company_committee_meetings
DROP POLICY IF EXISTS "org_access" ON public.company_committee_meetings;
CREATE POLICY "meetings_select" ON public.company_committee_meetings FOR SELECT
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "meetings_insert" ON public.company_committee_meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "meetings_update" ON public.company_committee_meetings FOR UPDATE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
CREATE POLICY "meetings_delete" ON public.company_committee_meetings FOR DELETE
  USING (organization_id = current_organization_id() OR organization_id IN (
    SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL LIMIT 1
  ));
;
