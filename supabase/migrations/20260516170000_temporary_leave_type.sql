-- Day pass / day off duration when program staff approves temporary discharge.

alter table public.patients
  add column if not exists temporary_leave_type text,
  add column if not exists temporary_discharge_until timestamptz;

alter table public.discharge_requests
  add column if not exists temporary_leave_type text;

comment on column public.patients.temporary_leave_type is
  'day_pass_8h | day_off_24h | day_off_3d — set on temporary discharge approval.';

comment on column public.patients.temporary_discharge_until is
  'When the approved temporary leave ends (from leave type duration).';
