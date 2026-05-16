-- Track approved temporary leave on residents; store staff comments on discharge requests.

alter table public.patients
  add column if not exists temporary_discharge_at timestamptz,
  add column if not exists temporary_discharge_expected_return date;

comment on column public.patients.temporary_discharge_at is
  'Set when a temporary family discharge request is approved; cleared on return/readmit or permanent discharge.';

alter table public.discharge_requests
  add column if not exists decision_note text;

comment on column public.discharge_requests.decision_note is
  'Program or admin comment when approving or declining the request.';
