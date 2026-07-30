-- Pre-admission medical assessment: nurse-recorded vitals + a short eligibility note, visible to
-- the guardian while the request is still pending (before admin accepts/rejects). Reuses the exact
-- same vitals field set/naming already used by weekly_reports (vitals_weight, vitals_height,
-- vitals_bmi, vitals_bp, vitals_pr, vitals_rr, vitals_temperature, vitals_spo2), entered today via
-- nurse/medical-report.jsx's "BMI / Weight / Vital Signs" section.
--
-- No RLS changes needed: admission_requests already grants staff (nurse/admin) SELECT-all and
-- UPDATE-all, and guardians already have row-level SELECT on their own request — these new columns
-- inherit both automatically.

alter table public.admission_requests
  add column if not exists vitals_weight text,
  add column if not exists vitals_height text,
  add column if not exists vitals_bmi text,
  add column if not exists vitals_bp text,
  add column if not exists vitals_pr text,
  add column if not exists vitals_rr text,
  add column if not exists vitals_temperature text,
  add column if not exists vitals_spo2 text,
  add column if not exists vitals_recorded_at timestamptz,
  add column if not exists vitals_recorded_by uuid references auth.users (id) on delete set null,
  add column if not exists pre_admission_summary text,
  add column if not exists pre_admission_summary_updated_at timestamptz,
  add column if not exists pre_admission_summary_updated_by uuid references auth.users (id) on delete set null;

comment on column public.admission_requests.pre_admission_summary is
  'Nurse''s short eligibility conclusion accompanying the vitals (e.g. "Vitals within normal range, cleared for admission"). Guardian-visible alongside the vitals once saved.';

insert into public.notification_templates (template_key, title, body, description) values
  (
    'pre_admission_summary_ready',
    'Pre-Admission Medical Summary Available',
    'A pre-admission medical summary for {{patient_name}}''s request is now available to view.',
    'Sent when a nurse records/updates the pre-admission vitals + assessment note for a pending admission request. Variables: {{patient_name}}'
  )
on conflict (template_key) do nothing;
