# Section 3 KVKK Closeout

This note summarizes the current delivery state for Section 3 - KVKK Compliance Layer.

## Status

Section 3 is substantially implemented on the web, backend, database, and admin-panel side.

Section 3 is **not fully complete** because the mobile device-side masking requirement is not yet implemented in a mobile application codebase.

## Completed

### 3.1 Consent management

- Added consent document and consent version model
- Added `user_consents`
- Stored consent version, grant/revoke timestamps, IP, and user agent context
- Designed re-consent behavior for updated document versions

### 3.2 Disclosure text and consent flow

- Added mandatory consent gate for web flows
- Added admin-side consent document and version management
- Added user-facing privacy and consent panel
- Added groundwork for contextual reminders in sensitive flows

### 3.4 Right to erasure

- Added deletion request model
- Added user-side deletion request flow
- Added admin-side deletion request visibility
- Added audit/security logging hooks
- Added scheduled purge support through retention execution flow

### 3.5 Data portability

- Added JSON / CSV export flow foundations
- Added user-side export request and download flow
- Added admin-side visibility for export records

### 3.6 Data processing inventory

- Added `data_processing_inventory`
- Added admin management UI for processing purposes, legal basis, retention summary, access roles, and transfer flags

### 3.7 Retention policy automation

- Added `retention_policies`
- Added `retention_executions`
- Added `run_retention_policies()`
- Added KVKK retention workflow support

### 3.8 International transfer records

- Added `international_transfers`
- Added transfer logging RPCs
- Added admin visibility for external transfer audit records

### 3.9 Data breach response plan

- Added `breach_incidents`
- Added breach notification template structure
- Added admin-side breach planning and incident interface

## Partially completed

### 3.3 Device-side face / identity masking

Implemented in this repository:

- `masking_events`
- transfer and masking log schema
- RPC contracts for masking and international transfer logging
- mobile integration contract note:
  `docs/kvkk-phase3-mobile-contract.md`

Not yet implemented in this repository:

- real mobile `react-native-vision-camera` frame processor
- MediaPipe or equivalent on-device face / plate / ID detection
- on-device Gaussian blur before upload
- guaranteed discard of original unmasked frame on device

This part must be completed in the mobile application repository.

## Key migrations

- `20260412200000_kvkk_phase1_consents_inventory.sql`
- `20260412213000_kvkk_phase2_data_rights_retention.sql`
- `20260412223000_kvkk_phase3_transfer_breach_masking.sql`
- `20260412233000_fix_kvkk_retention_runtime.sql`

## Operational note

For new KVKK migrations:

1. Run `Database Migrate`
2. Then run `Database Security`
3. If needed, run `KVKK Retention`

This order avoids false failures caused by committed migrations not yet being applied to the remote database.
