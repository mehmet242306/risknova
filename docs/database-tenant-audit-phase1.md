# Database Tenant Audit Phase 1

Date: 2026-04-11

## Goal

Phase 1 starts closing Section `1.1 Multi-tenancy` and `1.4 Required Columns` without breaking the current app flow.

## Canonical Rules

- Global tables stay global: `organizations`, `roles`, `user_profiles`, `user_roles`.
- Organization-scoped tables may keep `organization_id`.
- Workspace-scoped business tables should converge on `company_workspace_id`.
- Legacy compatibility columns such as `company_identity_id` remain during transition.
- Mutable business tables should expose a standard audit set:
  - `created_at`
  - `updated_at`
  - `created_by`
  - `updated_by`

## Current Findings

- RLS is enabled for all public tables, but tenant keys are mixed between:
  - `organization_id`
  - `company_workspace_id`
  - `company_identity_id`
  - `company_id` pointing to `company_workspaces`
- Local schema has 51 public tables, but only 10 currently expose `company_workspace_id`.
- 45 public tables still miss at least one of `updated_at`, `created_by`, `updated_by`.
- `audit_logs` exists, but it is not yet the target forensic schema and is written manually from backend code rather than database triggers.

## Phase 1 Scope

This migration updates child tables whose workspace can be derived from an existing parent relation:

- `incident_witnesses`
- `incident_personnel`
- `incident_dof`
- `incident_ishikawa`
- `risk_assessment_rows`
- `risk_assessment_images`
- `risk_assessment_findings`
- `risk_assessment_items`
- `company_training_attendees`
- `personnel_special_policies`
- `personnel_trainings`
- `personnel_health_exams`
- `personnel_ppe_records`
- `personnel_documents`

## What Phase 1 Adds

- `company_workspace_id` to the tables above.
- Missing standard audit columns where safe to derive without app rewrites.
- Backfill from parent tables:
  - `incidents`
  - `risk_assessments`
  - `company_trainings`
  - `personnel`
- Trigger-based synchronization for future inserts and updates.
- Workspace indexes for the new tenant key.

## Explicitly Deferred

- Full soft delete rollout.
- Full audit trigger system with `old_values` / `new_values`.
- Converting all `company_identity_id` filters in app code.
- Renaming `scan_*`.`company_id` to `company_workspace_id`.
- Admin audit dashboard.
- Final cleanup of old tenant keys after app code is migrated.

## Next Recommended Phase

Phase 2 should handle direct business tables still relying mostly on `organization_id` or `company_identity_id`, especially:

- `company_personnel`
- `company_trainings`
- `company_periodic_controls`
- `document_templates`
- `editor_documents`
- `scan_sessions`
- `scan_detections`
- `digital_twin_points`
- `digital_twin_models`
