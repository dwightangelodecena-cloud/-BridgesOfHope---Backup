-- Room assignment + gender fields used by Resident Management and Admission Management.

alter table if exists public.patients
  add column if not exists gender text;

alter table if exists public.patients
  add column if not exists room_code text;

alter table if exists public.patients
  add column if not exists room_gender_segment text;

alter table if exists public.patients
  add column if not exists room_placement_note text;

alter table if exists public.patients
  add column if not exists risk_level text;

alter table if exists public.patients
  add column if not exists bunk_level text;

alter table if exists public.admission_requests
  add column if not exists patient_gender text;

comment on column public.patients.room_code is 'Assigned room label shown in admin and family apps.';
comment on column public.patients.room_gender_segment is 'Male or Female segment derived from resident gender for bed policy.';
