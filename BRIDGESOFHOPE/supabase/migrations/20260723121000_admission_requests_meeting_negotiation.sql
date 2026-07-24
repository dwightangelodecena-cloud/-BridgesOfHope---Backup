-- Guardian-proposed meeting date/time negotiation loop for admission requests.
-- Flow: guardian proposes (preferred_meeting_*) -> awaiting_schedule_review ->
-- admin confirms (meeting_confirmed_by_family=true, status processing) or counters
-- (meeting_confirmed_by_family=false, status awaiting_guardian_response) ->
-- guardian accepts (confirmed_by_family=true, processing) or re-proposes (loops back).

alter table public.admission_requests
  add column if not exists preferred_meeting_date date,
  add column if not exists preferred_meeting_time text,
  add column if not exists preferred_meeting_note text,
  add column if not exists preferred_meeting_submitted_at timestamptz,
  add column if not exists meeting_confirmed_by_family boolean not null default false;

comment on column public.admission_requests.preferred_meeting_date is 'Guardian-proposed admission meeting date, awaiting admin availability check.';
comment on column public.admission_requests.meeting_confirmed_by_family is 'True once the guardian has agreed to the current meeting_date/meeting_time.';

alter table public.admission_requests drop constraint if exists admission_requests_status_check;
alter table public.admission_requests add constraint admission_requests_status_check
  check (status in (
    'pending', 'processing', 'in_review',
    'approved', 'declined', 'accepted', 'rejected',
    'awaiting_schedule_review', 'awaiting_guardian_response'
  ));
