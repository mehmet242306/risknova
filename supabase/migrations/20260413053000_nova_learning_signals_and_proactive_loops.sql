create table if not exists public.nova_learning_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  query_id uuid references public.solution_queries(id) on delete set null,
  workflow_run_id uuid references public.nova_workflow_runs(id) on delete set null,
  signal_source text not null check (signal_source in ('feedback', 'workflow', 'memory', 'suggestion')),
  signal_key text not null,
  signal_label text not null,
  outcome text not null check (outcome in ('positive', 'neutral', 'negative')),
  confidence_score numeric(3,2) not null default 0.75,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.nova_learning_signals is 'Nova ogrendiklerini, geri bildirimleri ve workflow sonuc sinyallerini denetlenebilir sekilde kaydeder';

create index if not exists idx_nova_learning_signals_user
  on public.nova_learning_signals(user_id, created_at desc);

create index if not exists idx_nova_learning_signals_workspace
  on public.nova_learning_signals(organization_id, company_workspace_id, created_at desc);

create index if not exists idx_nova_learning_signals_key
  on public.nova_learning_signals(signal_key, outcome, created_at desc);

alter table public.nova_learning_signals enable row level security;

drop policy if exists "Users can read own Nova learning signals" on public.nova_learning_signals;
create policy "Users can read own Nova learning signals"
  on public.nova_learning_signals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova learning signals" on public.nova_learning_signals;
create policy "Users can insert own Nova learning signals"
  on public.nova_learning_signals for insert
  with check (auth.uid() = user_id);

create or replace function public.record_nova_feedback(
  p_query_id uuid,
  p_feedback text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query public.solution_queries%rowtype;
  v_feedback text := case when p_feedback in ('positive', 'negative') then p_feedback else 'positive' end;
  v_existing_qa_id uuid;
  v_company_workspace_id uuid;
begin
  select *
    into v_query
    from public.solution_queries
   where id = p_query_id
     and user_id = auth.uid();

  if v_query.id is null then
    raise exception 'Nova sorgu kaydi bulunamadi';
  end if;

  v_company_workspace_id := nullif(v_query.response_metadata->>'company_workspace_id', '')::uuid;

  insert into public.nova_feedback (
    user_id,
    organization_id,
    query_id,
    session_id,
    feedback,
    comment,
    language
  ) values (
    auth.uid(),
    v_query.organization_id,
    v_query.id,
    coalesce(v_query.response_metadata->>'session_id', null),
    v_feedback,
    nullif(trim(coalesce(p_comment, '')), ''),
    coalesce(v_query.response_metadata->>'language', 'tr')
  )
  on conflict (user_id, query_id)
  do update set
    feedback = excluded.feedback,
    comment = excluded.comment,
    language = excluded.language,
    updated_at = now();

  insert into public.nova_learning_signals (
    user_id,
    organization_id,
    company_workspace_id,
    query_id,
    signal_source,
    signal_key,
    signal_label,
    outcome,
    confidence_score,
    payload
  ) values (
    auth.uid(),
    v_query.organization_id,
    v_company_workspace_id,
    v_query.id,
    'feedback',
    format('feedback:%s', v_feedback),
    case
      when v_feedback = 'positive' then 'Kullanici cevabi yararli buldu'
      else 'Kullanici cevabi eksik buldu'
    end,
    case when v_feedback = 'positive' then 'positive' else 'negative' end,
    case when v_feedback = 'positive' then 0.92 else 0.88 end,
    jsonb_build_object(
      'query_text', left(coalesce(v_query.query_text, ''), 500),
      'response_preview', left(coalesce(v_query.ai_response, ''), 500),
      'comment', nullif(trim(coalesce(p_comment, '')), ''),
      'session_id', coalesce(v_query.response_metadata->>'session_id', null)
    )
  );

  select id
    into v_existing_qa_id
    from public.ai_qa_learning
   where question = v_query.query_text
     and answer = v_query.ai_response
   order by created_at desc
   limit 1;

  if v_existing_qa_id is null then
    insert into public.ai_qa_learning (
      question,
      answer,
      answer_sources,
      user_feedback_score,
      usage_count,
      success_rate
    ) values (
      v_query.query_text,
      v_query.ai_response,
      coalesce(v_query.sources_used, '[]'::jsonb),
      case when v_feedback = 'positive' then 1 else 0 end,
      1,
      case when v_feedback = 'positive' then 0.8 else 0.2 end
    );
  else
    update public.ai_qa_learning
       set user_feedback_score = case when v_feedback = 'positive' then 1 else 0 end,
           usage_count = coalesce(usage_count, 0) + 1,
           success_rate = case
             when v_feedback = 'positive' then least(1, greatest(coalesce(success_rate, 0), 0.8))
             else greatest(0, least(coalesce(success_rate, 0.5), 0.35))
           end,
           updated_at = now()
     where id = v_existing_qa_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'query_id', v_query.id,
    'feedback', v_feedback
  );
