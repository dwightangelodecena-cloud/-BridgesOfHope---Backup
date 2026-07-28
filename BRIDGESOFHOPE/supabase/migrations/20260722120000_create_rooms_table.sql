-- Ward & Room Management: real room/bed entities for admin room assignment
-- (replaces the free-text patients.room_code as the source of truth).

-- Facility capacity: 50 beds total, every room is exactly 3 beds (bottom/middle/upper bunk).
-- Per-room capacity is a fixed constant, enforced here; the 50-bed facility-wide limit is
-- enforced client-side since it's a cross-row aggregate check, not a good fit for a
-- single-row CHECK constraint.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  ward text not null check (ward in ('Female Ward', 'Male Ward')),
  room_number text not null unique,
  capacity integer not null default 3 check (capacity = 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_ward_idx on public.rooms (ward);

comment on table public.rooms is 'Physical beds/rooms grouped by ward, used for admin room assignment.';

alter table if exists public.patients
  add column if not exists room_id uuid references public.rooms (id) on delete set null;

create index if not exists patients_room_id_idx on public.patients (room_id);

alter table public.rooms enable row level security;

drop policy if exists "rooms_admin_select" on public.rooms;
create policy "rooms_admin_select"
  on public.rooms
  for select
  to authenticated
  using (public.bh_is_admin());

drop policy if exists "rooms_admin_insert" on public.rooms;
create policy "rooms_admin_insert"
  on public.rooms
  for insert
  to authenticated
  with check (public.bh_is_admin());

drop policy if exists "rooms_admin_update" on public.rooms;
create policy "rooms_admin_update"
  on public.rooms
  for update
  to authenticated
  using (public.bh_is_admin())
  with check (public.bh_is_admin());

drop policy if exists "rooms_admin_delete" on public.rooms;
create policy "rooms_admin_delete"
  on public.rooms
  for delete
  to authenticated
  using (public.bh_is_admin());
