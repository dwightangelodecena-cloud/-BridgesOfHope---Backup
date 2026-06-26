-- Admission requests: birth date may be derived from uploaded birth certificate.
alter table if exists public.admission_requests
  alter column patient_birth_date drop not null;
