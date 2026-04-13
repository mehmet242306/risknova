create table if not exists public.nova_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_workspace_id uuid references public.company_workspaces(id) on delete set null,
  memory_type text not null check (memory_type in ('user_preference', 'company_pattern', 'working_style', 'operational_note')),
  title text not null,
  memory_text text not null,
  language text default 'tr' check (language in ('tr', 'en')),
  confidence_score numeric(3,2) not null default 0.70,
  is_active boolean not null default true,
  source_query_id uuid references public.solution_queries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

comment on table public.nova_memories is 'Nova tarafindan kullanici tercihi ve operasyon kaliplari icin tutulan denetlenebilir hafiza kayitlari';

create index if not exists idx_nova_memories_user on public.nova_memories(user_id, is_active, last_used_at desc);
create index if not exists idx_nova_memories_org on public.nova_memories(organization_id, company_workspace_id, is_active);
create index if not exists idx_nova_memories_type on public.nova_memories(memory_type, language);

alter table public.nova_memories enable row level security;

drop policy if exists "Users can read own Nova memories" on public.nova_memories;
create policy "Users can read own Nova memories"
  on public.nova_memories for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Nova memories" on public.nova_memories;
create policy "Users can insert own Nova memories"
  on public.nova_memories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own Nova memories" on public.nova_memories;
create policy "Users can update own Nova memories"
  on public.nova_memories for update
  using (auth.uid() = user_id);

create or replace function public.touch_nova_memory(p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nova_memories
     set last_used_at = now(),
         updated_at = now()
   where id = p_memory_id
     and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_nova_memory(uuid) to authenticated;
