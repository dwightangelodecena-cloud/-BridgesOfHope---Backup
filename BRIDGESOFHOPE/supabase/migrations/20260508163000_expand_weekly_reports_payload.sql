-- Expand weekly_reports so nurse form content is persisted and visible in admin/family views.

alter table public.weekly_reports
  add column if not exists summary text,
  add column if not exists nurse_note text,
  add column if not exists notes text,
  add column if not exists behavior_observation text,
  add column if not exists recommendations text,
  add column if not exists progress_percent numeric,
  add column if not exists current_medications text,
  add column if not exists medication_intervention text,
  add column if not exists dietary_restrictions text,
  add column if not exists food_allergies text,
  add column if not exists nutrition_intervention text,
  add column if not exists ongoing_medical_concern text,
  add column if not exists upcoming_procedure_description text,
  add column if not exists upcoming_procedure_date text,
  add column if not exists vitals_weight text,
  add column if not exists vitals_height text,
  add column if not exists vitals_bmi text,
  add column if not exists vitals_bp text,
  add column if not exists vitals_pr text,
  add column if not exists vitals_rr text,
  add column if not exists vitals_spo2 text,
  add column if not exists vitals_temperature text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists weekly_reports_week_number_idx on public.weekly_reports (week_number);
