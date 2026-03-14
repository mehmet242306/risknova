# Database Schema - RiskNova

## Purpose

This document defines the conceptual database foundation for RiskNova.

Current decisions:

- Primary app auth strategy: Auth.js
- Infrastructure target: Supabase project + Postgres
- Future option: Supabase Auth integration if needed
- Organizational model: organization-centered multi-tenant structure

---

## 1. Organization

Represents a company, OSGB, institution, or customer account in the system.

### Core fields

- id (uuid, primary key)
- name (text)
- slug (text, unique)
- organization_type (text)
- tax_number (text, optional)
- country (text)
- city (text, optional)
- address (text, optional)
- phone (text, optional)
- email (text, optional)
- is_active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)

### Notes

- Top-level tenant entity
- Most business tables should include organization_id
- One organization can have many users, audits, findings, reports, and documents

---

## 2. UserProfile

Application-level user profile linked to authentication identity.

### Core fields

- id (uuid, primary key)
- auth_user_id (uuid/text, external auth identity reference)
- organization_id (uuid, FK -> Organization.id)
- email (text)
- full_name (text)
- title (text)
- phone (text, optional)
- avatar_url (text, optional)
- is_active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)

### Notes

- Stores app profile data, not credential data
- If Supabase Auth is adopted later, auth_user_id maps to the Auth user id
- If Auth.js remains primary, auth_user_id remains the stable auth identity reference
- First version: one user profile belongs to one organization

---

## 3. Role

Basic authorization model.

### Core fields

- id (uuid, primary key)
- code (text, unique)
- name (text)
- description (text, optional)
- created_at (timestamptz)

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

- id (uuid, primary key)
- user_profile_id (uuid, FK -> UserProfile.id)
- role_id (uuid, FK -> Role.id)
- assigned_at (timestamptz)
- assigned_by (uuid, optional FK -> UserProfile.id)

### Notes

- Supports multiple roles per user if needed
- Can later be simplified into a single role field if desired

---

## 5. AuditLog

Tracks important application actions.

### Core fields

- id (uuid, primary key)
- organization_id (uuid, FK -> Organization.id)
- actor_user_profile_id (uuid, FK -> UserProfile.id, nullable)
- action_type (text)
- entity_type (text)
- entity_id (text)
- severity (text)
- metadata_json (jsonb)
- ip_address (text, optional)
- user_agent (text, optional)
- created_at (timestamptz)

### Notes

- Schema-level only for now
- Append-only in production design

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

- App authentication flow remains Auth.js for now
- Supabase is introduced first as hosted Postgres infrastructure
- Supabase Auth may be adopted later if the product moves fully into Supabase-native auth and RLS patterns

---

## 9. Future Tables (Not in this phase)

These are expected later and should reference organization_id:

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
