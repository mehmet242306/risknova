-- ============================================================
-- Migration: 20260411172000_performance_index_backfill
-- ============================================================
-- Section 1.6 completion:
-- Backfill missing indexes for created_at, status,
-- organization_id and company_workspace_id across public tables.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.column_name = 'created_at'
  loop
    execute format(
      'create index if not exists %I on public.%I(created_at desc)',
      'idx_' || r.table_name || '_created_at',
      r.table_name
    );
  end loop;

  for r in
    select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.column_name = 'status'
  loop
    execute format(
      'create index if not exists %I on public.%I(status)',
      'idx_' || r.table_name || '_status',
      r.table_name
    );
  end loop;

  for r in
    select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.column_name = 'organization_id'
  loop
    execute format(
      'create index if not exists %I on public.%I(organization_id)',
      'idx_' || r.table_name || '_organization_id',
      r.table_name
    );
  end loop;

  for r in
    select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.column_name = 'company_workspace_id'
  loop
    execute format(
      'create index if not exists %I on public.%I(company_workspace_id)',
      'idx_' || r.table_name || '_company_workspace_id',
      r.table_name
    );
  end loop;
end $$;
