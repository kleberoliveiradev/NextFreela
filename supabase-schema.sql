-- NextFreela relational schema
-- Execute this file in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.nextfreela_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client text not null,
  due_date date not null,
  value numeric(12, 2) not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nextfreela_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.nextfreela_projects(id) on delete set null,
  title text not null,
  due_date date,
  week_day integer not null default 1 check (week_day between 1 and 7),
  priority text not null default 'normal',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nextfreela_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.nextfreela_projects(id) on delete set null,
  project_name text not null,
  client text not null,
  description text not null,
  due_date date not null,
  value numeric(12, 2) not null default 0,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nextfreela_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client text not null,
  project text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nextfreela_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.nextfreela_threads(id) on delete cascade,
  mine boolean not null default false,
  text text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.nextfreela_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.nextfreela_projects enable row level security;
alter table public.nextfreela_tasks enable row level security;
alter table public.nextfreela_payments enable row level security;
alter table public.nextfreela_threads enable row level security;
alter table public.nextfreela_messages enable row level security;
alter table public.nextfreela_alerts enable row level security;

alter table public.nextfreela_tasks add column if not exists due_date date;

drop policy if exists "projects owner access" on public.nextfreela_projects;
drop policy if exists "tasks owner access" on public.nextfreela_tasks;
drop policy if exists "payments owner access" on public.nextfreela_payments;
drop policy if exists "threads owner access" on public.nextfreela_threads;
drop policy if exists "messages owner access" on public.nextfreela_messages;
drop policy if exists "alerts owner access" on public.nextfreela_alerts;

create policy "projects owner access"
on public.nextfreela_projects
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tasks owner access"
on public.nextfreela_tasks
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "payments owner access"
on public.nextfreela_payments
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "threads owner access"
on public.nextfreela_threads
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "messages owner access"
on public.nextfreela_messages
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "alerts owner access"
on public.nextfreela_alerts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
