-- Idempotent: safe if 007 already ran. Run on hosted Supabase if insert fails with missing guardian_* columns.
alter table if exists public.admission_requests
  add column if not exists guardian_middle_initial text,
  add column if not exists guardian_province text,
  add column if not exists guardian_municipality_city text,
  add column if not exists guardian_street text,
  add column if not exists guardian_barangay text;
