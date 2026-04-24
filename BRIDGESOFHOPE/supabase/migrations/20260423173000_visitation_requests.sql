create table if not exists public.visitation_requests (
  id text primary key,
  family_id uuid null,
  family_name text null,
  patient_id uuid null,
  patient_name text null,
  preferred_date date null,
  preferred_time text null,
  note text null,
  status text not null default 'Requested',
  confirmed_date date null,
  confirmed_time text null,
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visitation_requests_created_at_idx
  on public.visitation_requests (created_at desc);

create index if not exists visitation_requests_family_id_idx
  on public.visitation_requests (family_id);

alter table public.visitation_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_select_authenticated'
  ) then
    create policy visitation_requests_select_authenticated
      on public.visitation_requests
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_insert_authenticated'
  ) then
    create policy visitation_requests_insert_authenticated
      on public.visitation_requests
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_update_authenticated'
  ) then
    create policy visitation_requests_update_authenticated
      on public.visitation_requests
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;
