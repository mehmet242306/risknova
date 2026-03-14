create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null default 'organization',
  tax_number text,
  country text not null default 'TR',
  city text,
  address text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  full_name text,
  title text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.user_profiles(id) on delete set null,
  constraint user_roles_unique unique (user_profile_id, role_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_profile_id uuid references public.user_profiles(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  severity text not null default 'info',
  metadata_json jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_org_id on public.user_profiles(organization_id);
create index if not exists idx_user_profiles_auth_user_id on public.user_profiles(auth_user_id);
create index if not exists idx_user_roles_user_profile_id on public.user_roles(user_profile_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);
create index if not exists idx_audit_logs_org_id on public.audit_logs(organization_id);
create index if not exists idx_audit_logs_actor_user_profile_id on public.audit_logs(actor_user_profile_id);
create index if not exists idx_audit_logs_action_type on public.audit_logs(action_type);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

insert into public.roles (code, name, description)
values
  ('super_admin', 'Super Admin', 'Platform owner role'),
  ('platform_admin', 'Platform Admin', 'Platform-level admin role'),
  ('organization_admin', 'Organization Admin', 'Organization-level admin role'),
  ('osgb_manager', 'OSGB Manager', 'OSGB manager role'),
  ('ohs_specialist', 'OHS Specialist', 'Occupational health and safety specialist'),
  ('workplace_physician', 'Workplace Physician', 'Workplace physician role'),
  ('dsp', 'DSP', 'Other health personnel'),
  ('viewer', 'Viewer', 'Read-only role')
on conflict (code) do nothing;
