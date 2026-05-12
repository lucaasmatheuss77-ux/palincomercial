create extension if not exists pgcrypto;

create table if not exists public.ai_qualifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null default 'nao_avaliado',
  score numeric(5,2) not null default 0,
  source text default 'manual',
  summary text,
  collected_data jsonb not null default '{}'::jsonb,
  model_version text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (lead_id)
);

create table if not exists public.lead_stage_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commercial_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete set null,
  client_id uuid references public.clientes (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  meeting_id text,
  activity_type text not null default 'nota',
  subject text not null,
  agenda text,
  summary text,
  next_step text,
  next_contact_at timestamptz,
  status text not null default 'registrada',
  outcome text,
  consultant_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'ativa',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goal_targets (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  metric text not null,
  target_value numeric(14,2) not null default 0,
  scope_type text not null default 'team',
  profile_id uuid references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  weight numeric(8,2) not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  consultant_id uuid references public.profiles (id) on delete set null,
  contract_number text,
  status text not null default 'gerado',
  value numeric(14,2) not null default 0,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (deal_id)
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  origin_lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  company_name text,
  documento text,
  email text,
  phone text,
  whatsapp text,
  status_cliente text not null default 'lead',
  consultor_responsavel_id uuid references public.profiles (id) on delete set null,
  produto_foco_id uuid references public.products (id) on delete set null,
  active_contract_id uuid references public.contracts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (origin_lead_id)
);

alter table public.contracts
  add column if not exists client_id uuid references public.clientes (id) on delete set null;

alter table public.contracts
  add column if not exists start_at timestamptz;

alter table public.contracts
  add column if not exists end_at timestamptz;

alter table public.contracts
  add column if not exists pdf_bucket text;

alter table public.contracts
  add column if not exists pdf_path text;

alter table public.contracts
  add column if not exists pdf_file_name text;

alter table public.contracts
  add column if not exists pdf_mime_type text;

alter table public.contracts
  add column if not exists pdf_uploaded_at timestamptz;

alter table public.contracts
  add column if not exists cancellation_reason text;

alter table public.contracts
  alter column status set default 'pendente_assinatura';

alter table public.leads
  add column if not exists client_id uuid references public.clientes (id) on delete set null;

alter table public.goals
  add column if not exists name text default 'Meta legada',
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists status text not null default 'ativa',
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  client_id uuid references public.clientes (id) on delete set null,
  kind text not null default 'contract_pdf',
  bucket text,
  path text,
  file_name text,
  mime_type text,
  file_size bigint,
  version integer not null default 1,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_qualifications_lead_idx on public.ai_qualifications (lead_id);
create index if not exists lead_stage_events_lead_idx on public.lead_stage_events (lead_id, created_at desc);
create index if not exists commercial_activities_lead_idx on public.commercial_activities (lead_id, created_at desc);
create index if not exists commercial_activities_deal_idx on public.commercial_activities (deal_id, created_at desc);
create index if not exists commercial_activities_client_idx on public.commercial_activities (client_id, created_at desc);
create index if not exists commercial_activities_contract_idx on public.commercial_activities (contract_id, created_at desc);
create index if not exists commercial_activities_meeting_idx on public.commercial_activities (meeting_id, created_at desc);
create index if not exists commercial_activities_next_contact_idx on public.commercial_activities (next_contact_at, created_at desc);
create index if not exists goals_period_idx on public.goals (period_start, period_end, status);
create index if not exists goal_targets_goal_idx on public.goal_targets (goal_id, metric, scope_type);
create index if not exists contracts_deal_idx on public.contracts (deal_id);
create index if not exists contracts_lead_idx on public.contracts (lead_id);
create index if not exists contracts_client_idx on public.contracts (client_id);
create index if not exists contracts_status_idx on public.contracts (status);
create index if not exists clientes_origin_lead_idx on public.clientes (origin_lead_id);
create index if not exists clientes_documento_idx on public.clientes (documento) where documento is not null;
create index if not exists clientes_email_lower_idx on public.clientes (lower(email)) where email is not null;
create index if not exists clientes_status_idx on public.clientes (status_cliente);
create index if not exists contract_documents_contract_idx on public.contract_documents (contract_id, uploaded_at desc);
create index if not exists contract_documents_client_idx on public.contract_documents (client_id, uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ai_qualifications_set_updated_at on public.ai_qualifications;
create trigger ai_qualifications_set_updated_at
before update on public.ai_qualifications
for each row
execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row
execute function public.set_updated_at();

drop trigger if exists commercial_activities_set_updated_at on public.commercial_activities;
create trigger commercial_activities_set_updated_at
before update on public.commercial_activities
for each row
execute function public.set_updated_at();

drop trigger if exists goal_targets_set_updated_at on public.goal_targets;
create trigger goal_targets_set_updated_at
before update on public.goal_targets
for each row
execute function public.set_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
before update on public.contracts
for each row
execute function public.set_updated_at();

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
before update on public.clientes
for each row
execute function public.set_updated_at();

drop trigger if exists contract_documents_set_updated_at on public.contract_documents;
create trigger contract_documents_set_updated_at
before update on public.contract_documents
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.ai_qualifications to authenticated;
grant select, insert, update, delete on public.lead_stage_events to authenticated;
grant select, insert, update, delete on public.commercial_activities to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.goal_targets to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.contract_documents to authenticated;

alter table public.ai_qualifications enable row level security;
alter table public.lead_stage_events enable row level security;
alter table public.commercial_activities enable row level security;
alter table public.goals enable row level security;
alter table public.goal_targets enable row level security;
alter table public.contracts enable row level security;
alter table public.clientes enable row level security;
alter table public.contract_documents enable row level security;

drop policy if exists ai_qualifications_authenticated on public.ai_qualifications;
create policy ai_qualifications_authenticated on public.ai_qualifications
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists lead_stage_events_authenticated on public.lead_stage_events;
create policy lead_stage_events_authenticated on public.lead_stage_events
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists commercial_activities_authenticated on public.commercial_activities;
create policy commercial_activities_authenticated on public.commercial_activities
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists goals_authenticated on public.goals;
create policy goals_authenticated on public.goals
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists goal_targets_authenticated on public.goal_targets;
create policy goal_targets_authenticated on public.goal_targets
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists contracts_authenticated on public.contracts;
create policy contracts_authenticated on public.contracts
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists clientes_authenticated on public.clientes;
create policy clientes_authenticated on public.clientes
for all to authenticated
using (true)
with check (auth.uid() is not null);

drop policy if exists contract_documents_authenticated on public.contract_documents;
create policy contract_documents_authenticated on public.contract_documents
for all to authenticated
using (true)
with check (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('contract-pdfs', 'contract-pdfs', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'contract_pdfs_authenticated_select'
  ) then
    execute $policy$
      create policy contract_pdfs_authenticated_select on storage.objects
      for select to authenticated
      using (bucket_id = 'contract-pdfs')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'contract_pdfs_authenticated_insert'
  ) then
    execute $policy$
      create policy contract_pdfs_authenticated_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'contract-pdfs')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'contract_pdfs_authenticated_update'
  ) then
    execute $policy$
      create policy contract_pdfs_authenticated_update on storage.objects
      for update to authenticated
      using (bucket_id = 'contract-pdfs')
      with check (bucket_id = 'contract-pdfs')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'contract_pdfs_authenticated_delete'
  ) then
    execute $policy$
      create policy contract_pdfs_authenticated_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'contract-pdfs')
    $policy$;
  end if;
end
$$;
