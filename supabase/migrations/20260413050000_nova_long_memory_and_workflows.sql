create table if not exists public.nova_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  profile_scope text not null check (profile_scope in ('user', 'company', 'operation')),
  profile_key text not null,
  title text not null,
  summary_text text not null,
  structured_profile jsonb not null default '{}'::jsonb,
  confidence_score numeric(3,2) not null default 0.75,
  observation_count integer not null default 1,
  last_observed_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nova_memory_profiles is 'Nova tarafindan uretilen uzun donem kullanici ve firma hafizasi profilleri';

create index if not exists idx_nova_memory_profiles_user
  on public.nova_memory_profiles(user_id, profile_scope, updated_at desc);

create index if not exists idx_nova_memory_profiles_workspace
  on public.nova_memory_profiles(organization_id, company_workspace_id, updated_at desc);

create index if not exists idx_nova_memory_profiles_key
  on public.nova_memory_profiles(profile_key, profile_scope);

alter table public.nova_memory_profiles enable row level security;

drop policy if exists "Users can read own Nova memory profiles" on public.nova_memory_profiles;
create policy "Users can read own Nova memory profiles"
  on public.nova_memory_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova memory profiles" on public.nova_memory_profiles;
create policy "Users can insert own Nova memory profiles"
  on public.nova_memory_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova memory profiles" on public.nova_memory_profiles;
create policy "Users can update own Nova memory profiles"
  on public.nova_memory_profiles for update
  using (auth.uid() = user_id);

create table if not exists public.nova_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  query_id uuid references public.solution_queries(id) on delete set null,
  session_id text not null,
  workflow_type text not null,
  title text not null,
  summary text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'failed')),
  language text not null default 'tr' check (language in ('tr', 'en')),
  current_step integer not null default 1,
  total_steps integer not null default 0,
  navigation_url text,
  navigation_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.nova_workflow_runs is 'Nova tarafindan baslatilan cok adimli operasyon akislarinin ust kaydi';

create index if not exists idx_nova_workflow_runs_user
  on public.nova_workflow_runs(user_id, status, created_at desc);

create index if not exists idx_nova_workflow_runs_session
  on public.nova_workflow_runs(session_id, created_at desc);

create index if not exists idx_nova_workflow_runs_workspace
  on public.nova_workflow_runs(organization_id, company_workspace_id, status);

alter table public.nova_workflow_runs enable row level security;

drop policy if exists "Users can read own Nova workflow runs" on public.nova_workflow_runs;
create policy "Users can read own Nova workflow runs"
  on public.nova_workflow_runs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova workflow runs" on public.nova_workflow_runs;
create policy "Users can insert own Nova workflow runs"
  on public.nova_workflow_runs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova workflow runs" on public.nova_workflow_runs;
create policy "Users can update own Nova workflow runs"
  on public.nova_workflow_runs for update
  using (auth.uid() = user_id);

create table if not exists public.nova_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.nova_workflow_runs(id) on delete cascade,
  step_order integer not null,
  step_key text not null,
  title text not null,
  description text,
  action_kind text not null default 'review' check (action_kind in ('system', 'navigate', 'prompt', 'review')),
  target_url text,
  prompt_text text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_run_id, step_order)
);

comment on table public.nova_workflow_steps is 'Nova workflow kayitlarinin tekil adimlari';

create index if not exists idx_nova_workflow_steps_run
  on public.nova_workflow_steps(workflow_run_id, step_order);

create index if not exists idx_nova_workflow_steps_status
  on public.nova_workflow_steps(status, updated_at desc);

alter table public.nova_workflow_steps enable row level security;

drop policy if exists "Users can read own Nova workflow steps" on public.nova_workflow_steps;
create policy "Users can read own Nova workflow steps"
  on public.nova_workflow_steps for select
  using (
    workflow_run_id in (
      select id from public.nova_workflow_runs
      where user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own Nova workflow steps" on public.nova_workflow_steps;
create policy "Users can update own Nova workflow steps"
  on public.nova_workflow_steps for update
  using (
    workflow_run_id in (
      select id from public.nova_workflow_runs
      where user_id = auth.uid()
    )
  );

create or replace function public.update_nova_workflow_step(
  p_step_id uuid,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step record;
  v_run record;
  v_next_step record;
  v_status text := case
    when p_status in ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')
      then p_status
    else 'completed'
  end;
  v_remaining_count integer := 0;
  v_completed_count integer := 0;
begin
  select s.id,
         s.workflow_run_id,
         s.step_order,
         s.title,
         s.target_url,
         s.prompt_text,
         s.action_kind,
         r.user_id,
         r.title as workflow_title,
         r.status as workflow_status
    into v_step
    from public.nova_workflow_steps s
    join public.nova_workflow_runs r on r.id = s.workflow_run_id
   where s.id = p_step_id
     and r.user_id = auth.uid();

  if v_step.id is null then
    raise exception 'Nova workflow adimi bulunamadi';
  end if;

  update public.nova_workflow_steps
     set status = v_status,
         completed_at = case
           when v_status in ('completed', 'skipped', 'cancelled') then now()
           else null
         end,
         updated_at = now()
   where id = p_step_id;

  select count(*)
    into v_remaining_count
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('pending', 'in_progress');

  select count(*)
    into v_completed_count
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('completed', 'skipped', 'cancelled');

  select step_order,
         id,
         title,
         target_url,
         prompt_text,
         action_kind,
         status
    into v_next_step
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('pending', 'in_progress')
   order by step_order asc
   limit 1;

  update public.nova_workflow_runs
     set status = case
           when v_remaining_count = 0 then
             case
               when v_status = 'cancelled' then 'cancelled'
               else 'completed'
             end
           else 'active'
         end,
         current_step = coalesce(v_next_step.step_order, greatest(v_completed_count, 1)),
         completed_at = case when v_remaining_count = 0 then now() else null end,
         updated_at = now()
   where id = v_step.workflow_run_id;

  select id,
         title,
         summary,
         status,
         current_step,
         total_steps
    into v_run
    from public.nova_workflow_runs
   where id = v_step.workflow_run_id;

  return jsonb_build_object(
    'success', true,
    'workflow_run_id', v_run.id,
    'workflow_title', v_run.title,
    'workflow_status', v_run.status,
    'current_step', v_run.current_step,
    'total_steps', v_run.total_steps,
    'completed_step_id', v_step.id,
    'completed_step_title', v_step.title,
    'next_step', case
      when v_next_step.step_order is null then null
      else jsonb_build_object(
        'id', v_next_step.id,
        'step_order', v_next_step.step_order,
        'title', v_next_step.title,
        'target_url', v_next_step.target_url,
        'prompt_text', v_next_step.prompt_text,
        'action_kind', v_next_step.action_kind,
        'status', v_next_step.status
      )
    end
  );
end;
$$;

grant execute on function public.update_nova_workflow_step(uuid, text) to authenticated;
