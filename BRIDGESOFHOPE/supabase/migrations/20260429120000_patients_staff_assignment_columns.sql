-- Staff assignment fields used by Admin Patient Management and CLM caseload resolution.
-- Fails if public.patients is missing; add only if your project already has that table.

alter table public.patients
  add column if not exists case_load_manager text;

alter table public.patients
  add column if not exists program_staff text;

alter table public.patients
  add column if not exists medical_staff_note text;
