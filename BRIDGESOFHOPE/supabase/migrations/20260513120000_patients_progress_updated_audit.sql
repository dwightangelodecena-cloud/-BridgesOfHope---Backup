-- Recovery ladder save updates these columns (see patient-database saveRecoveryLadderProgress).
-- Core schema only had progress_percent; add audit fields when missing.

alter table if exists public.patients
  add column if not exists progress_updated_at timestamptz;

alter table if exists public.patients
  add column if not exists progress_updated_by uuid references auth.users (id) on delete set null;

comment on column public.patients.progress_updated_at is 'Last time recovery ladder / progress_percent was saved from clinical UI.';
comment on column public.patients.progress_updated_by is 'Auth user who last updated recovery progress.';