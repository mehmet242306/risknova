begin;
create extension if not exists pgcrypto;
create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;
create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid references auth.users(id) on delete restrict,

  title text not null,
  reference_code text,
  status text not null default 'draft'
    check (status in ('draft', 'completed', 'archived')),

  assessment_date date not null,
  workplace_name text,
  department_name text,
  location_text text,
  activity_text text,
  notes text,

  method_version text not null default 'r-skor-v1',

  item_count integer not null default 0 check (item_count >= 0),
  overall_score numeric(10,4),
  overall_risk_level text
    check (overall_risk_level in ('low', 'medium', 'significant', 'high', 'critical')),
  highest_item_score numeric(10,4),
  highest_risk_level text
    check (highest_risk_level in ('low', 'medium', 'significant', 'high', 'critical')),

  ai_summary text,
  pdf_payload_version text,

  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_risk_assessments_organization_id
  on public.risk_assessments (organization_id);
create index if not exists idx_risk_assessments_assessment_date
  on public.risk_assessments (assessment_date desc);
create index if not exists idx_risk_assessments_status
  on public.risk_assessments (status);
create index if not exists idx_risk_assessments_overall_risk_level
  on public.risk_assessments (overall_risk_level);
create index if not exists idx_risk_assessments_created_at
  on public.risk_assessments (created_at desc);
drop trigger if exists trg_risk_assessments_set_updated_at on public.risk_assessments;
create trigger trg_risk_assessments_set_updated_at
before update on public.risk_assessments
for each row
execute function public.set_row_updated_at();
create table if not exists public.risk_assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,

  sort_order integer not null default 1 check (sort_order >= 1),

  hazard_title text not null,
  hazard_description text not null,
  activity_text text,
  location_text text,
  current_controls text,

  manual_probability smallint not null check (manual_probability between 1 and 5),
  manual_severity smallint not null check (manual_severity between 1 and 5),
  manual_exposure smallint not null check (manual_exposure between 1 and 5),

  gamma numeric(8,4) not null default 1.0000 check (gamma > 0 and gamma <= 5),

  c1 numeric(8,4) not null default 0 check (c1 >= 0 and c1 <= 1),
  c2 numeric(8,4) not null default 0 check (c2 >= 0 and c2 <= 1),
  c3 numeric(8,4) not null default 0 check (c3 >= 0 and c3 <= 1),
  c4 numeric(8,4) not null default 0 check (c4 >= 0 and c4 <= 1),
  c5 numeric(8,4) not null default 0 check (c5 >= 0 and c5 <= 1),
  c6 numeric(8,4) not null default 0 check (c6 >= 0 and c6 <= 1),
  c7 numeric(8,4) not null default 0 check (c7 >= 0 and c7 <= 1),
  c8 numeric(8,4) not null default 0 check (c8 >= 0 and c8 <= 1),
  c9 numeric(8,4) not null default 0 check (c9 >= 0 and c9 <= 1),

  weighted_context_score numeric(10,4),
  raw_score numeric(10,4),
  normalized_score numeric(10,4),
  risk_level text
    check (risk_level in ('low', 'medium', 'significant', 'high', 'critical')),

  ai_comment text,
  ai_actions jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_risk_assessment_items_assessment_id
  on public.risk_assessment_items (assessment_id);
create index if not exists idx_risk_assessment_items_organization_id
  on public.risk_assessment_items (organization_id);
create index if not exists idx_risk_assessment_items_risk_level
  on public.risk_assessment_items (risk_level);
create index if not exists idx_risk_assessment_items_sort_order
  on public.risk_assessment_items (assessment_id, sort_order);
drop trigger if exists trg_risk_assessment_items_set_updated_at on public.risk_assessment_items;
create trigger trg_risk_assessment_items_set_updated_at
before update on public.risk_assessment_items
for each row
execute function public.set_row_updated_at();
comment on table public.risk_assessments is 'Risk analysis master records for organization-scoped assessments.';
comment on table public.risk_assessment_items is 'Individual risk lines belonging to a risk assessment.';
commit;
