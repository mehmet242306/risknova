create table if not exists public.nova_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  snapshot_scope text not null check (snapshot_scope in ('user', 'company', 'operations')),
  snapshot_key text not null,
  title text not null,
  summary_text text not null,
  structured_snapshot jsonb not null default '{}'::jsonb,
  language text not null default 'tr' check (language in ('tr', 'en', 'ar', 'ru', 'de', 'fr', 'es', 'zh', 'ja', 'hi', 'ko', 'az', 'id')),
  confidence_score numeric(3,2) not null default 0.75,
  source_profile_count integer not null default 0,
  source_signal_count integer not null default 0,
  last_compacted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_scope, snapshot_key)
);

comment on table public.nova_memory_snapshots is 'Nova tarafindan uretilen stratejik uzun donem hafiza snapshot kayitlari';

create index if not exists idx_nova_memory_snapshots_user
  on public.nova_memory_snapshots(user_id, snapshot_scope, updated_at desc);

create index if not exists idx_nova_memory_snapshots_workspace
  on public.nova_memory_snapshots(organization_id, company_workspace_id, updated_at desc);

alter table public.nova_memory_snapshots enable row level security;

drop policy if exists "Users can read own Nova memory snapshots" on public.nova_memory_snapshots;
create policy "Users can read own Nova memory snapshots"
  on public.nova_memory_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova memory snapshots" on public.nova_memory_snapshots;
create policy "Users can insert own Nova memory snapshots"
  on public.nova_memory_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova memory snapshots" on public.nova_memory_snapshots;
create policy "Users can update own Nova memory snapshots"
  on public.nova_memory_snapshots for update
  using (auth.uid() = user_id);

alter table public.nova_memories
  drop constraint if exists nova_memories_language_check;

alter table public.nova_memories
  add constraint nova_memories_language_check
  check (language in ('tr', 'en', 'ar', 'ru', 'de', 'fr', 'es', 'zh', 'ja', 'hi', 'ko', 'az', 'id')) not valid;

alter table public.nova_memories
  validate constraint nova_memories_language_check;

alter table public.nova_action_runs
  drop constraint if exists nova_action_runs_language_check;

alter table public.nova_action_runs
  add constraint nova_action_runs_language_check
  check (language in ('tr', 'en', 'ar', 'ru', 'de', 'fr', 'es', 'zh', 'ja', 'hi', 'ko', 'az', 'id')) not valid;

alter table public.nova_action_runs
  validate constraint nova_action_runs_language_check;

alter table public.nova_feedback
  drop constraint if exists nova_feedback_language_check;

alter table public.nova_feedback
  add constraint nova_feedback_language_check
  check (language in ('tr', 'en', 'ar', 'ru', 'de', 'fr', 'es', 'zh', 'ja', 'hi', 'ko', 'az', 'id')) not valid;

alter table public.nova_feedback
  validate constraint nova_feedback_language_check;

alter table public.nova_workflow_runs
  drop constraint if exists nova_workflow_runs_language_check;

alter table public.nova_workflow_runs
  add constraint nova_workflow_runs_language_check
  check (language in ('tr', 'en', 'ar', 'ru', 'de', 'fr', 'es', 'zh', 'ja', 'hi', 'ko', 'az', 'id')) not valid;

alter table public.nova_workflow_runs
  validate constraint nova_workflow_runs_language_check;
