-- =============================================================================
-- Business tables: tighten organization_id to NOT NULL (Aşama 1a)
-- =============================================================================
-- 15 business tables previously allowed nullable organization_id even though
-- every real-world row must belong to an organization. Verified zero NULL
-- rows across all 15 tables before applying — no backfill needed.
--
-- Out of scope (Kategori C — intentionally remain nullable as global lookups
-- or system-level records):
--   - isg_task_categories, risk_categories, team_categories
--     -> global İSG/HSE category templates shared across orgs
--   - slide_decks
--     -> intentional per 20260410172612_slide_decks_nullable_org_for_system
--   - task_queue
--     -> platform-level system jobs
--   - solution_queries
--     -> may include guest/public Nova chat queries; decision deferred
-- =============================================================================

begin;

alter table public.isg_tasks             alter column organization_id set not null;
alter table public.scan_sessions         alter column organization_id set not null;
alter table public.incident_personnel    alter column organization_id set not null;
alter table public.incident_witnesses    alter column organization_id set not null;
alter table public.digital_twin_points   alter column organization_id set not null;
alter table public.digital_twin_models   alter column organization_id set not null;
alter table public.surveys               alter column organization_id set not null;
alter table public.user_subscriptions    alter column organization_id set not null;
alter table public.breach_incidents      alter column organization_id set not null;
alter table public.certificates          alter column organization_id set not null;
alter table public.certificate_templates alter column organization_id set not null;
alter table public.scan_detections       alter column organization_id set not null;
alter table public.scan_frames           alter column organization_id set not null;
alter table public.slide_deck_sessions   alter column organization_id set not null;
alter table public.user_consents         alter column organization_id set not null;

commit;
