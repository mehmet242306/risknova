create table if not exists public.service_resilience_states (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  display_name text not null,
  service_type text not null,
  circuit_state text not null default 'closed' check (circuit_state in ('closed', 'open', 'half_open')),
  failure_count integer not null default 0 check (failure_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  open_until timestamptz,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null default gen_random_uuid(),
  component_key text not null,
  component_name text not null,
  status text not null check (status in ('healthy', 'degraded', 'down')),
  check_mode text not null default 'manual' check (check_mode in ('manual', 'scheduled', 'queued', 'automatic')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  summary text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  name text not null,
  description text,
  trigger_type text not null,
  condition_key text not null,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  evaluation_window_minutes integer not null default 5 check (evaluation_window_minutes > 0),
  is_active boolean not null default true,
  last_status text not null default 'idle' check (last_status in ('idle', 'triggered', 'failed', 'skipped')),
  last_triggered_at timestamptz,
  run_count integer not null default 0 check (run_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  company_workspace_id uuid references public.company_workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  task_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer not null default 50 check (priority between 1 and 100),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 5 check (max_retries between 1 and 20),
  scheduled_at timestamptz not null default now(),
  locked_by text,
  processing_started_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  storage_bucket text,
  storage_path text,
  checksum text,
  initiated_by uuid references auth.users(id) on delete set null,
  initiated_by_name text,
  details jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deployment_logs (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'production' check (environment in ('development', 'staging', 'production')),
  source text not null default 'github_actions',
  status text not null default 'started' check (status in ('started', 'success', 'failed', 'rolled_back')),
  smoke_test_status text not null default 'pending' check (smoke_test_status in ('pending', 'success', 'failed', 'skipped')),
  commit_sha text,
  branch text,
  build_url text,
  initiated_by text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_resilience_states_key on public.service_resilience_states(service_key);
create index if not exists idx_service_resilience_states_state on public.service_resilience_states(circuit_state, open_until);
create index if not exists idx_health_checks_component on public.health_checks(component_key, checked_at desc);
create index if not exists idx_health_checks_run on public.health_checks(run_id, checked_at desc);
create index if not exists idx_recovery_scenarios_active on public.recovery_scenarios(is_active, condition_key);
create index if not exists idx_task_queue_status_sched on public.task_queue(status, scheduled_at, priority);
create index if not exists idx_task_queue_type_status on public.task_queue(task_type, status, created_at desc);
create index if not exists idx_task_queue_org on public.task_queue(organization_id, status, created_at desc);
create index if not exists idx_backup_runs_started on public.backup_runs(status, started_at desc);
create index if not exists idx_deployment_logs_env on public.deployment_logs(environment, created_at desc);

drop trigger if exists trg_service_resilience_states_updated_at on public.service_resilience_states;
create trigger trg_service_resilience_states_updated_at
before update on public.service_resilience_states
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_recovery_scenarios_updated_at on public.recovery_scenarios;
create trigger trg_recovery_scenarios_updated_at
before update on public.recovery_scenarios
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_task_queue_updated_at on public.task_queue;
create trigger trg_task_queue_updated_at
before update on public.task_queue
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_backup_runs_updated_at on public.backup_runs;
create trigger trg_backup_runs_updated_at
before update on public.backup_runs
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_deployment_logs_updated_at on public.deployment_logs;
create trigger trg_deployment_logs_updated_at
before update on public.deployment_logs
for each row execute function public.set_current_timestamp_updated_at();

alter table public.service_resilience_states enable row level security;
alter table public.health_checks enable row level security;
alter table public.recovery_scenarios enable row level security;
alter table public.task_queue enable row level security;
alter table public.backup_runs enable row level security;
alter table public.deployment_logs enable row level security;

insert into public.permissions (code, name, description, module_key)
values
  ('self_healing.view', 'Self-healing durumunu goruntule', 'Saglik kontrolleri, queue ve recovery ekranlarini goruntule', 'self_healing'),
  ('self_healing.manage', 'Self-healing yonet', 'Saglik kontrolu, worker ve recovery senaryolarini manuel tetikle', 'self_healing'),
  ('backups.manage', 'Yedekleri yonet', 'Yedek alma ve yedek kayitlarini yonetme', 'self_healing'),
  ('deployments.view', 'Deployment kayitlarini goruntule', 'Deployment ve smoke test kayitlarini inceleme', 'self_healing')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  module_key = excluded.module_key;

with permission_map as (
  select code, id as permission_id from public.permissions
),
role_map as (
  select code, id as role_id
  from public.roles
  where code in ('super_admin', 'admin', 'platform_admin', 'organization_admin', 'osgb_manager')
),
matrix(role_code, permission_code) as (
  values
    ('super_admin', 'self_healing.view'),
    ('super_admin', 'self_healing.manage'),
    ('super_admin', 'backups.manage'),
    ('super_admin', 'deployments.view'),
    ('admin', 'self_healing.view'),
    ('admin', 'self_healing.manage'),
    ('admin', 'backups.manage'),
    ('admin', 'deployments.view'),
    ('platform_admin', 'self_healing.view'),
    ('platform_admin', 'self_healing.manage'),
    ('platform_admin', 'backups.manage'),
    ('platform_admin', 'deployments.view'),
    ('organization_admin', 'self_healing.view'),
    ('organization_admin', 'self_healing.manage'),
    ('organization_admin', 'backups.manage'),
    ('organization_admin', 'deployments.view'),
    ('osgb_manager', 'self_healing.view'),
    ('osgb_manager', 'deployments.view')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.role_id, p.permission_id
from matrix m
join role_map r on r.code = m.role_code
join permission_map p on p.code = m.permission_code
on conflict (role_id, permission_id) do nothing;

drop policy if exists service_resilience_states_select_admin on public.service_resilience_states;
create policy service_resilience_states_select_admin
on public.service_resilience_states
for select
to authenticated
using (
  public.user_has_permission('self_healing.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists health_checks_select_admin on public.health_checks;
create policy health_checks_select_admin
on public.health_checks
for select
to authenticated
using (
  public.user_has_permission('self_healing.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists recovery_scenarios_select_admin on public.recovery_scenarios;
create policy recovery_scenarios_select_admin
on public.recovery_scenarios
for select
to authenticated
using (
  public.user_has_permission('self_healing.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists recovery_scenarios_manage_admin on public.recovery_scenarios;
create policy recovery_scenarios_manage_admin
on public.recovery_scenarios
for all
to authenticated
using (
  public.user_has_permission('self_healing.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('self_healing.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists task_queue_select_admin_or_owner on public.task_queue;
create policy task_queue_select_admin_or_owner
on public.task_queue
for select
to authenticated
using (
  auth.uid() = created_by
  or public.user_has_permission('self_healing.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists task_queue_manage_admin on public.task_queue;
create policy task_queue_manage_admin
on public.task_queue
for all
to authenticated
using (
  public.user_has_permission('self_healing.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('self_healing.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists backup_runs_select_admin on public.backup_runs;
create policy backup_runs_select_admin
on public.backup_runs
for select
to authenticated
using (
  public.user_has_permission('backups.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists backup_runs_manage_admin on public.backup_runs;
create policy backup_runs_manage_admin
on public.backup_runs
for all
to authenticated
using (
  public.user_has_permission('backups.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('backups.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists deployment_logs_select_admin on public.deployment_logs;
create policy deployment_logs_select_admin
on public.deployment_logs
for select
to authenticated
using (
  public.user_has_permission('deployments.view')
  or public.user_has_permission('settings.manage')
);

create or replace function public.enqueue_task(
  p_task_type text,
  p_payload jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now(),
  p_organization_id uuid default null,
  p_company_workspace_id uuid default null,
  p_created_by uuid default auth.uid(),
  p_priority integer default 50,
  p_max_retries integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  insert into public.task_queue (
    organization_id,
    company_workspace_id,
    created_by,
    task_type,
    payload,
    scheduled_at,
    priority,
    max_retries
  )
  values (
    p_organization_id,
    p_company_workspace_id,
    p_created_by,
    p_task_type,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_scheduled_at, now()),
    greatest(1, least(coalesce(p_priority, 50), 100)),
    greatest(1, least(coalesce(p_max_retries, 5), 20))
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

create or replace function public.claim_task_queue(
  p_batch_size integer default 5,
  p_worker_id text default 'default-worker'
)
returns setof public.task_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select q.id
    from public.task_queue q
    where q.status = 'pending'
      and q.scheduled_at <= now()
    order by q.priority asc, q.scheduled_at asc, q.created_at asc
    limit greatest(1, least(coalesce(p_batch_size, 5), 20))
    for update skip locked
  ),
  updated as (
    update public.task_queue q
    set
      status = 'processing',
      locked_by = coalesce(p_worker_id, 'default-worker'),
      processing_started_at = now(),
      last_attempt_at = now(),
      updated_at = now()
    where q.id in (select id from picked)
    returning q.*
  )
  select * from updated;
end;
$$;

create or replace function public.complete_task_queue(
  p_task_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_queue
  set
    status = 'completed',
    result = coalesce(p_result, '{}'::jsonb),
    error_message = null,
    locked_by = null,
    completed_at = now(),
    updated_at = now()
  where id = p_task_id;
end;
$$;

create or replace function public.fail_task_queue(
  p_task_id uuid,
  p_error_message text,
  p_retry_delay_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retry_count integer;
  v_max_retries integer;
begin
  select retry_count, max_retries
  into v_retry_count, v_max_retries
  from public.task_queue
  where id = p_task_id
  for update;

  if not found then
    return;
  end if;

  if coalesce(v_retry_count, 0) + 1 >= coalesce(v_max_retries, 5) then
    update public.task_queue
    set
      status = 'failed',
      retry_count = coalesce(v_retry_count, 0) + 1,
      error_message = left(coalesce(p_error_message, 'failed'), 1000),
      locked_by = null,
      completed_at = now(),
      updated_at = now()
    where id = p_task_id;
  else
    update public.task_queue
    set
      status = 'pending',
      retry_count = coalesce(v_retry_count, 0) + 1,
      error_message = left(coalesce(p_error_message, 'failed'), 1000),
      locked_by = null,
      processing_started_at = null,
      scheduled_at = now() + make_interval(secs => greatest(30, coalesce(p_retry_delay_seconds, 60))),
      updated_at = now()
    where id = p_task_id;
  end if;
end;
$$;

create or replace function public.log_deployment_event(
  p_environment text,
  p_source text,
  p_status text,
  p_commit_sha text default null,
  p_branch text default null,
  p_build_url text default null,
  p_initiated_by text default null,
  p_smoke_test_status text default 'pending',
  p_details jsonb default '{}'::jsonb,
  p_started_at timestamptz default now(),
  p_completed_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.deployment_logs (
    environment,
    source,
    status,
    commit_sha,
    branch,
    build_url,
    initiated_by,
    smoke_test_status,
    details,
    started_at,
    completed_at
  )
  values (
    coalesce(p_environment, 'production'),
    coalesce(p_source, 'github_actions'),
    coalesce(p_status, 'started'),
    p_commit_sha,
    p_branch,
    p_build_url,
    p_initiated_by,
    coalesce(p_smoke_test_status, 'pending'),
    coalesce(p_details, '{}'::jsonb),
    coalesce(p_started_at, now()),
    p_completed_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enqueue_task(text, jsonb, timestamptz, uuid, uuid, uuid, integer, integer) to authenticated, service_role;
grant execute on function public.claim_task_queue(integer, text) to authenticated, service_role;
grant execute on function public.complete_task_queue(uuid, jsonb) to authenticated, service_role;
grant execute on function public.fail_task_queue(uuid, text, integer) to authenticated, service_role;
grant execute on function public.log_deployment_event(text, text, text, text, text, text, text, text, jsonb, timestamptz, timestamptz) to authenticated, service_role;

insert into public.recovery_scenarios (
  scenario_key,
  name,
  description,
  trigger_type,
  condition_key,
  action_type,
  action_config
)
values
  (
    'anthropic_outage_queue_mode',
    'Anthropic kesintisinde kuyruk moduna gec',
    'Anthropic hizmeti saglik kontrolunde down gorunurse AI isteklerini manuel fallback ve kuyruk mantigina alir.',
    'service_status',
    'anthropic.api:down',
    'queue_mode',
    jsonb_build_object('services', jsonb_build_array('anthropic.api'), 'cooldown_seconds', 300)
  ),
  (
    'storage_text_only_mode',
    'Storage kesintisinde metin modu',
    'Storage erisimi dusunce gorsel/dosya adimlarini gecici olarak kapatir ve manuel metin girisini onerir.',
    'service_status',
    'supabase.storage:down',
    'graceful_degradation',
    jsonb_build_object('mode', 'text_only')
  ),
  (
    'reclaim_stuck_queue_tasks',
    'Takili queue islemlerini geri al',
    'Isleniyor durumunda uzun sure kalan task kayitlarini tekrar pending durumuna alir.',
    'queue_pressure',
    'task_queue:processing_stuck',
    'requeue_stuck',
    jsonb_build_object('threshold_minutes', 15)
  ),
  (
    'backup_storage_warning',
    'Yedekleme depolama uyarisi',
    'Yedek islemleri basarisiz olursa admin panelinde recovery uyarisi gosterir.',
    'backup_status',
    'backup_runs:failed',
    'alert_only',
    jsonb_build_object('severity', 'warning')
  )
on conflict (scenario_key) do update
set
  name = excluded.name,
  description = excluded.description,
  trigger_type = excluded.trigger_type,
  condition_key = excluded.condition_key,
  action_type = excluded.action_type,
  action_config = excluded.action_config,
  updated_at = now();
