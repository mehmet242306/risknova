# RiskNova AI — Project Principles (Source of Truth)

## Goal
Build an enterprise-grade, modular, scalable OHS (İSG) management SaaS platform.

## Architecture
- Frontend: Next.js (mobile-first, responsive)
- DB/Auth: Supabase (PostgreSQL + Auth + RLS)
- Backend services: FastAPI/Python (R-SKOR & AI services)

## Multi-tenant
- All data must be scoped by `organization_id`.
- Use Supabase RLS + API-level scope enforcement (do not rely on frontend checks).

## Mobile-first & Responsive
- UI must be mobile-first and fully responsive (phone/tablet/desktop).
- Web UX should be designed to be compatible with future mobile apps (React Native/Flutter).

## UI/UX
- Simple, fast, corporate look & feel.
- Dashboard-first information architecture.
- Accessibility (a11y) is required.

## Security
- RLS + API scope enforcement
- Basic rate limiting for cost-heavy endpoints (AI, PDF)
- Audit logging for critical actions

## Code Discipline
- Clean folder structure
- Standard API response format
- API versioning under `/api/v1`
- CI/lint is mandatory; main must not accept broken builds

## Delivery Strategy
- Build solid Core Engine first
- Then Risk MVP
- Then Incident / Document / Regulation modules
- Keep the product modular and extensible
