-- Ensure patient master record can store latest nurse-submitted vitals.

alter table public.patients
  add column if not exists current_weight text,
  add column if not exists weight_kg text,
  add column if not exists height_cm text,
  add column if not exists bmi text,
  add column if not exists bp text,
  add column if not exists pr text,
  add column if not exists rr text,
  add column if not exists spo2 text,
  add column if not exists temperature_f text;
