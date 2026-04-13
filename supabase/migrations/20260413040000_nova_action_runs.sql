create table if not exists public.nova_action_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  session_id text not null,
  action_name text not null,
  action_title text not null,
  action_summary text,
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'failed', 'expired')),
  requires_confirmation boolean not null default true,
  language text not null default 'tr' check (language in ('tr', 'en')),
  confirmed_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  result_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nova_action_runs is 'Nova tarafindan hazirlanan, onay bekleyen veya tamamlanan kritik operasyon aksiyonlari';

create index if not exists idx_nova_action_runs_user_status
  on public.nova_action_runs(user_id, status, created_at desc);

create index if not exists idx_nova_action_runs_session_status
  on public.nova_action_runs(session_id, status, created_at desc);

create index if not exists idx_nova_action_runs_org_workspace
  on public.nova_action_runs(organization_id, company_workspace_id, status);

alter table public.nova_action_runs enable row level security;

drop policy if exists "Users can read own Nova action runs" on public.nova_action_runs;
create policy "Users can read own Nova action runs"
  on public.nova_action_runs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova action runs" on public.nova_action_runs;
create policy "Users can insert own Nova action runs"
  on public.nova_action_runs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova action runs" on public.nova_action_runs;
create policy "Users can update own Nova action runs"
  on public.nova_action_runs for update
  using (auth.uid() = user_id);
