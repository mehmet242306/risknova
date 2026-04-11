-- Auto-issue certificate when survey token is completed with passing score
-- Settings.auto_issue_certificate = true kontrolü yapılır

create or replace function public.auto_issue_certificate_on_completion()
returns trigger
language plpgsql
security definer
as $$
declare
  v_survey record;
  v_total_score numeric := 0;
  v_max_score numeric := 0;
  v_percentage numeric := 0;
  v_passed boolean := false;
  v_personnel record;
  v_cert_no text;
  v_template_id uuid;
  v_company_name text;
begin
  -- Sadece completed'a geçişlerde çalış
  if new.status != 'completed' or old.status = 'completed' then
    return new;
  end if;

  -- Survey bilgisini al
  select * into v_survey from public.surveys where id = new.survey_id;
  if v_survey is null then
    return new;
  end if;

  -- Sadece exam tipinde ve auto_issue_certificate=true olan survey'ler için
  if v_survey.type != 'exam' then
    return new;
  end if;

  if coalesce((v_survey.settings->>'auto_issue_certificate')::boolean, false) = false then
    return new;
  end if;

  -- Skor hesapla
  select
    coalesce(sum(case when sr.is_correct then sq.points else 0 end), 0),
    coalesce(sum(sq.points), 0)
  into v_total_score, v_max_score
  from public.survey_responses sr
  join public.survey_questions sq on sq.id = sr.question_id
  where sr.token_id = new.id;

  if v_max_score > 0 then
    v_percentage := (v_total_score / v_max_score) * 100;
  end if;

  -- Geçme puanı kontrolü
  v_passed := v_percentage >= coalesce(v_survey.pass_score, 70);
  if not v_passed then
    return new;
  end if;

  -- Personnel bilgisi
  if new.personnel_id is not null then
    select * into v_personnel from public.personnel where id = new.personnel_id;
  end if;

  -- Şirket adı
  if v_survey.company_id is not null then
    select coalesce(ci.official_name, cw.display_name) into v_company_name
    from public.company_workspaces cw
    left join public.company_identities ci on ci.id = cw.company_identity_id
    where cw.id = v_survey.company_id;
  end if;

  -- Sertifika şablonu (varsayılan)
  select id into v_template_id
  from public.certificate_templates
  where organization_id = v_survey.organization_id and is_system = true
  limit 1;

  -- Sertifika numarası: ORG-YEAR-SEQ
  v_cert_no := 'CERT-' || to_char(now(), 'YYYY') || '-' || upper(substring(gen_random_uuid()::text, 1, 8));

  -- Sertifikayı oluştur
  insert into public.certificates (
    template_id,
    organization_id,
    company_id,
    personnel_id,
    survey_id,
    token_id,
    certificate_no,
    person_name,
    training_name,
    training_date,
    trainer_name,
    company_name,
    score,
    issued_at,
    metadata
  )
  values (
    v_template_id,
    v_survey.organization_id,
    v_survey.company_id,
    new.personnel_id,
    new.survey_id,
    new.id,
    v_cert_no,
    coalesce(new.person_name,
             case when v_personnel is not null
                  then v_personnel.first_name || ' ' || v_personnel.last_name
                  else 'Katılımcı' end),
    v_survey.title,
    current_date,
    'Otomatik Sertifika',
    coalesce(v_company_name, 'Firma'),
    round(v_percentage, 1),
    now(),
    jsonb_build_object(
      'source', 'auto_issue',
      'pass_score', v_survey.pass_score,
      'raw_score', v_total_score,
      'max_score', v_max_score
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auto_issue_cert on public.survey_tokens;
create trigger trg_auto_issue_cert
  after update of status on public.survey_tokens
  for each row
  execute function public.auto_issue_certificate_on_completion();;
