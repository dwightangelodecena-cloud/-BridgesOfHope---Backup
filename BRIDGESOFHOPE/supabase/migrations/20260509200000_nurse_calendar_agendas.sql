-- Nurse calendar agendas: persisted per authenticated user (nurse).

create table if not exists public.nurse_calendar_agendas (
  id uuid primary key,
  nurse_user_id uuid not null references auth.users (id) on delete cascade,
  agenda_date date not null,
  agenda_type text not null check (agenda_type in ('personal', 'resident')),
  description text not null,
  patient_id uuid references public.patients (id) on delete set null,
  patient_name text,
  created_at timestamptz not null default now()
);

create index if not exists nurse_calendar_agendas_nurse_date_idx
  on public.nurse_calendar_agendas (nurse_user_id, agenda_date);

alter table public.nurse_calendar_agendas enable row level security;

drop policy if exists "nurse_calendar_agendas_select_own" on public.nurse_calendar_agendas;
create policy "nurse_calendar_agendas_select_own"
  on public.nurse_calendar_agendas
  for select
  to authenticated
  using (auth.uid() = nurse_user_id);

drop policy if exists "nurse_calendar_agendas_insert_own" on public.nurse_calendar_agendas;
create policy "nurse_calendar_agendas_insert_own"
  on public.nurse_calendar_agendas
  for insert
  to authenticated
  with check (auth.uid() = nurse_user_id);

drop policy if exists "nurse_calendar_agendas_update_own" on public.nurse_calendar_agendas;
create policy "nurse_calendar_agendas_update_own"
  on public.nurse_calendar_agendas
  for update
  to authenticated
  using (auth.uid() = nurse_user_id)
  with check (auth.uid() = nurse_user_id);

drop policy if exists "nurse_calendar_agendas_delete_own" on public.nurse_calendar_agendas;
create policy "nurse_calendar_agendas_delete_own"
  on public.nurse_calendar_agendas
  for delete
  to authenticated
  using (auth.uid() = nurse_user_id);

grant select, insert, update, delete on public.nurse_calendar_agendas to authenticated;
