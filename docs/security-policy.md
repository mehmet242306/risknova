# Security Policy - RiskNova

## Current Security Model

Current application architecture:

- Primary application auth: Auth.js
- Database platform: Supabase Postgres
- Current database protection model: Row Level Security (RLS) foundation on public tables
- Current application isolation model: organization-scoped access at application/service layer

---

## 1. Organization Isolation Rule

Core rule:

- There must be no organization-scoped business data without `organization_id`.

This applies to current and future business tables such as:

- locations
- employees
- hazards
- findings
- reports
- generated_documents
- notifications
- training_records
- health_documents

If a record belongs to an organization, it must contain `organization_id`.

---

## 2. Current Access Model

At the current phase:

- Auth.js is the primary auth source
- application routes and backend services must enforce organization scoping
- Supabase RLS is enabled as a second-layer database protection model
- Supabase `secret` key is backend-only
- publishable key is client-safe, but client access must still respect RLS

---

## 3. Current Access Rules

### user_profiles
- a user can read only their own profile
- a user can update only their own profile unless later expanded by admin rules

### organizations
- a user can read only the organization they belong to

### audit_logs
- a user can read only audit logs that belong to their organization

### roles
- authenticated users may read role definitions

### user_roles
- a user may read only their own assigned roles

---

## 4. JWT / Claims Plan

### Current phase
Auth.js session should carry:
- user id
- role
- organization_id

Application services should derive the tenant scope from the authenticated session and apply organization filtering explicitly.

### Future phase
If the product moves to Supabase-native auth:

- `organization_id` should be added to JWT claims
- role data may also be added as claims where appropriate
- Supabase RLS policies should read claim values via `auth.jwt()`

---

## 5. RLS Strategy

RLS is enabled on public application tables.

Policy direction:

- `organizations` -> organization scoped
- `user_profiles` -> self scoped
- `audit_logs` -> organization scoped
- `user_roles` -> self scoped
- `roles` -> authenticated read

Important:
- RLS policies are not a substitute for good application-layer access control
- backend services must still enforce tenant scope
- service-level secrets must never be exposed to the browser

---

## 6. Backend Rule

Any backend query that targets organization-scoped data must include organization scoping.

Examples:
- select ... where organization_id = current user's organization_id
- update ... where organization_id = current user's organization_id
- delete ... where organization_id = current user's organization_id

This rule remains valid even when RLS exists.

---

## 7. Secrets Rule

Must never be committed:
- frontend/.env.local
- backend/.env
- Supabase secret key
- database password
- any raw tokens

---

## 8. Migration Rule

Security changes must be versioned.

This includes:
- new RLS policies
- changes to access rules
- schema changes affecting tenant isolation
- helper SQL functions related to claims or auth context

Dashboard-only security changes should be avoided unless they are later reflected in migrations.

---

## 9. Validation Target

The security target is:

- two users from different organizations cannot read each other's organization data
- users can read only their own profile
- audit logs stay within organization scope

At the current phase, this is enforced primarily by application logic plus RLS foundation.