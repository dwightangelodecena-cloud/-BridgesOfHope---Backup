-- Staff-facing counterpart to family_notifications: today, a new admission/discharge/visitation
-- request from a guardian is invisible to staff until someone manually opens the relevant
-- management page. v1 is a shared admin inbox (not per-assignee routing to individual nurses/
-- program staff — a brand-new request has no assignee yet, and admin already owns processing all
-- three request types per the existing management pages).

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  related_type text,
  related_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists staff_notifications_created_at_idx
  on public.staff_notifications (created_at desc);

comment on table public.staff_notifications is
  'Shared admin inbox: auto-generated when a guardian submits a new admission/discharge/visitation request. Inserted only by security-definer triggers, never directly by clients.';

alter table public.staff_notifications enable row level security;

drop policy if exists "staff_notifications_select_admin" on public.staff_notifications;
create policy "staff_notifications_select_admin"
  on public.staff_notifications
  for select
  to authenticated
  using (public.bh_is_admin());

drop policy if exists "staff_notifications_update_admin" on public.staff_notifications;
create policy "staff_notifications_update_admin"
  on public.staff_notifications
  for update
  to authenticated
  using (public.bh_is_admin())
  with check (public.bh_is_admin());

-- Extend Realtime delivery (same mechanism as prior sessions' realtime migrations).
do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.staff_notifications';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create or replace function public.bh_notify_staff_new_admission_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    'New admission request',
    concat('A new admission request was submitted for ', coalesce(nullif(trim(NEW.patient_name), ''), 'a resident'), '.'),
    'admission_request',
    NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists admission_requests_notify_staff on public.admission_requests;
create trigger admission_requests_notify_staff
  after insert on public.admission_requests
  for each row
  execute function public.bh_notify_staff_new_admission_request();

create or replace function public.bh_notify_staff_new_discharge_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
begin
  select full_name into v_patient_name from public.patients where id = NEW.patient_id;
  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    'New discharge request',
    concat('A new discharge request was submitted for ', coalesce(nullif(trim(v_patient_name), ''), 'a resident'), '.'),
    'discharge_request',
    NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists discharge_requests_notify_staff on public.discharge_requests;
create trigger discharge_requests_notify_staff
  after insert on public.discharge_requests
  for each row
  execute function public.bh_notify_staff_new_discharge_request();

create or replace function public.bh_notify_staff_new_visitation_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    'New visitation request',
    concat('A new visitation request was submitted for ', coalesce(nullif(trim(NEW.patient_name), ''), 'a resident'), '.'),
    'visitation_request',
    NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists visitation_requests_notify_staff on public.visitation_requests;
create trigger visitation_requests_notify_staff
  after insert on public.visitation_requests
  for each row
  execute function public.bh_notify_staff_new_visitation_request();
