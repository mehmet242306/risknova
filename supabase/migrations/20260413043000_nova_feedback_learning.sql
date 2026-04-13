create table if not exists public.nova_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  query_id uuid not null references public.solution_queries(id) on delete cascade,
  session_id text,
  feedback text not null check (feedback in ('positive', 'negative')),
  comment text,
  language text not null default 'tr' check (language in ('tr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nova_feedback is 'Nova cevaplari icin kullanici geri bildirimi ve ogrenme kayitlari';

create unique index if not exists idx_nova_feedback_unique_user_query
  on public.nova_feedback(user_id, query_id);

create index if not exists idx_nova_feedback_org_created
  on public.nova_feedback(organization_id, created_at desc);

alter table public.nova_feedback enable row level security;

drop policy if exists "Users can read own Nova feedback" on public.nova_feedback;
create policy "Users can read own Nova feedback"
  on public.nova_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova feedback" on public.nova_feedback;
create policy "Users can insert own Nova feedback"
  on public.nova_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova feedback" on public.nova_feedback;
create policy "Users can update own Nova feedback"
  on public.nova_feedback for update
  using (auth.uid() = user_id);

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
begin
  select *
    into v_query
    from public.solution_queries
   where id = p_query_id
     and user_id = auth.uid();

  if v_query.id is null then
    raise exception 'Nova sorgu kaydi bulunamadi';
  end if;

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
