/*
  CLM weekly reports and incident log — shared with admin visibility via staff RLS.
  Used by the case load workspace; localStorage remains a client cache.
*/

create or replace function public.bh_is_internal_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(trim(coalesce(p.account_type::text, ''))) in (
        'admin',
        'nurse',
        'staff',
        'case_load_manager',
        'case manager',
        'case_manager'
      )
  );
$$;

grant execute on function public.bh_is_internal_staff() to authenticated;

create table if not exists public.clm_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  week_number text not null default '',
  social_case_study text,
  psychological_exam text,
  behavior_observation text,
  interventions text,
  accomplishments text,
  next_plan text,
  summary text not null,
  clm_name text,
  created_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now()
);

create index if not exists clm_weekly_reports_patient_id_idx
  on public.clm_weekly_reports (patient_id);

create index if not exists clm_weekly_reports_submitted_at_idx
  on public.clm_weekly_reports (submitted_at desc);

create table if not exists public.clm_incidents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  behavior_type text not null,
  severity text not null,
  intervention text not null,
  note text,
  clm_name text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists clm_incidents_patient_id_idx
  on public.clm_incidents (patient_id);

create index if not exists clm_incidents_created_at_idx
  on public.clm_incidents (created_at desc);

alter table public.clm_weekly_reports enable row level security;
alter table public.clm_incidents enable row level security;

drop policy if exists "clm_weekly_reports_select_staff" on public.clm_weekly_reports;
create policy "clm_weekly_reports_select_staff"
  on public.clm_weekly_reports
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "clm_weekly_reports_insert_staff" on public.clm_weekly_reports;
create policy "clm_weekly_reports_insert_staff"
  on public.clm_weekly_reports
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "clm_weekly_reports_update_staff" on public.clm_weekly_reports;
create policy "clm_weekly_reports_update_staff"
  on public.clm_weekly_reports
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());

drop policy if exists "clm_weekly_reports_delete_staff" on public.clm_weekly_reports;
create policy "clm_weekly_reports_delete_staff"
  on public.clm_weekly_reports
  for delete
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "clm_incidents_select_staff" on public.clm_incidents;
create policy "clm_incidents_select_staff"
  on public.clm_incidents
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "clm_incidents_insert_staff" on public.clm_incidents;
create policy "clm_incidents_insert_staff"
  on public.clm_incidents
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "clm_incidents_update_staff" on public.clm_incidents;
create policy "clm_incidents_update_staff"
  on public.clm_incidents
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());

drop policy if exists "clm_incidents_delete_staff" on public.clm_incidents;
create policy "clm_incidents_delete_staff"
  on public.clm_incidents
  for delete
  to authenticated
  using (public.bh_is_internal_staff());
