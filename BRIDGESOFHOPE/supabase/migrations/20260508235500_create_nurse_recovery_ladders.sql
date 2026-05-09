-- Persist nurse recovery ladder state per resident.
create table if not exists public.nurse_recovery_ladders (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  current_position integer not null default 1 check (current_position between 1 and 50),
  checks jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists nurse_recovery_ladders_updated_at_idx
  on public.nurse_recovery_ladders (updated_at desc);

alter table public.nurse_recovery_ladders enable row level security;

drop policy if exists "nurse_recovery_ladders_select_internal_staff" on public.nurse_recovery_ladders;
create policy "nurse_recovery_ladders_select_internal_staff"
  on public.nurse_recovery_ladders
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "nurse_recovery_ladders_upsert_internal_staff" on public.nurse_recovery_ladders;
create policy "nurse_recovery_ladders_upsert_internal_staff"
  on public.nurse_recovery_ladders
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "nurse_recovery_ladders_update_internal_staff" on public.nurse_recovery_ladders;
create policy "nurse_recovery_ladders_update_internal_staff"
  on public.nurse_recovery_ladders
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());
