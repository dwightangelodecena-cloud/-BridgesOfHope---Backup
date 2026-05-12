-- Family dashboards and recovery ladder save read/write public.patients (especially progress_percent).
-- If RLS is enabled on patients without matching policies, UPDATE returns 0 rows (no error) and
-- nurse_recovery_ladders can still save — this migration aligns patients with internal staff + family access.
--
-- Requires public.bh_is_internal_staff() from 20260508231000 / 20260507221000 (profiles admin|nurse|program).

alter table if exists public.patients enable row level security;

drop policy if exists "patients_select_family_or_internal_staff" on public.patients;
create policy "patients_select_family_or_internal_staff"
  on public.patients
  for select
  to authenticated
  using (
    family_id = auth.uid()
    or public.bh_is_internal_staff()
  );

drop policy if exists "patients_insert_internal_staff" on public.patients;
create policy "patients_insert_internal_staff"
  on public.patients
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "patients_update_internal_staff" on public.patients;
create policy "patients_update_internal_staff"
  on public.patients
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());

comment on policy "patients_select_family_or_internal_staff" on public.patients is
  'Family reads own residents; clinical staff reads all (for resident management).';
comment on policy "patients_update_internal_staff" on public.patients is
  'Allows recovery ladder save to update progress_percent and related clinical fields.';
