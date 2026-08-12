-- Admission-request INSERT already notifies staff (bh_notify_staff_new_admission_request), but
-- the guardian's proposed meeting date/time is set later via a separate UPDATE
-- (preferred_meeting_date/preferred_meeting_time), which the existing trigger never sees. Staff
-- had no prompt at all when a guardian actually proposed a first-meeting time.

create or replace function public.bh_notify_staff_admission_meeting_proposed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_notifications (title, body, related_type, related_id)
  values (
    'Meeting time proposed',
    concat(
      coalesce(nullif(trim(NEW.guardian_full_name), ''), 'A guardian'),
      ' proposed a meeting time for ',
      coalesce(nullif(trim(NEW.patient_name), ''), 'a resident'),
      '''s admission: ',
      to_char(NEW.preferred_meeting_date, 'FMMonth FMDD, YYYY'),
      case when NEW.preferred_meeting_time is not null then concat(' at ', NEW.preferred_meeting_time) else '' end,
      '.'
    ),
    'admission_request',
    NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists admission_requests_notify_staff_meeting_proposed on public.admission_requests;
create trigger admission_requests_notify_staff_meeting_proposed
  after update on public.admission_requests
  for each row
  when (
    NEW.preferred_meeting_date is not null
    and (
      NEW.preferred_meeting_date is distinct from OLD.preferred_meeting_date
      or NEW.preferred_meeting_time is distinct from OLD.preferred_meeting_time
    )
  )
  execute function public.bh_notify_staff_admission_meeting_proposed();
