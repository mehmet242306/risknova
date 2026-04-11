# Database Hardening Section 1 Closeout

Date: 2026-04-11

This closeout summarizes the Section 1 hardening work applied to the local Supabase database for `risknova-platform`.

## Completed

- Multi-tenancy foundation strengthened in four phases.
- Standard table columns normalized across public tables:
  - `id uuid primary key default gen_random_uuid()`
  - `created_at`
  - `updated_at`
  - `created_by`
  - `updated_by`
  - `deleted_at`
- `company_workspace_id` coverage expanded on tenant-scoped business tables and secured with workspace-based RLS.
- `audit_logs` expanded to include:
  - `tenant_id`
  - `user_id`
  - `action`
  - `old_values`
  - `new_values`
- Automatic DB audit triggers added on critical tables:
  - `risk_assessments`
  - `user_profiles`
  - `company_trainings`
  - `company_periodic_controls`
  - `editor_documents`
  - `incidents`
  - `slide_decks`
- Search RPC added:
  - `public.search_audit_logs(...)`
- Soft delete foundation added:
  - `deleted_at` present on all public tables
  - `before delete` soft-delete triggers on core business tables
  - restrictive `deleted_at is null` read policies on the protected core set
- Deleted record admin RPCs added:
  - `public.list_deleted_records(...)`
  - `public.restore_deleted_record(...)`
- Performance index backfill applied for:
  - `created_at`
  - `status`
  - `organization_id`
  - `company_workspace_id`
- Incorrect `organization_id` foreign keys corrected on:
  - `company_trainings`
  - `company_periodic_controls`
  - `company_committee_meetings`

## UI Work

- Settings admin area now includes:
  - `Audit Loglari`
  - `Silinmis Kayitlar`
- These tabs are backed by the new RPC functions above.

## Backend Alignment

- Manual audit inserts for `risk_assessments` and `user_profiles` API flows were removed to avoid duplicate records after DB trigger rollout.
- Backend manual audit helper now writes the extended audit columns when used elsewhere.

## Verification

Local DB verification after migrations:

- Tables missing `created_at`: `0`
- Tables missing one of `updated_at`, `created_by`, `updated_by`: `0`
- Tables missing `deleted_at`: `0`
- Tables with missing `status` index: `0`
- Tables with missing `created_at` index: `0`
- Tables with missing `organization_id` index: `0`
- Tables with missing `company_workspace_id` index: `0`

Frontend verification:

- `eslint` passed for:
  - `frontend/src/app/(protected)/settings/page.tsx`
  - `frontend/src/app/(protected)/settings/AuditLogsTab.tsx`
  - `frontend/src/app/(protected)/settings/DeletedRecordsTab.tsx`

Backend verification:

- `python -m py_compile` passed for:
  - `backend/api/audit.py`
  - `backend/api/v1/endpoints/profile_actions.py`
  - `backend/api/v1/endpoints/risk_assessments.py`

## Local Apply Note

Phase 3 and Phase 4 were applied directly to the local Supabase Postgres container with `psql`. This was done because historical Supabase migration metadata drift still makes CLI history unreliable for some older files.
