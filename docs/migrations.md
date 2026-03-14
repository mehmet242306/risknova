# Migration Rules - RiskNova

## Single Source of Truth

Database schema changes are managed only through Supabase SQL migrations.

Primary rule:
- `supabase/migrations` is the only migration source of truth.

Not allowed:
- Manual schema edits in production
- Manual table creation from dashboard for permanent schema changes
- Parallel migration ownership by Prisma Migrate or Alembic

---

## Workflow

1. Create a new migration file
2. Write SQL changes into the migration
3. Review the SQL carefully
4. Apply migrations in a controlled way
5. Commit the migration file to Git
6. Push to remote repository

---

## Rules

- Never edit an already-applied migration in shared environments
- Create a new migration for every schema change
- Keep schema changes small and focused
- Include indexes, constraints, and foreign keys in the same migration where possible
- Keep destructive operations explicit and reviewed
- Keep application docs in sync with schema changes

---

## Auth Reference Rule

If application profile data needs to connect to authentication users:

- use `auth.users(id)` as the reference target
- use foreign keys carefully
- prefer nullable auth linkage during transition periods
- avoid depending on internal auth tables beyond supported references

---

## RLS Rule

Any table in the public schema should have Row Level Security enabled.

Policy creation may be done in:
- the same migration, or
- the next dedicated security migration

But RLS must not be forgotten.

---

## Deployment Rule

Remote schema updates are applied through Supabase CLI migrations.

Typical commands:
- `supabase migration new <name>`
- `supabase link --project-ref <project_ref>`
- `supabase db push`

---

## Git Rule

The following must be committed:
- `supabase/migrations/*`
- `docs/database-schema.md`
- `docs/migrations.md`

The following must not be committed:
- real `.env` files
- secrets
- local machine artifacts

