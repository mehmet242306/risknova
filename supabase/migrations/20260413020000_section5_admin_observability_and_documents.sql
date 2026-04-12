create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info', 'warn', 'error', 'critical')),
  source text not null,
  endpoint text,
  message text not null,
  stack_trace text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  request_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  model text not null,
  endpoint text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique,
  title text not null,
  category text not null,
  summary text,
  is_active boolean not null default true,
  current_version text,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.admin_documents(id) on delete cascade,
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  summary text,
  content_markdown text not null,
  effective_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint admin_document_versions_unique unique (document_id, version)
);

create index if not exists idx_error_logs_created on public.error_logs(created_at desc);
create index if not exists idx_error_logs_level on public.error_logs(level, created_at desc);
create index if not exists idx_error_logs_source on public.error_logs(source, created_at desc);
create index if not exists idx_error_logs_resolved on public.error_logs(resolved_at, created_at desc);
create index if not exists idx_ai_usage_logs_created on public.ai_usage_logs(created_at desc);
create index if not exists idx_ai_usage_logs_model on public.ai_usage_logs(model, created_at desc);
create index if not exists idx_ai_usage_logs_endpoint on public.ai_usage_logs(endpoint, created_at desc);
create index if not exists idx_admin_notifications_created on public.admin_notifications(created_at desc);
create index if not exists idx_admin_notifications_resolved on public.admin_notifications(is_resolved, created_at desc);
create index if not exists idx_admin_documents_category on public.admin_documents(category, updated_at desc);
create index if not exists idx_admin_document_versions_document on public.admin_document_versions(document_id, created_at desc);

drop trigger if exists trg_admin_documents_updated_at on public.admin_documents;
create trigger trg_admin_documents_updated_at
before update on public.admin_documents
for each row execute function public.set_current_timestamp_updated_at();

alter table public.error_logs enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_documents enable row level security;
alter table public.admin_document_versions enable row level security;

insert into public.permissions (code, name, description, module_key)
values
  ('admin.dashboard.view', 'Admin dashboard goruntule', 'Yonetim genel durum kartlarini goruntuleme', 'admin_observability'),
  ('admin.error_logs.view', 'Hata loglarini goruntule', 'Tum yakalanan hata loglarini ve istatistiklerini goruntuleme', 'admin_observability'),
  ('admin.error_logs.manage', 'Hata loglarini yonet', 'Hata loglarini cozuldu olarak isaretleme ve bildirim olusturma', 'admin_observability'),
  ('admin.ai_usage.view', 'AI kullanimini goruntule', 'AI kullanim, maliyet ve model dagilimlarini goruntuleme', 'admin_observability'),
  ('admin.notifications.view', 'Admin bildirimlerini goruntule', 'Admin kritik bildirim akisini goruntuleme', 'admin_observability'),
  ('admin.notifications.manage', 'Admin bildirimlerini yonet', 'Admin bildirimlerini olusturma ve cozuldu isaretleme', 'admin_observability'),
  ('admin.users.manage', 'Kullanicilari yonet', 'Kullanici rol, aktivasyon ve parola reset akislarini yonetme', 'admin_observability'),
  ('admin.database_health.view', 'Veritabani sagligini goruntule', 'Tablo boyutlari, baglanti ve yavas sorgu goruntuleme', 'admin_observability'),
  ('admin.documents.manage', 'Kurumsal belgeleri yonet', 'Versiyonlu hukuki ve operasyonel belgeleri yonetme', 'admin_documents')
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
    ('super_admin', 'admin.dashboard.view'),
    ('super_admin', 'admin.error_logs.view'),
    ('super_admin', 'admin.error_logs.manage'),
    ('super_admin', 'admin.ai_usage.view'),
    ('super_admin', 'admin.notifications.view'),
    ('super_admin', 'admin.notifications.manage'),
    ('super_admin', 'admin.users.manage'),
    ('super_admin', 'admin.database_health.view'),
    ('super_admin', 'admin.documents.manage'),
    ('admin', 'admin.dashboard.view'),
    ('admin', 'admin.error_logs.view'),
    ('admin', 'admin.error_logs.manage'),
    ('admin', 'admin.ai_usage.view'),
    ('admin', 'admin.notifications.view'),
    ('admin', 'admin.notifications.manage'),
    ('admin', 'admin.users.manage'),
    ('admin', 'admin.database_health.view'),
    ('admin', 'admin.documents.manage'),
    ('platform_admin', 'admin.dashboard.view'),
    ('platform_admin', 'admin.error_logs.view'),
    ('platform_admin', 'admin.error_logs.manage'),
    ('platform_admin', 'admin.ai_usage.view'),
    ('platform_admin', 'admin.notifications.view'),
    ('platform_admin', 'admin.notifications.manage'),
    ('platform_admin', 'admin.users.manage'),
    ('platform_admin', 'admin.database_health.view'),
    ('platform_admin', 'admin.documents.manage'),
    ('organization_admin', 'admin.dashboard.view'),
    ('organization_admin', 'admin.ai_usage.view'),
    ('organization_admin', 'admin.notifications.view'),
    ('organization_admin', 'admin.documents.manage'),
    ('osgb_manager', 'admin.dashboard.view'),
    ('osgb_manager', 'admin.ai_usage.view'),
    ('osgb_manager', 'admin.notifications.view')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.role_id, p.permission_id
