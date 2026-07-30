-- Extend staff_notifications (previously admin-only) so nurse and program staff also get
-- notified about their own assigned residents. Resident-to-staff assignment in this app is
-- name-text matching, not a foreign key (patients.program_staff = nurse assignee,
-- patients.case_load_manager = program assignee — confirmed via nurse-dashboard.jsx's
-- getCandidateNames/toName and the existing program_staff_identity_names() function in
-- 20260516120000_discharge_requests_program_staff_rls.sql). This keeps that same mechanism
-- rather than introducing a real FK, which would be a much larger, unrelated refactor.

alter table public.staff_notifications
  add column if not exists recipient_id uuid references auth.users (id) on delete cascade;

comment on column public.staff_notifications.recipient_id is
  'Null = shared admin broadcast (existing behavior). Non-null = targeted at one specific nurse/program staff member.';

drop policy if exists "staff_notifications_select_admin" on public.staff_notifications;
create policy "staff_notifications_select_admin"
  on public.staff_notifications
  for select
  to authenticated
  using (public.bh_is_admin() or recipient_id = auth.uid());

drop policy if exists "staff_notifications_update_admin" on public.staff_notifications;
create policy "staff_notifications_update_admin"
  on public.staff_notifications
  for update
  to authenticated
  using (public.bh_is_admin() or recipient_id = auth.uid())
  with check (public.bh_is_admin() or recipient_id = auth.uid());

-- Given a free-text assignee name (patients.program_staff or patients.case_load_manager), find
-- the matching auth user — mirrors the exact candidate-name set already used both client-side
-- (nurse-dashboard.jsx getCandidateNames) and server-side (program_staff_identity_names()):
-- profiles.full_name, auth.users' metadata full_name/name, and the email-local-part with
-- punctuation replaced by spaces. One resolver, reused for both nurse and program.
create or replace function public.bh_resolve_staff_profile_id_by_name(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_needle text := lower(trim(coalesce(p_name, '')));
  v_id uuid;
begin
  if v_needle = '' then
    return null;
  end if;
  select u.id into v_id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where v_needle in (
    lower(trim(coalesce(p.full_name, ''))),
    lower(trim(coalesce(u.raw_user_meta_data->>'full_name', ''))),
    lower(trim(coalesce(u.raw_user_meta_data->>'name', ''))),
    lower(trim(regexp_replace(split_part(u.email, '@', 1), '[._-]+', ' ', 'g')))
  )
  limit 1;
  return v_id;
end;
$$;

-- Extend the existing discharge-request trigger: keep the admin broadcast (unchanged), and also
-- notify the assigned program staff (case_load_manager) if one resolves.
create or replace function public.bh_notify_staff_new_discharge_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
  v_case_load_manager text;
  v_program_recipient uuid;
begin
  select full_name, case_load_manager into v_patient_name, v_case_load_manager
  from public.patients where id = NEW.patient_id;

  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    'New discharge request',
    concat('A new discharge request was submitted for ', coalesce(nullif(trim(v_patient_name), ''), 'a resident'), '.'),
    'discharge_request',
    NEW.id::text
  );

  v_program_recipient := public.bh_resolve_staff_profile_id_by_name(v_case_load_manager);
  if v_program_recipient is not null then
    insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
    values (
      'New discharge request',
      concat('A new discharge request was submitted for your resident ', coalesce(nullif(trim(v_patient_name), ''), 'a resident'), '.'),
      'discharge_request',
      NEW.id::text,
      v_program_recipient
    );
  end if;

  return NEW;
end;
$$;

-- New: resident assignment changes + discharge-pickup events on patients, targeted at the
-- assigned nurse/program staff.
create or replace function public.bh_notify_staff_patient_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(nullif(trim(NEW.full_name), ''), 'a resident');
  v_nurse_id uuid;
  v_program_id uuid;
begin
  if NEW.program_staff is distinct from OLD.program_staff and coalesce(trim(NEW.program_staff), '') <> '' then
    v_nurse_id := public.bh_resolve_staff_profile_id_by_name(NEW.program_staff);
    if v_nurse_id is not null then
      insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
      values ('Resident assigned to you', concat('You have been assigned to ', v_name, '.'), 'patient_assignment_nurse', NEW.id::text, v_nurse_id);
    end if;
  end if;

  if NEW.case_load_manager is distinct from OLD.case_load_manager and coalesce(trim(NEW.case_load_manager), '') <> '' then
    v_program_id := public.bh_resolve_staff_profile_id_by_name(NEW.case_load_manager);
    if v_program_id is not null then
      insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
      values ('Resident assigned to you', concat('You have been assigned to ', v_name, '.'), 'patient_assignment_program', NEW.id::text, v_program_id);
    end if;
  end if;

  if NEW.pickup_meeting_confirmed_by_family is true and coalesce(OLD.pickup_meeting_confirmed_by_family, false) is false then
    v_nurse_id := public.bh_resolve_staff_profile_id_by_name(NEW.program_staff);
    if v_nurse_id is not null then
      insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
      values ('Pickup time confirmed', concat('Guardian confirmed the pickup time for ', v_name, '.'), 'discharge_pickup', NEW.id::text, v_nurse_id);
    end if;
  end if;

  if NEW.pickup_meeting_rejected_at is not null and OLD.pickup_meeting_rejected_at is null then
    v_nurse_id := public.bh_resolve_staff_profile_id_by_name(NEW.program_staff);
    if v_nurse_id is not null then
      insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
      values (
        'Pickup time rejected',
        concat('Guardian rejected the pickup time for ', v_name, coalesce(': ' || nullif(trim(NEW.pickup_meeting_rejected_reason), ''), '.')),
        'discharge_pickup',
        NEW.id::text,
        v_nurse_id
      );
    end if;
  end if;

  if NEW.pickup_family_confirmed_at is not null and OLD.pickup_family_confirmed_at is null then
    v_nurse_id := public.bh_resolve_staff_profile_id_by_name(NEW.program_staff);
    if v_nurse_id is not null then
      insert into public.staff_notifications (title, body, related_type, related_id, recipient_id)
      values ('Guardian confirmed pickup', concat('Guardian confirmed they picked up ', v_name, '.'), 'discharge_pickup', NEW.id::text, v_nurse_id);
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists patients_notify_staff_changes on public.patients;
create trigger patients_notify_staff_changes
  after update on public.patients
  for each row
  execute function public.bh_notify_staff_patient_changes();