end;
$$;

grant execute on function public.record_nova_feedback(uuid, text, text) to authenticated;

create or replace function public.update_nova_workflow_step(
  p_step_id uuid,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step record;
  v_run record;
  v_next_step record;
  v_status text := case
    when p_status in ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')
      then p_status
    else 'completed'
  end;
  v_remaining_count integer := 0;
  v_completed_count integer := 0;
begin
  select s.id,
         s.workflow_run_id,
         s.step_order,
         s.title,
         s.target_url,
         s.prompt_text,
         s.action_kind,
         r.user_id,
         r.organization_id,
         r.company_workspace_id,
         r.query_id,
         r.workflow_type,
         r.title as workflow_title,
         r.status as workflow_status
    into v_step
    from public.nova_workflow_steps s
    join public.nova_workflow_runs r on r.id = s.workflow_run_id
   where s.id = p_step_id
     and r.user_id = auth.uid();

  if v_step.id is null then
    raise exception 'Nova workflow adimi bulunamadi';
  end if;

  update public.nova_workflow_steps
     set status = v_status,
         completed_at = case
           when v_status in ('completed', 'skipped', 'cancelled') then now()
           else null
         end,
         updated_at = now()
   where id = p_step_id;

  select count(*)
    into v_remaining_count
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('pending', 'in_progress');

  select count(*)
    into v_completed_count
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('completed', 'skipped', 'cancelled');

  select step_order,
         id,
         title,
         description,
         target_url,
         prompt_text,
         action_kind,
         status
    into v_next_step
    from public.nova_workflow_steps
   where workflow_run_id = v_step.workflow_run_id
     and status in ('pending', 'in_progress')
   order by step_order asc
   limit 1;

  update public.nova_workflow_runs
     set status = case
           when v_remaining_count = 0 then
             case
               when v_status = 'cancelled' then 'cancelled'
               else 'completed'
             end
           else 'active'
         end,
         current_step = coalesce(v_next_step.step_order, greatest(v_completed_count, 1)),
         completed_at = case when v_remaining_count = 0 then now() else null end,
         updated_at = now()
   where id = v_step.workflow_run_id;

  select id,
         organization_id,
         company_workspace_id,
         query_id,
         workflow_type,
         title,
         summary,
         status,
         current_step,
         total_steps
    into v_run
    from public.nova_workflow_runs
   where id = v_step.workflow_run_id;

  insert into public.nova_learning_signals (
    user_id,
    organization_id,
    company_workspace_id,
    query_id,
    workflow_run_id,
    signal_source,
    signal_key,
    signal_label,
    outcome,
    confidence_score,
    payload
  ) values (
    auth.uid(),
    v_run.organization_id,
    v_run.company_workspace_id,
    v_run.query_id,
    v_run.id,
    'workflow',
    format('workflow-step:%s', coalesce(v_step.workflow_type, 'general')),
    format('%s -> %s', v_run.title, v_step.title),
    case
      when v_status = 'cancelled' then 'negative'
      when v_remaining_count = 0 then 'positive'
      else 'neutral'
    end,
    case
      when v_status = 'cancelled' then 0.65
      when v_remaining_count = 0 then 0.9
      else 0.72
    end,
    jsonb_build_object(
      'completed_step_id', v_step.id,
      'completed_step_title', v_step.title,
      'step_status', v_status,
      'workflow_status', v_run.status,
      'next_step_title', coalesce(v_next_step.title, null)
    )
  );

  return jsonb_build_object(
    'success', true,
    'workflow_run_id', v_run.id,
    'workflow_title', v_run.title,
    'workflow_status', v_run.status,
    'current_step', v_run.current_step,
    'total_steps', v_run.total_steps,
    'completed_step_id', v_step.id,
    'completed_step_title', v_step.title,
    'next_step', case
      when v_next_step.step_order is null then null
      else jsonb_build_object(
        'id', v_next_step.id,
        'step_order', v_next_step.step_order,
        'title', v_next_step.title,
        'description', v_next_step.description,
        'target_url', v_next_step.target_url,
        'prompt_text', v_next_step.prompt_text,
        'action_kind', v_next_step.action_kind,
        'status', v_next_step.status
      )
    end
  );
end;
$$;

grant execute on function public.update_nova_workflow_step(uuid, text) to authenticated;
