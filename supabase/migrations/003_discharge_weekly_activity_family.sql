-- Extend discharge request detail fields; weekly reports; family-visible activity log
-- Run after 001_core_schema.sql (and 002 if present)

-- ---------------------------------------------------------------------------
-- discharge_requests: mirror family discharge form + contact fields for admin UI
-- ---------------------------------------------------------------------------
alter table public.discharge_requests
  add column if not exists reason_category text,
  add column if not exists reason_details text,
  add column if not exists preferred_discharge_date date,
  add column if not exists pickup_authorized text,
  add column if not exists follow_up_phone text,
  add column if not exists other_info text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_email text;

-- ---------------------------------------------------------------------------
-- activity_log: optional family_id so families can read relevant rows (RLS)
-- ---------------------------------------------------------------------------
alter table public.activity_log
  add column if not exists family_id uuid references public.profiles (id) on delete set null;

-- Family can see activity tied to them or authored by them
drop policy if exists "activity_family_select" on public.activity_log;
create policy "activity_family_select"
  on public.activity_log for select
  using (
    family_id = auth.uid ()
    or actor_id = auth.uid ()
  );

-- Family can insert their own activity rows (actor must be self)
drop policy if exists "activity_family_insert" on public.activity_log;
create policy "activity_family_insert"
  on public.activity_log for insert
  with check (actor_id = auth.uid ());

-- Staff inserts may set family_id for another family (keep existing staff insert;
-- 001 requires nurse/admin — widen staff insert to also allow setting family_id)
-- (Existing policy already allows staff insert; columns are optional.)

-- ---------------------------------------------------------------------------
-- weekly_reports: nurse filings; family can read for their patients
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid (),
  patient_id uuid not null references public.patients (id) on delete cascade,
  week_number int not null check (week_number >= 1 and week_number <= 7),
  nurse_name text,
  report_date text,
  submitted_at timestamptz not null default now (),
  created_by uuid references public.profiles (id) on delete set null,
  unique (patient_id, week_number)
);

create index if not exists weekly_reports_patient_id_idx on public.weekly_reports (patient_id);
create index if not exists weekly_reports_submitted_at_idx on public.weekly_reports (submitted_at desc);

alter table public.weekly_reports enable row level security;

drop policy if exists "weekly_reports_family_select" on public.weekly_reports;
create policy "weekly_reports_family_select"
  on public.weekly_reports for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = weekly_reports.patient_id
        and p.family_id = auth.uid ()
    )
  );

drop policy if exists "weekly_reports_staff_all" on public.weekly_reports;
create policy "weekly_reports_staff_all"
  on public.weekly_reports for all
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid ()
        and pr.account_type in ('nurse', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid ()
        and pr.account_type in ('nurse', 'admin')
    )
  );
