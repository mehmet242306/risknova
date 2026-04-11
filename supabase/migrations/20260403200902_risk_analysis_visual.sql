-- Risk Analysis Visual: görseller, tespitler, satırlar

alter table public.risk_assessments
  add column if not exists company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  add column if not exists method text not null default 'r_skor'
    check (method in ('r_skor', 'fine_kinney', 'l_matrix')),
  add column if not exists participants jsonb not null default '[]'::jsonb,
  add column if not exists analysis_note text;

create index if not exists idx_risk_assessments_company_workspace_id
  on public.risk_assessments (company_workspace_id);

create table if not exists public.risk_assessment_rows (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sort_order integer not null default 1 check (sort_order >= 1),
  title text not null,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_risk_assessment_rows_assessment_id
  on public.risk_assessment_rows (assessment_id);

drop trigger if exists trg_risk_assessment_rows_set_updated_at on public.risk_assessment_rows;
create trigger trg_risk_assessment_rows_set_updated_at
before update on public.risk_assessment_rows
for each row execute function public.set_row_updated_at();

create table if not exists public.risk_assessment_images (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  row_id uuid not null references public.risk_assessment_rows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_risk_assessment_images_row_id
  on public.risk_assessment_images (row_id);

create index if not exists idx_risk_assessment_images_assessment_id
  on public.risk_assessment_images (assessment_id);

create table if not exists public.risk_assessment_findings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  row_id uuid not null references public.risk_assessment_rows(id) on delete cascade,
  image_id uuid not null references public.risk_assessment_images(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric(4,2) not null default 0.85,
  is_manual boolean not null default false,
  corrective_action_required boolean not null default false,
  recommendation text,
  action_text text,
  r2d_values jsonb not null default '{}'::jsonb,
  r2d_result jsonb,
  fk_values jsonb not null default '{"likelihood":1,"severity":1,"exposure":1}'::jsonb,
  fk_result jsonb,
  matrix_values jsonb not null default '{"likelihood":1,"severity":1}'::jsonb,
  matrix_result jsonb,
  annotations jsonb not null default '[]'::jsonb,
  legal_references jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_risk_assessment_findings_row_id on public.risk_assessment_findings (row_id);
create index if not exists idx_risk_assessment_findings_image_id on public.risk_assessment_findings (image_id);
create index if not exists idx_risk_assessment_findings_assessment_id on public.risk_assessment_findings (assessment_id);
create index if not exists idx_risk_assessment_findings_severity on public.risk_assessment_findings (severity);

drop trigger if exists trg_risk_assessment_findings_set_updated_at on public.risk_assessment_findings;
create trigger trg_risk_assessment_findings_set_updated_at
before update on public.risk_assessment_findings
for each row execute function public.set_row_updated_at();

alter table public.risk_assessment_rows enable row level security;
alter table public.risk_assessment_images enable row level security;
alter table public.risk_assessment_findings enable row level security;

create policy "Users can view their org rows" on public.risk_assessment_rows for select using (organization_id = public.current_organization_id());
create policy "Users can insert their org rows" on public.risk_assessment_rows for insert with check (organization_id = public.current_organization_id());
create policy "Users can update their org rows" on public.risk_assessment_rows for update using (organization_id = public.current_organization_id());
create policy "Users can delete their org rows" on public.risk_assessment_rows for delete using (organization_id = public.current_organization_id());

create policy "Users can view their org images" on public.risk_assessment_images for select using (organization_id = public.current_organization_id());
create policy "Users can insert their org images" on public.risk_assessment_images for insert with check (organization_id = public.current_organization_id());
create policy "Users can update their org images" on public.risk_assessment_images for update using (organization_id = public.current_organization_id());
create policy "Users can delete their org images" on public.risk_assessment_images for delete using (organization_id = public.current_organization_id());

create policy "Users can view their org findings" on public.risk_assessment_findings for select using (organization_id = public.current_organization_id());
create policy "Users can insert their org findings" on public.risk_assessment_findings for insert with check (organization_id = public.current_organization_id());
create policy "Users can update their org findings" on public.risk_assessment_findings for update using (organization_id = public.current_organization_id());
create policy "Users can delete their org findings" on public.risk_assessment_findings for delete using (organization_id = public.current_organization_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('risk-images', 'risk-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Users can upload risk images" on storage.objects for insert with check (bucket_id = 'risk-images' and auth.role() = 'authenticated');
create policy "Users can view risk images" on storage.objects for select using (bucket_id = 'risk-images' and auth.role() = 'authenticated');
create policy "Users can delete risk images" on storage.objects for delete using (bucket_id = 'risk-images' and auth.role() = 'authenticated');;
