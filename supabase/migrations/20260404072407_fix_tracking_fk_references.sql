
-- Fix FK references: organization_id should reference organizations, not auth.users
-- Also fix created_by to reference user_profiles instead of auth.users

-- company_trainings
ALTER TABLE public.company_trainings DROP CONSTRAINT IF EXISTS company_trainings_organization_id_fkey;
ALTER TABLE public.company_trainings DROP CONSTRAINT IF EXISTS company_trainings_created_by_fkey;

-- company_periodic_controls
ALTER TABLE public.company_periodic_controls DROP CONSTRAINT IF EXISTS company_periodic_controls_organization_id_fkey;
ALTER TABLE public.company_periodic_controls DROP CONSTRAINT IF EXISTS company_periodic_controls_created_by_fkey;

-- company_committee_meetings
ALTER TABLE public.company_committee_meetings DROP CONSTRAINT IF EXISTS company_committee_meetings_organization_id_fkey;
ALTER TABLE public.company_committee_meetings DROP CONSTRAINT IF EXISTS company_committee_meetings_created_by_fkey;
;
