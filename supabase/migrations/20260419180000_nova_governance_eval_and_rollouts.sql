create table if not exists public.nova_feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  display_name text not null,
  description text null,
  organization_id uuid null references public.organizations(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  is_enabled boolean not null default true,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  config jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_nova_feature_flags_scope_unique
  on public.nova_feature_flags (
    feature_key,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_nova_feature_flags_feature_scope
  on public.nova_feature_flags(feature_key, organization_id, workspace_id);

drop trigger if exists trg_nova_feature_flags_updated_at on public.nova_feature_flags;
create trigger trg_nova_feature_flags_updated_at
before update on public.nova_feature_flags
for each row execute function public.set_updated_at();

alter table public.nova_feature_flags enable row level security;

drop policy if exists "nova_feature_flags_select_admin" on public.nova_feature_flags;
create policy "nova_feature_flags_select_admin"
on public.nova_feature_flags
for select
to authenticated
using (
  public.user_has_permission('admin.ai_usage.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists "nova_feature_flags_manage_admin" on public.nova_feature_flags;
create policy "nova_feature_flags_manage_admin"
on public.nova_feature_flags
for all
to authenticated
using (
  public.user_has_permission('admin.ai.rollout.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.ai.rollout.manage')
  or public.user_has_permission('settings.manage')
);

create table if not exists public.nova_eval_runs (
  id uuid primary key default gen_random_uuid(),
  suite_key text not null,
  case_key text not null,
  category text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  session_id uuid null references public.agent_sessions(id) on delete set null,
  action_run_id uuid null references public.nova_action_runs(id) on delete set null,
  executed_by uuid null references auth.users(id) on delete set null,
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  passed boolean not null default false,
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  failure_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_nova_eval_runs_suite_created
  on public.nova_eval_runs(suite_key, created_at desc);

create index if not exists idx_nova_eval_runs_org_created
  on public.nova_eval_runs(organization_id, created_at desc);

create index if not exists idx_nova_eval_runs_case_created
  on public.nova_eval_runs(case_key, created_at desc);

alter table public.nova_eval_runs enable row level security;

drop policy if exists "nova_eval_runs_select_admin" on public.nova_eval_runs;
create policy "nova_eval_runs_select_admin"
on public.nova_eval_runs
for select
to authenticated
using (
  public.user_has_permission('admin.ai.eval.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists "nova_eval_runs_manage_admin" on public.nova_eval_runs;
create policy "nova_eval_runs_manage_admin"
on public.nova_eval_runs
for all
to authenticated
using (
  public.user_has_permission('admin.ai.eval.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.ai.eval.manage')
  or public.user_has_permission('settings.manage')
);

create table if not exists public.nova_outbox_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.nova_outbox(id) on delete cascade,
  action_run_id uuid not null references public.nova_action_runs(id) on delete cascade,
  task_queue_id uuid null references public.task_queue(id) on delete set null,
  event_type text not null,
  message text null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nova_outbox_events_outbox_created
  on public.nova_outbox_events(outbox_id, created_at desc);

create index if not exists idx_nova_outbox_events_action_created
  on public.nova_outbox_events(action_run_id, created_at desc);

alter table public.nova_outbox_events enable row level security;

drop policy if exists "nova_outbox_events_select_admin" on public.nova_outbox_events;
create policy "nova_outbox_events_select_admin"
on public.nova_outbox_events
for select
to authenticated
using (
  public.user_has_permission('self_healing.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists "nova_outbox_events_manage_admin" on public.nova_outbox_events;
create policy "nova_outbox_events_manage_admin"
on public.nova_outbox_events
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

insert into public.permissions (code, name, description, module_key)
values
  ('admin.ai.rollout.manage', 'Nova rollout yonet', 'Nova tenant bazli rollout ve feature gate ayarlarini yonetme', 'admin_observability'),
  ('admin.ai.eval.view', 'Nova benchmark goruntule', 'Nova benchmark, kalite ve eval skorlarini goruntuleme', 'admin_observability'),
  ('admin.ai.eval.manage', 'Nova benchmark calistir', 'Nova benchmark kosulari baslatma ve eval kayitlarini yonetme', 'admin_observability'),
  ('self_healing.replay.manage', 'Nova replay yonet', 'Nova dead-letter ve replay operasyonlarini yonetme', 'self_healing')
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
    ('super_admin', 'admin.ai.rollout.manage'),
    ('super_admin', 'admin.ai.eval.view'),
    ('super_admin', 'admin.ai.eval.manage'),
    ('super_admin', 'self_healing.replay.manage'),
    ('admin', 'admin.ai.rollout.manage'),
    ('admin', 'admin.ai.eval.view'),
    ('admin', 'admin.ai.eval.manage'),
    ('admin', 'self_healing.replay.manage'),
    ('platform_admin', 'admin.ai.rollout.manage'),
    ('platform_admin', 'admin.ai.eval.view'),
    ('platform_admin', 'admin.ai.eval.manage'),
    ('platform_admin', 'self_healing.replay.manage'),
    ('organization_admin', 'admin.ai.eval.view'),
    ('osgb_manager', 'admin.ai.eval.view')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.role_id, p.permission_id
from matrix m
join role_map r on r.code = m.role_code
join permission_map p on p.code = m.permission_code
on conflict (role_id, permission_id) do nothing;

insert into public.nova_feature_flags (
  feature_key,
  display_name,
  description,
  is_enabled,
  rollout_percentage,
  config
)
values
  ('nova.agent.chat', 'Nova Chat Gateway', 'Nova ana sohbet ve ajan girisi', true, 100, '{"killSwitch": false}'::jsonb),
  ('nova.agent.confirmations', 'Nova Confirmation Flow', 'Nova onay ve aksiyon gecidi', true, 100, '{"naturalLanguageApproval": true}'::jsonb),
  ('nova.agent.async_execution', 'Nova Async Execution', 'Nova queue, outbox ve worker yurutumu', true, 100, '{"workerRequired": true}'::jsonb),
  ('nova.agent.benchmarks', 'Nova Benchmarks', 'Nova benchmark ve kalite olcum kosulari', true, 100, '{"suite": "core"}'::jsonb)
on conflict do nothing;
