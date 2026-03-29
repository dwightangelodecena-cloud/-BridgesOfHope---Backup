-- Bridges of Hope — core schema
-- Run in Supabase: SQL Editor → New query → paste → Run
-- Requires: extensions pgcrypto (for gen_random_uuid) — usually enabled by default

-- ---------------------------------------------------------------------------
-- 1) Profiles (1:1 with auth.users — app-facing name/phone/role)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  account_type text not null default 'family'
    check (account_type in ('family', 'nurse', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Mirror of auth users for FKs and RLS; account_type should match auth.raw_user_meta_data';

-- New signups: copy metadata into profiles
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    lower(coalesce(new.raw_user_meta_data->>'account_type', 'family'))
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        account_type = excluded.account_type,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- 2) Patients (admitted — replaces bh_patients when approved)
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid (),
  full_name text not null,
  date_of_birth date,
  primary_concern text,
  clinical_status text not null default 'Stable'
    check (clinical_status in ('Improving', 'Stable', 'Declining')),
  progress_percent int not null default 0
    check (progress_percent between 0 and 100),
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  family_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_family_id_idx on public.patients (family_id);
create index if not exists patients_discharged_at_idx on public.patients (discharged_at);

-- ---------------------------------------------------------------------------
-- 3) Admission requests (replaces bh_pending_admissions + tracks declined)
-- ---------------------------------------------------------------------------
create table if not exists public.admission_requests (
  id uuid primary key default gen_random_uuid (),
  family_id uuid not null references public.profiles (id) on delete cascade,
  guardian_full_name text not null,
  guardian_email text not null,
  guardian_phone text not null,
  patient_name text not null,
  patient_birth_date date not null,
  reason_for_admission text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

create index if not exists admission_requests_status_idx on public.admission_requests (status);
create index if not exists admission_requests_family_idx on public.admission_requests (family_id);

-- ---------------------------------------------------------------------------
-- 4) Discharge requests (replaces bh_pending_discharges)
-- ---------------------------------------------------------------------------
create table if not exists public.discharge_requests (
  id uuid primary key default gen_random_uuid (),
  patient_id uuid not null references public.patients (id) on delete cascade,
  family_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

create index if not exists discharge_requests_status_idx on public.discharge_requests (status);

-- ---------------------------------------------------------------------------
-- 5) Activity log (replaces bh_recent_activities)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid (),
  actor_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  icon_name text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 6) updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at ();

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- 7) Row Level Security (starter — tighten as needed)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.admission_requests enable row level security;
alter table public.discharge_requests enable row level security;
alter table public.activity_log enable row level security;

-- Profiles: users manage own row
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid () = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid () = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid () = id);

-- Staff can read all profiles (for admin/nurse UIs)
create policy "profiles_staff_select_all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

-- Patients: family sees own linked patients; staff sees all
create policy "patients_family_select"
  on public.patients for select
  using (family_id = auth.uid ());

create policy "patients_staff_all"
  on public.patients for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

-- Admission requests: family sees/creates own; staff sees all and can update
create policy "admission_family_select"
  on public.admission_requests for select
  using (family_id = auth.uid ());

create policy "admission_family_insert"
  on public.admission_requests for insert
  with check (family_id = auth.uid ());

create policy "admission_staff_select"
  on public.admission_requests for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

create policy "admission_staff_update"
  on public.admission_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

-- Discharge requests
create policy "discharge_family_select"
  on public.discharge_requests for select
  using (family_id = auth.uid ());

create policy "discharge_family_insert"
  on public.discharge_requests for insert
  with check (family_id = auth.uid ());

create policy "discharge_staff_all"
  on public.discharge_requests for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

-- Activity: staff read; insert from authenticated staff (or service later)
create policy "activity_staff_select"
  on public.activity_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

create policy "activity_staff_insert"
  on public.activity_log for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid ()
        and p.account_type in ('nurse', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 8) Backfill profiles for existing auth users (run once if you already have users)
-- ---------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, account_type)
-- select
--   id,
--   coalesce(raw_user_meta_data->>'full_name', ''),
--   lower(coalesce(raw_user_meta_data->>'account_type', 'family'))
-- from auth.users
-- on conflict (id) do nothing;
