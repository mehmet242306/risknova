-- ============================================================
-- Migration: 20260411174500_fix_organization_foreign_keys
-- ============================================================
-- Correct organization_id foreign keys that were mistakenly
-- pointed at auth.users(id) instead of public.organizations(id).
-- ============================================================

alter table public.company_trainings
  drop constraint if exists company_trainings_organization_id_fkey,
  add constraint company_trainings_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;

alter table public.company_periodic_controls
  drop constraint if exists company_periodic_controls_organization_id_fkey,
  add constraint company_periodic_controls_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;

alter table public.company_committee_meetings
  drop constraint if exists company_committee_meetings_organization_id_fkey,
  add constraint company_committee_meetings_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;
