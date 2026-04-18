alter table public.incidents
  add column if not exists narrative text,
  add column if not exists ishikawa_data jsonb,
  add column if not exists sgk_notification_deadline date,
  add column if not exists sgk_notified_at timestamptz;

alter table public.incidents
  drop constraint if exists incidents_incident_type_check;

alter table public.incidents
  add constraint incidents_incident_type_check
  check (
    incident_type in (
      'work_accident',
      'near_miss',
      'occupational_disease',
      'other',
      'accident'
    )
  );

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_workspace_id uuid not null references public.company_workspaces(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  title text not null,
  root_cause text not null,
  category text not null check (category in ('insan', 'makine', 'metot', 'malzeme', 'olcum', 'cevre')),
  corrective_action text not null,
  preventive_action text,
  responsible_user_id uuid references auth.users(id),
  responsible_role text,
  deadline date not null,
  status text not null default 'tracking' check (
    status in ('tracking', 'in_progress', 'on_hold', 'completed', 'overdue')
  ),
  priority text not null default 'Orta' check (
    priority in ('Düşük', 'Orta', 'Yüksek', 'Kritik')
  ),
  completion_percentage int not null default 0 check (
    completion_percentage between 0 and 100
  ),
  ai_generated boolean not null default false,
  ishikawa_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_corrective_actions_org
  on public.corrective_actions (organization_id);

create index if not exists idx_corrective_actions_company
  on public.corrective_actions (company_workspace_id);

create index if not exists idx_corrective_actions_incident
  on public.corrective_actions (incident_id);

create index if not exists idx_corrective_actions_status
  on public.corrective_actions (status);

create index if not exists idx_corrective_actions_deadline
  on public.corrective_actions (deadline);

create index if not exists idx_corrective_actions_responsible
  on public.corrective_actions (responsible_user_id);

create table if not exists public.corrective_action_updates (
  id uuid primary key default gen_random_uuid(),
  corrective_action_id uuid not null references public.corrective_actions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  update_type text not null check (
    update_type in ('comment', 'progress', 'status_change', 'file_upload')
  ),
  content text,
  file_url text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_corrective_action_updates_corrective_action
  on public.corrective_action_updates (corrective_action_id);

create index if not exists idx_corrective_action_updates_org
  on public.corrective_action_updates (organization_id);

create or replace function public.generate_corrective_action_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  year_part text;
  next_num int;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  year_part := to_char(now(), 'YYYY');

  select coalesce(
    max(
      case
        when code ~ ('^DÖF-' || year_part || '-[0-9]+$')
          then substring(code from ('^DÖF-' || year_part || '-([0-9]+)$'))::int
        else null
      end
    ),
    0
  ) + 1
  into next_num
  from public.corrective_actions;

  new.code := 'DÖF-' || year_part || '-' || lpad(next_num::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_corrective_actions_code on public.corrective_actions;
create trigger trg_corrective_actions_code
before insert on public.corrective_actions
for each row
execute function public.generate_corrective_action_code();

drop trigger if exists trg_corrective_actions_updated_at on public.corrective_actions;
create trigger trg_corrective_actions_updated_at
before update on public.corrective_actions
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.mark_overdue_corrective_actions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.corrective_actions
     set status = 'overdue',
         updated_at = now()
   where deadline < current_date
     and status not in ('completed', 'overdue');
end;
$$;

alter table public.corrective_actions enable row level security;
alter table public.corrective_action_updates enable row level security;

drop policy if exists corrective_actions_select on public.corrective_actions;
create policy corrective_actions_select
on public.corrective_actions
for select
using (organization_id = public.current_organization_id());

drop policy if exists corrective_actions_insert on public.corrective_actions;
create policy corrective_actions_insert
on public.corrective_actions
for insert
with check (organization_id = public.current_organization_id());

drop policy if exists corrective_actions_update on public.corrective_actions;
create policy corrective_actions_update
on public.corrective_actions
for update
using (organization_id = public.current_organization_id());

drop policy if exists corrective_actions_delete on public.corrective_actions;
create policy corrective_actions_delete
on public.corrective_actions
for delete
using (organization_id = public.current_organization_id());

drop policy if exists corrective_action_updates_select on public.corrective_action_updates;
create policy corrective_action_updates_select
on public.corrective_action_updates
for select
using (organization_id = public.current_organization_id());

drop policy if exists corrective_action_updates_insert on public.corrective_action_updates;
create policy corrective_action_updates_insert
on public.corrective_action_updates
for insert
with check (organization_id = public.current_organization_id());

drop policy if exists corrective_action_updates_update on public.corrective_action_updates;
create policy corrective_action_updates_update
on public.corrective_action_updates
for update
using (organization_id = public.current_organization_id());

drop policy if exists corrective_action_updates_delete on public.corrective_action_updates;
create policy corrective_action_updates_delete
on public.corrective_action_updates
for delete
using (organization_id = public.current_organization_id());
