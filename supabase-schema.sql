-- NextFreela cloud state
-- Execute este arquivo no SQL Editor do Supabase.

create table if not exists public.nextfreela_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.nextfreela_states enable row level security;

drop policy if exists "Users can read their own NextFreela state" on public.nextfreela_states;
drop policy if exists "Users can insert their own NextFreela state" on public.nextfreela_states;
drop policy if exists "Users can update their own NextFreela state" on public.nextfreela_states;
drop policy if exists "Users can delete their own NextFreela state" on public.nextfreela_states;

create policy "Users can read their own NextFreela state"
on public.nextfreela_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own NextFreela state"
on public.nextfreela_states
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own NextFreela state"
on public.nextfreela_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own NextFreela state"
on public.nextfreela_states
for delete
to authenticated
using (auth.uid() = user_id);
