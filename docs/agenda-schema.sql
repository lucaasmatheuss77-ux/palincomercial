create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_for timestamptz not null,
  ends_at timestamptz,
  location text,
  meeting_type text default 'Presencial',
  status text not null default 'agendada',
  objective text,
  notes text,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  requires_logistics boolean not null default false,
  manager_visibility boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  priority text not null default 'Media',
  status text not null default 'aberta',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meeting_logistics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'pendente',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists meetings_scheduled_for_idx on public.meetings (scheduled_for);
create index if not exists meetings_owner_profile_idx on public.meetings (owner_profile_id);
create index if not exists meeting_tasks_meeting_id_idx on public.meeting_tasks (meeting_id);
create index if not exists meeting_logistics_meeting_id_idx on public.meeting_logistics (meeting_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
before update on public.meetings
for each row
execute function public.set_updated_at();

drop trigger if exists meeting_tasks_set_updated_at on public.meeting_tasks;
create trigger meeting_tasks_set_updated_at
before update on public.meeting_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists meeting_logistics_set_updated_at on public.meeting_logistics;
create trigger meeting_logistics_set_updated_at
before update on public.meeting_logistics
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.meeting_tasks to authenticated;
grant select, insert, update, delete on public.meeting_logistics to authenticated;

alter table public.meetings enable row level security;
alter table public.meeting_tasks enable row level security;
alter table public.meeting_logistics enable row level security;

drop policy if exists meetings_select_authenticated on public.meetings;
create policy meetings_select_authenticated
on public.meetings
for select
to authenticated
using (true);

drop policy if exists meetings_insert_authenticated on public.meetings;
create policy meetings_insert_authenticated
on public.meetings
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists meetings_update_authenticated on public.meetings;
create policy meetings_update_authenticated
on public.meetings
for update
to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists meetings_delete_authenticated on public.meetings;
create policy meetings_delete_authenticated
on public.meetings
for delete
to authenticated
using (auth.uid() is not null);

drop policy if exists meeting_tasks_select_authenticated on public.meeting_tasks;
create policy meeting_tasks_select_authenticated
on public.meeting_tasks
for select
to authenticated
using (true);

drop policy if exists meeting_tasks_insert_authenticated on public.meeting_tasks;
create policy meeting_tasks_insert_authenticated
on public.meeting_tasks
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists meeting_tasks_update_authenticated on public.meeting_tasks;
create policy meeting_tasks_update_authenticated
on public.meeting_tasks
for update
to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists meeting_tasks_delete_authenticated on public.meeting_tasks;
create policy meeting_tasks_delete_authenticated
on public.meeting_tasks
for delete
to authenticated
using (auth.uid() is not null);

drop policy if exists meeting_logistics_select_authenticated on public.meeting_logistics;
create policy meeting_logistics_select_authenticated
on public.meeting_logistics
for select
to authenticated
using (true);

drop policy if exists meeting_logistics_insert_authenticated on public.meeting_logistics;
create policy meeting_logistics_insert_authenticated
on public.meeting_logistics
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists meeting_logistics_update_authenticated on public.meeting_logistics;
create policy meeting_logistics_update_authenticated
on public.meeting_logistics
for update
to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists meeting_logistics_delete_authenticated on public.meeting_logistics;
create policy meeting_logistics_delete_authenticated
on public.meeting_logistics
for delete
to authenticated
using (auth.uid() is not null);
