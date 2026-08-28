-- Real FK-based staff assignment, alongside the existing free-text name columns
-- (`case_load_manager` / `program_staff` from 20260429120000). Name columns stay as-is
-- for backward compatibility with existing nurse/program name-matching filters; the new
-- ID columns back accurate active-caseload counts for the workload-based recommendation UI
-- and the inactivity sweep in 20260828150000_sweep_stale_assignments.sql.

alter table public.patients
  add column if not exists assigned_nurse_id uuid references public.profiles (id) on delete set null;

alter table public.patients
  add column if not exists assigned_program_staff_id uuid references public.profiles (id) on delete set null;

-- Anchors "last known activity" for the inactivity sweep when a newly-assigned staffer
-- has not yet authored any record for this patient (avoids immediately flagging a
-- brand-new assignment as stale).
alter table public.patients
  add column if not exists nurse_assigned_at timestamptz;

alter table public.patients
  add column if not exists program_staff_assigned_at timestamptz;

create index if not exists patients_assigned_nurse_id_idx
  on public.patients (assigned_nurse_id)
  where assigned_nurse_id is not null;

create index if not exists patients_assigned_program_staff_id_idx
  on public.patients (assigned_program_staff_id)
  where assigned_program_staff_id is not null;

comment on column public.patients.assigned_nurse_id is
  'FK to profiles(id) for the currently assigned nurse. Source of truth for workload counts; program_staff text column stays in sync for display/back-compat.';
comment on column public.patients.assigned_program_staff_id is
  'FK to profiles(id) for the currently assigned program/case-load staff. Source of truth for workload counts; case_load_manager text column stays in sync for display/back-compat.';
