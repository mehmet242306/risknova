# Database Schema - RiskNova

## Purpose

This document defines the conceptual database foundation for RiskNova.
At this stage:

- Primary app auth strategy: Auth.js
- Infrastructure target: Supabase project + Postgres
- Future option: Supabase Auth integration if needed
- Organizational model: organization-centered multi-tenant structure

---

## 1. Organization

Represents a company, OSGB, institution, or customer account in the system.

### Core fields

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Organization display name |
| slug | text | Unique short identifier |
| organization_type | text | Example: osgb, employer, public_institution |
| tax_number | text | Optional |
| country | text | Default TR for now |
| city | text | Optional |
| address | text | Optional |
| phone | text | Optional |
| email | text | Optional |
| is_active | boolean | Soft active status |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Record update time |

### Notes

- This is the top-level tenant entity.
- Most business tables should eventually include `organization_id`.
- One organization can have many users, audits, findings, reports, and documents.

---

## 2. UserProfile

Application-level user profile linked to authentication identity.

### Core fields

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| auth_user_id | uuid/text | External auth identity reference |
| organization_id | uuid | FK -> Organization.id |
| email | text | Cached convenience field |
| full_name | text | Display name |
| title | text | Example: OHS Specialist, Physician, DSP |
| phone | text | Optional |
| avatar_url | text | Optional |
| is_active | boolean | Soft active status |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Record update time |

### Notes

- This table stores app profile data, not credential data.
- If Supabase Auth is adopted later, `auth_user_id` should map to the Auth user id.
- If Auth.js remains primary, `auth_user_id` still remains the stable auth identity reference.
- A user profile belongs to one organization in the first version.

---

## 3. Role

Basic authorization model.

### Core fields

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| code | text | Unique code |
| name | text | Human-readable role name |
| description | text | Optional |
| created_at | timestamptz | Record creation time |

### Suggested starter roles

- super_admin
- platform_admin
- organization_admin
- osgb_manager
- ohs_specialist
- workplace_physician
- dsp
- viewer

---

## 4. UserRole

Join table for assigning roles to users.

### Core fields

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_profile_id | uuid | FK -> UserProfile.id |
| role_id | uuid | FK -> Role.id |
| assigned_at | timestamptz | Assignment timestamp |
| assigned_by | uuid | Optional FK -> UserProfile.id |

### Notes

- First version can support multiple roles per user if needed.
- If simplicity is preferred, this can later be collapsed into a single role field on UserProfile.
- Join table is more flexible for enterprise expansion.

---

## 5. AuditLog

Tracks important application actions.

### Core fields

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| organization_id | uuid | FK -> Organization.id |
| actor_user_profile_id | uuid | FK -> UserProfile.id, nullable |
| action_type | text | Example: user.created, report.generated |
| entity_type | text | Example: organization, report, finding |
| entity_id | text | ID of affected record |
| severity | text | info, warning, critical |
| metadata_json | jsonb | Extra details |
| ip_address | text | Optional |
| user_agent | text | Optional |
| created_at | timestamptz | Event time |

### Notes

- This is intentionally schema-level only for now.
- AuditLog should be append-only in production design.

---

## 6. Relationships Summary

- Organization 1 --- N UserProfile
- UserProfile N --- N Role (via UserRole)
- Organization 1 --- N AuditLog
- UserProfile 1 --- N AuditLog (actor side, optional)

---

## 7. Design Decisions

### Why organization-first?
RiskNova targets OSGB and institutional usage.
So every major operational entity should be tied to an organization boundary.

### Why separate UserProfile from authentication?
Authentication identity can change implementation details over time.
Application profile and organizational membership should remain stable.

### Why keep Role basic at first?
The first release should not overcomplicate permissions.
A small role model is enough to start, and can later evolve into permission-based access.

---

## 8. Auth and Supabase Decision

Current decision:

- App authentication flow remains Auth.js for now.
- Supabase is introduced first as hosted Postgres infrastructure.
- Supabase Auth may be adopted later if the product moves fully into Supabase-native auth and RLS patterns.

---

## 9. Future Tables (Not in this phase)

These are expected later and should reference `organization_id`:

- Company / Workplace
- Location / Branch
- Employee
- Hazard
- RiskAssessment
- Finding
- ActionPlan
- TrainingRecord
- HealthDocument
- EmergencyPlan
- Notification
- GeneratedDocument
- FileAsset

