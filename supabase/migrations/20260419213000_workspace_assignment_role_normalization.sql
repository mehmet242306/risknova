-- =============================================================================
-- Workspace assignment role normalization
-- =============================================================================
-- Purpose:
-- - Normalize legacy workspace assignment role values to the simplified
--   professional role vocabulary.
-- - Keep customer-facing account types limited to: individual, osgb, enterprise.
-- - Keep public institution users inside the existing account model instead of
--   introducing a special customer account type.
-- - Keep Turkish OHS specialist A/B/C distinctions in the certification layer,
--   not in account_type or workspace_assignments.professional_role.
-- =============================================================================

begin;

update public.workspace_assignments
   set professional_role = 'operasyon_sorumlusu'
 where professional_role in ('danisman', 'kamu_uzmani');

alter table if exists public.workspace_assignments
  drop constraint if exists workspace_assignments_professional_role_check;

alter table if exists public.workspace_assignments
  add constraint workspace_assignments_professional_role_check
  check (
    professional_role in (
      'isg_uzmani',
      'isyeri_hekimi',
      'diger_saglik_personeli',
      'operasyon_sorumlusu',
      'viewer'
    )
  );

comment on table public.workspace_assignments is
  'Assigns account members to firm workspaces. professional_role is an operational duty label and must remain separate from customer-facing account_type.';

commit;
