-- Backfill patient vitals from latest weekly report per patient.
-- Run via Supabase migration so Family/Admin views can show existing vitals immediately.
with latest_report as (
  select distinct on (wr.patient_id)
    wr.patient_id,
    wr.vitals_weight,
    wr.vitals_height,
    wr.vitals_bmi,
    wr.vitals_bp,
    wr.vitals_pr,
    wr.vitals_rr,
    wr.vitals_spo2,
    wr.vitals_temperature
  from public.weekly_reports wr
  where wr.patient_id is not null
  order by wr.patient_id, wr.submitted_at desc nulls last, wr.created_at desc nulls last, wr.week_number desc
)
update public.patients p
set
  current_weight = coalesce(lr.vitals_weight, p.current_weight),
  weight_kg = coalesce(lr.vitals_weight, p.weight_kg),
  height_cm = coalesce(lr.vitals_height, p.height_cm),
  bmi = coalesce(lr.vitals_bmi, p.bmi),
  bp = coalesce(lr.vitals_bp, p.bp),
  pr = coalesce(lr.vitals_pr, p.pr),
  rr = coalesce(lr.vitals_rr, p.rr),
  spo2 = coalesce(lr.vitals_spo2, p.spo2),
  temperature_f = coalesce(lr.vitals_temperature, p.temperature_f)
from latest_report lr
where lr.patient_id = p.id;
