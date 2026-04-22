-- =============================================================================
-- İş 4 — Güvenlik Sertleştirme
-- =============================================================================
-- 4 alt iş tek migration'da:
--   (a) scan_session_stats view → SECURITY INVOKER (Advisor ERROR)
--   (b) using(true) / with check(true) RLS policy'leri admin-sphere tablolarda
--       authenticated-only filter'a çevir (10 policy, 7 tablo).
--       Kasıtlı public kullanım olan tablolar (surveys, slide_deck_sessions,
--       slide_view_events, survey_*) dokunulmadı — anket token/public viewing
--       akışı var.
--   (c) 4 "public bucket" storage objesi SELECT policy'sini authenticated
--       kullanıcıyla kısıtla (anonim listing kapanır; imzalı URL erişimi
--       etkilenmez). Zaten authenticated-only olan 2 bucket atlanır.
--   (d) 19 search_path mutable fonksiyona SET search_path = public ekle.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (a) scan_session_stats — SECURITY DEFINER kaldırıldı (SECURITY INVOKER varsayılanı)
-- ---------------------------------------------------------------------------
alter view public.scan_session_stats set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- (b) using(true) policy'leri daralt (admin-sphere tablolarda)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can insert cache" on public.ai_qa_learning;
create policy "Authenticated users can insert cache" on public.ai_qa_learning
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update cache" on public.ai_qa_learning;
create policy "Authenticated users can update cache" on public.ai_qa_learning
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "cert_templates_delete" on public.certificate_templates;
create policy "cert_templates_delete" on public.certificate_templates
  for delete to authenticated using (auth.uid() is not null);

drop policy if exists "cert_templates_insert" on public.certificate_templates;
create policy "cert_templates_insert" on public.certificate_templates
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "cert_templates_update" on public.certificate_templates;
create policy "cert_templates_update" on public.certificate_templates
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "certificates_insert" on public.certificates;
create policy "certificates_insert" on public.certificates
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "certificates_update" on public.certificates;
create policy "certificates_update" on public.certificates
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "meetings_insert" on public.company_committee_meetings;
create policy "meetings_insert" on public.company_committee_meetings
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "controls_insert" on public.company_periodic_controls;
create policy "controls_insert" on public.company_periodic_controls
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "attendees_insert" on public.company_training_attendees;
create policy "attendees_insert" on public.company_training_attendees
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "trainings_insert" on public.company_trainings;
create policy "trainings_insert" on public.company_trainings
  for insert to authenticated with check (auth.uid() is not null);

-- Not: surveys, survey_questions, survey_responses, survey_tokens,
-- slide_deck_sessions, slide_view_events tabloları dokunulmadı — bu tablolar
-- anket token akışı ve public slide viewing için kasıtlı "USING (true)"
-- tutuyor. Gelecek turda token-based scoping ile yeniden değerlendirilmeli.

-- ---------------------------------------------------------------------------
-- (c) Public bucket listing daraltma — anon okuma kapatılır, authenticated kalır
-- ---------------------------------------------------------------------------
drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "Anyone can view company logos" on storage.objects;
create policy "Anyone can view company logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'company-logos' and auth.uid() is not null);

drop policy if exists "Public read documents" on storage.objects;
create policy "Public read documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "slide_media_select" on storage.objects;
create policy "slide_media_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'slide-media' and auth.uid() is not null);

-- Not: "Authenticated users can read scan images" ve "Authenticated users can
-- read voice notes" policy'leri zaten to authenticated tanımlı — atlandı.

-- ---------------------------------------------------------------------------
-- (d) search_path mutable fonksiyonlara SET search_path = public
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'auto_issue_certificate_on_completion',
        'block_company_invitation_permissions_mutation',
        'normalize_email',
        'resolve_audit_user_id',
        'set_workspace_slug',
        'resolve_audit_tenant_id',
        'update_deck_slide_count',
        'resolve_audit_org_id',
        'generate_company_code',
        'nova_workspaces_touch_updated_at',
        'validate_company_member_module_permission_identity',
        'guard_company_invitation_status_transition',
        'create_photogrammetry_job_on_scan_complete',
        'slugify_tr',
        'touch_updated_at_generic',
        'update_updated_at_column',
        'current_user_org_id',
        'generate_company_join_request_code'
      )
      and (
        p.proconfig is null
        or not exists (
          select 1 from unnest(p.proconfig) c
          where c like 'search_path=%'
        )
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
