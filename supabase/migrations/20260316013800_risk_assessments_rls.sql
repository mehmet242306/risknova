begin;
alter table public.risk_assessments enable row level security;
alter table public.risk_assessment_items enable row level security;
drop policy if exists "risk_assessments_select_own_org" on public.risk_assessments;
create policy "risk_assessments_select_own_org"
on public.risk_assessments
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);
drop policy if exists "risk_assessments_insert_own_org" on public.risk_assessments;
create policy "risk_assessments_insert_own_org"
on public.risk_assessments
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
);
drop policy if exists "risk_assessments_update_own_org" on public.risk_assessments;
create policy "risk_assessments_update_own_org"
on public.risk_assessments
for update
to authenticated
using (
  organization_id = public.current_organization_id()
)
with check (
  organization_id = public.current_organization_id()
);
drop policy if exists "risk_assessments_delete_own_org" on public.risk_assessments;
create policy "risk_assessments_delete_own_org"
on public.risk_assessments
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
);
drop policy if exists "risk_assessment_items_select_own_org" on public.risk_assessment_items;
create policy "risk_assessment_items_select_own_org"
on public.risk_assessment_items
for select
to authenticated
using (
  organization_id = public.current_organization_id()
);
drop policy if exists "risk_assessment_items_insert_own_org" on public.risk_assessment_items;
create policy "risk_assessment_items_insert_own_org"
on public.risk_assessment_items
for insert
to authenticated
with check (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.risk_assessments ra
    where ra.id = assessment_id
      and ra.organization_id = public.current_organization_id()
  )
);
drop policy if exists "risk_assessment_items_update_own_org" on public.risk_assessment_items;
create policy "risk_assessment_items_update_own_org"
on public.risk_assessment_items
for update
to authenticated
using (
  organization_id = public.current_organization_id()
)
with check (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.risk_assessments ra
    where ra.id = assessment_id
      and ra.organization_id = public.current_organization_id()
  )
);
drop policy if exists "risk_assessment_items_delete_own_org" on public.risk_assessment_items;
create policy "risk_assessment_items_delete_own_org"
on public.risk_assessment_items
for delete
to authenticated
using (
  organization_id = public.current_organization_id()
);
commit;