from matrix m
join role_map r on r.code = m.role_code
join permission_map p on p.code = m.permission_code
on conflict (role_id, permission_id) do nothing;

drop policy if exists error_logs_select_admin on public.error_logs;
create policy error_logs_select_admin
on public.error_logs
for select
to authenticated
using (
  public.user_has_permission('admin.error_logs.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists error_logs_update_admin on public.error_logs;
create policy error_logs_update_admin
on public.error_logs
for update
to authenticated
using (
  public.user_has_permission('admin.error_logs.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.error_logs.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists ai_usage_logs_select_admin on public.ai_usage_logs;
create policy ai_usage_logs_select_admin
on public.ai_usage_logs
for select
to authenticated
using (
  public.user_has_permission('admin.ai_usage.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_notifications_select_admin on public.admin_notifications;
create policy admin_notifications_select_admin
on public.admin_notifications
for select
to authenticated
using (
  public.user_has_permission('admin.notifications.view')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_notifications_manage_admin on public.admin_notifications;
create policy admin_notifications_manage_admin
on public.admin_notifications
for all
to authenticated
using (
  public.user_has_permission('admin.notifications.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.notifications.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_documents_select_admin on public.admin_documents;
create policy admin_documents_select_admin
on public.admin_documents
for select
to authenticated
using (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_documents_manage_admin on public.admin_documents;
create policy admin_documents_manage_admin
on public.admin_documents
for all
to authenticated
using (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_document_versions_select_admin on public.admin_document_versions;
create policy admin_document_versions_select_admin
on public.admin_document_versions
for select
to authenticated
using (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
);

drop policy if exists admin_document_versions_manage_admin on public.admin_document_versions;
create policy admin_document_versions_manage_admin
on public.admin_document_versions
for all
to authenticated
using (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
)
with check (
  public.user_has_permission('admin.documents.manage')
  or public.user_has_permission('settings.manage')
);

create or replace function public.log_error_event(
  p_level text,
  p_source text,
  p_message text,
  p_stack_trace text default null,
  p_context jsonb default '{}'::jsonb,
  p_user_id uuid default null,
  p_organization_id uuid default null,
  p_request_id text default null,
  p_endpoint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.error_logs (
    level,
    source,
    endpoint,
    message,
    stack_trace,
    context,
    user_id,
    organization_id,
    request_id
  )
  values (
    p_level,
    p_source,
    p_endpoint,
    left(coalesce(p_message, 'Bilinmeyen hata'), 2000),
    p_stack_trace,
    coalesce(p_context, '{}'::jsonb),
    p_user_id,
    p_organization_id,
    p_request_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.log_ai_usage(
  p_user_id uuid,
  p_organization_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_cached_tokens integer,
  p_cost_usd numeric,
  p_endpoint text,
  p_success boolean,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.ai_usage_logs (
    user_id,
    organization_id,
    model,
    endpoint,
    prompt_tokens,
    completion_tokens,
    cached_tokens,
    cost_usd,
    success,
    metadata
  )
  values (
    p_user_id,
    p_organization_id,
    coalesce(nullif(p_model, ''), 'unknown'),
    coalesce(nullif(p_endpoint, ''), 'unknown'),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    greatest(coalesce(p_cached_tokens, 0), 0),
    greatest(coalesce(p_cost_usd, 0), 0),
    coalesce(p_success, true),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_database_runtime_stats()
returns table (
  database_size_bytes bigint,
  total_connections integer,
  active_connections integer,
  waiting_connections integer,
  slow_query_count integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_slow_query_count integer := 0;
begin
  if to_regclass('public.pg_stat_statements') is not null then
    execute 'select count(*)::integer from public.pg_stat_statements where mean_exec_time >= 500'
      into v_slow_query_count;
  end if;

  return query
  select
    pg_database_size(current_database())::bigint as database_size_bytes,
    count(*)::integer as total_connections,
    count(*) filter (where state = 'active')::integer as active_connections,
    count(*) filter (where wait_event_type is not null)::integer as waiting_connections,
    v_slow_query_count
  from pg_stat_activity
  where datname = current_database();
end;
$$;

create or replace function public.list_database_table_stats()
returns table (
  table_name text,
  row_estimate bigint,
  total_size_bytes bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with tracked(table_name) as (
    select unnest(array[
      'user_profiles',
      'organizations',
      'security_events',
      'error_logs',
      'ai_usage_logs',
      'task_queue',
      'backup_runs',
      'health_checks',
      'data_exports',
      'data_deletion_requests',
      'international_transfers'
    ]::text[])
  )
  select
    tracked.table_name,
    coalesce(stats.n_live_tup::bigint, 0) as row_estimate,
    coalesce(pg_total_relation_size(to_regclass(format('public.%I', tracked.table_name))), 0)::bigint as total_size_bytes
  from tracked
  left join pg_stat_user_tables stats
    on stats.schemaname = 'public'
   and stats.relname = tracked.table_name
  order by total_size_bytes desc, tracked.table_name;
$$;

create or replace function public.list_database_slow_queries()
returns table (
  query_id text,
  call_count bigint,
  mean_exec_time_ms numeric,
  total_exec_time_ms numeric,
  query_text text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if to_regclass('public.pg_stat_statements') is null then
    return;
  end if;

  return query
  execute $sql$
    select
      queryid::text as query_id,
      calls::bigint as call_count,
      round(mean_exec_time::numeric, 2) as mean_exec_time_ms,
      round(total_exec_time::numeric, 2) as total_exec_time_ms,
      left(regexp_replace(query, '\s+', ' ', 'g'), 220) as query_text
    from public.pg_stat_statements
    order by mean_exec_time desc
    limit 20
  $sql$;
end;
$$;

revoke all on function public.log_error_event(text, text, text, text, jsonb, uuid, uuid, text, text) from public;
grant execute on function public.log_error_event(text, text, text, text, jsonb, uuid, uuid, text, text) to authenticated, service_role;

revoke all on function public.log_ai_usage(uuid, uuid, text, integer, integer, integer, numeric, text, boolean, jsonb) from public;
grant execute on function public.log_ai_usage(uuid, uuid, text, integer, integer, integer, numeric, text, boolean, jsonb) to authenticated, service_role;

revoke all on function public.list_database_runtime_stats() from public;
grant execute on function public.list_database_runtime_stats() to authenticated, service_role;

revoke all on function public.list_database_table_stats() from public;
grant execute on function public.list_database_table_stats() to authenticated, service_role;

revoke all on function public.list_database_slow_queries() from public;
grant execute on function public.list_database_slow_queries() to authenticated, service_role;

insert into public.admin_documents (document_key, title, category, summary, current_version, effective_at)
values
  ('terms_of_service', 'Kullanim Sartlari', 'hukuki', 'Platform kullanim kosullari', 'v1.0', now()),
  ('privacy_policy', 'Gizlilik Politikasi', 'hukuki', 'Kisisel verilerin islenmesi ve korunmasi politikasi', 'v1.0', now()),
  ('kvkk_notice', 'KVKK Aydinlatma Metni', 'hukuki', 'Aydinlatma yukumlulugu metni', 'v1.0', now()),
  ('explicit_consent', 'Acik Riza Metni', 'hukuki', 'Acik riza ve yurt disi aktarim temeli', 'v1.0', now()),
  ('cookie_policy', 'Cerez Politikasi', 'hukuki', 'Web izleme ve cerez kullanimi politikasi', 'v1.0', now()),
  ('pilot_agreement_template', 'Pilot Mutabakat Sablonu', 'operasyon', 'Pilot proje mutabakat ve kabul sablonu', 'v1.0', now()),
  ('dpa_template', 'Veri Isleyen Sozlesmesi Sablonu', 'hukuki', 'Veri isleyen ve veri sorumlusu iliski sablonu', 'v1.0', now()),
  ('incident_response_runbook', 'Incident Response Runbook', 'operasyon', 'Guvenlik ve veri olaylarinda uygulanacak adimlar', 'v1.0', now()),
  ('architecture_document', 'ARCHITECTURE', 'teknik', 'Sistem mimarisi ve temel servis topolojisi', 'v1.0', now()),
  ('decisions_document', 'DECISIONS', 'teknik', 'Teknik ve urunsel mimari kararlar', 'v1.0', now()),
  ('disaster_recovery_plan', 'Disaster Recovery Plan', 'operasyon', 'Felaket kurtarma ve operasyonel geri donus plani', 'v1.0', now())
on conflict (document_key) do nothing;

insert into public.admin_document_versions (document_id, version, status, summary, content_markdown, effective_at)
select
  d.id,
  'v1.0',
  'published',
  d.summary,
  format('# %s\n\nBu belge icin ilk versiyon admin panelinde yayinlandi.\n\n## Kapsam\n\n- Belge tipi: %s\n- Ana baslik: %s\n- Yururluk tarihi: %s\n', d.title, d.category, d.title, to_char(now(), 'DD.MM.YYYY')),
  now()
from public.admin_documents d
where not exists (
  select 1
  from public.admin_document_versions v
  where v.document_id = d.id
    and v.version = 'v1.0'
);
