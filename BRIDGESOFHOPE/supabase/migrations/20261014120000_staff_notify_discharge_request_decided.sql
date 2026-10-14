-- Program staff now approve/decline family discharge requests (incl. temporary discharges), but
-- the only admin notification fires on INSERT (bh_notify_staff_new_discharge_request). Admin had no
-- prompt when program actually accepted a temporary discharge and the resident left the facility.
-- Broadcast to the shared admin inbox (recipient_id null) whenever a request leaves 'pending'.

create or replace function public.bh_notify_staff_discharge_request_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_name text;
  v_decider_name text;
  v_temporary boolean := coalesce(nullif(lower(trim(NEW.discharge_type)), ''), 'temporary') = 'temporary';
  v_kind text;
  v_title text;
begin
  select full_name into v_patient_name from public.patients where id = NEW.patient_id;
  if NEW.decided_by is not null then
    select full_name into v_decider_name from public.profiles where id = NEW.decided_by;
  end if;

  v_kind := case when v_temporary then 'temporary discharge' else 'discharge' end;
  v_title := case
    when NEW.status = 'approved' and v_temporary then 'Temporary discharge approved'
    when NEW.status = 'approved' then 'Discharge approved'
    when NEW.status = 'declined' then 'Discharge request declined'
    else 'Discharge request updated'
  end;

  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    v_title,
    concat(
      coalesce(nullif(trim(v_decider_name), ''), 'Program staff'),
      ' ', NEW.status, ' the ', v_kind, ' request for ',
      coalesce(nullif(trim(v_patient_name), ''), 'a resident'),
      '.'
    ),
    'discharge_request',
    NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists discharge_requests_notify_staff_decided on public.discharge_requests;
create trigger discharge_requests_notify_staff_decided
  after update of status on public.discharge_requests
  for each row
  when (OLD.status = 'pending' and NEW.status in ('approved', 'declined'))
  execute function public.bh_notify_staff_discharge_request_decided();
