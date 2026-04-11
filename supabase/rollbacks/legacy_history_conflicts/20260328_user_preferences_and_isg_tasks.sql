-- ============================================================
-- user_preferences: per-user theme, language, notifications
-- ============================================================
create table if not exists public.user_preferences (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null unique references auth.users(id) on delete cascade,
  theme                 text        not null default 'system' check (theme in ('light', 'dark', 'system')),
  language              text        not null default 'tr' check (language in ('tr', 'en')),
  email_notifications   boolean     not null default true,
  push_notifications    boolean     not null default false,
  default_dashboard_view text       not null default 'overview',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_current_timestamp_updated_at();
alter table public.user_preferences enable row level security;
drop policy if exists "user_preferences_select" on public.user_preferences;
drop policy if exists "user_preferences_insert" on public.user_preferences;
drop policy if exists "user_preferences_update" on public.user_preferences;
drop policy if exists "user_preferences_delete" on public.user_preferences;
create policy "user_preferences_select" on public.user_preferences
  for select using (user_id = auth.uid());
create policy "user_preferences_insert" on public.user_preferences
  for insert with check (user_id = auth.uid());
create policy "user_preferences_update" on public.user_preferences
  for update using (user_id = auth.uid());
create policy "user_preferences_delete" on public.user_preferences
  for delete using (user_id = auth.uid());
-- ============================================================
-- isg_task_categories: color-coded task types
-- ============================================================
create table if not exists public.isg_task_categories (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  color           text        not null default '#3B82F6',
  icon            text,
  organization_id uuid        references public.organizations(id) on delete cascade,
  is_default      boolean     not null default false,
  created_at      timestamptz not null default now()
);
alter table public.isg_task_categories enable row level security;
drop policy if exists "isg_task_categories_select" on public.isg_task_categories;
drop policy if exists "isg_task_categories_insert" on public.isg_task_categories;
drop policy if exists "isg_task_categories_update" on public.isg_task_categories;
drop policy if exists "isg_task_categories_delete" on public.isg_task_categories;
create policy "isg_task_categories_select" on public.isg_task_categories
  for select using (
    is_default = true
    or organization_id = current_organization_id()
  );
create policy "isg_task_categories_insert" on public.isg_task_categories
  for insert with check (organization_id = current_organization_id());
create policy "isg_task_categories_update" on public.isg_task_categories
  for update using (organization_id = current_organization_id() and is_default = false);
create policy "isg_task_categories_delete" on public.isg_task_categories
  for delete using (organization_id = current_organization_id() and is_default = false);
-- Seed default categories (global, no org)
insert into public.isg_task_categories (name, color, icon, is_default) values
  ('Periyodik Kontrol',     '#EF4444', '🔧', true),
  ('Eğitim',                '#3B82F6', '📚', true),
  ('Sağlık Takibi',         '#10B981', '🏥', true),
  ('Toplantı & Tatbikat',   '#8B5CF6', '📋', true),
  ('Yasal Yükümlülük',      '#F59E0B', '⚖️', true),
  ('Diğer',                 '#6B7280', '📌', true)
on conflict do nothing;
-- ============================================================
-- isg_tasks: main task / planning record
-- ============================================================
create table if not exists public.isg_tasks (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        references public.organizations(id) on delete cascade,
  title           text        not null,
  description     text,
  category_id     uuid        references public.isg_task_categories(id) on delete set null,
  start_date      date        not null,
  end_date        date,
  recurrence      text        not null default 'none'
                              check (recurrence in ('none','daily','weekly','monthly','biannual','annual')),
  status          text        not null default 'planned'
                              check (status in ('planned','in_progress','completed','overdue','cancelled')),
  assigned_to     uuid        references public.user_profiles(id) on delete set null,
  company_name    text,
  location        text,
  reminder_days   integer     not null default 7,
  created_by      uuid        references public.user_profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_isg_tasks_org_id     on public.isg_tasks(organization_id);
create index if not exists idx_isg_tasks_start_date on public.isg_tasks(start_date);
create index if not exists idx_isg_tasks_status     on public.isg_tasks(status);
create index if not exists idx_isg_tasks_assigned   on public.isg_tasks(assigned_to);
drop trigger if exists set_isg_tasks_updated_at on public.isg_tasks;
create trigger set_isg_tasks_updated_at
  before update on public.isg_tasks
  for each row execute function public.set_current_timestamp_updated_at();
alter table public.isg_tasks enable row level security;
drop policy if exists "isg_tasks_select" on public.isg_tasks;
drop policy if exists "isg_tasks_insert" on public.isg_tasks;
drop policy if exists "isg_tasks_update" on public.isg_tasks;
drop policy if exists "isg_tasks_delete" on public.isg_tasks;
create policy "isg_tasks_select" on public.isg_tasks
  for select using (
    organization_id = current_organization_id()
    or assigned_to = (
      select id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );
create policy "isg_tasks_insert" on public.isg_tasks
  for insert with check (organization_id = current_organization_id());
create policy "isg_tasks_update" on public.isg_tasks
  for update using (organization_id = current_organization_id());
create policy "isg_tasks_delete" on public.isg_tasks
  for delete using (organization_id = current_organization_id());
-- ============================================================
-- isg_task_completions: completion records per task
-- ============================================================
create table if not exists public.isg_task_completions (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references public.isg_tasks(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  completed_by  uuid        references public.user_profiles(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_isg_completions_task_id on public.isg_task_completions(task_id);
alter table public.isg_task_completions enable row level security;
drop policy if exists "isg_completions_select" on public.isg_task_completions;
drop policy if exists "isg_completions_insert" on public.isg_task_completions;
drop policy if exists "isg_completions_delete" on public.isg_task_completions;
create policy "isg_completions_select" on public.isg_task_completions
  for select using (
    task_id in (
      select id from public.isg_tasks
      where organization_id = current_organization_id()
    )
  );
create policy "isg_completions_insert" on public.isg_task_completions
  for insert with check (
    task_id in (
      select id from public.isg_tasks
      where organization_id = current_organization_id()
    )
  );
create policy "isg_completions_delete" on public.isg_task_completions
  for delete using (
    task_id in (
      select id from public.isg_tasks
      where organization_id = current_organization_id()
    )
  );
-- Storage bucket for avatars (idempotent via DO block)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
exception when others then
  null; -- storage schema may not exist in local dev
end;
$$;
