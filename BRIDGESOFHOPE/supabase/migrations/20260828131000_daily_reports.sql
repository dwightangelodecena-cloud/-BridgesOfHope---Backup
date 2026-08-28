-- New nurse/program-only "Daily Report" entity. Weekly reports (public.weekly_reports) stay
-- the family-facing layer (unchanged) — daily reports are the granular staff-only record they
-- get compiled from. One row per (patient, day, author) so a nurse and a program staff member
-- can both log the same day without clobbering each other, upserted like weekly_reports is.

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  report_date date not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_role text,
  observations text,
  assessment text,
  follow_up text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, report_date, author_id)
);

create index if not exists daily_reports_patient_date_idx
  on public.daily_reports (patient_id, report_date);

comment on table public.daily_reports is
  'Nurse/program-only per-day patient notes. Visible only to internal staff (bh_is_internal_staff) — never exposed to family, unlike weekly_reports.';

alter table public.daily_reports enable row level security;

drop policy if exists "daily_reports_select_internal_staff" on public.daily_reports;
create policy "daily_reports_select_internal_staff"
  on public.daily_reports
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "daily_reports_insert_internal_staff" on public.daily_reports;
create policy "daily_reports_insert_internal_staff"
  on public.daily_reports
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "daily_reports_update_internal_staff" on public.daily_reports;
create policy "daily_reports_update_internal_staff"
  on public.daily_reports
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());

grant select, insert, update on public.daily_reports to authenticated;
