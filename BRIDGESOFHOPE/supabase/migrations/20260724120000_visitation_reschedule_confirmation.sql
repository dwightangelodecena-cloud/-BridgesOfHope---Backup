-- Guardian confirmation for admin-initiated visitation reschedules.
-- Approve keeps the family's own proposed slot (auto-confirmed). Reschedule proposes
-- a different slot chosen by admin, which now requires an explicit guardian accept
-- (or the guardian can counter-propose, looping the request back to 'Requested').

alter table public.visitation_requests
  add column if not exists confirmed_by_family boolean not null default false;

comment on column public.visitation_requests.confirmed_by_family is 'True once the guardian has agreed to the current confirmed_date/confirmed_time (auto-true for a direct Approve of their own proposed slot).';

-- Existing Approved rows were always the family's own proposed slot confirmed as-is; backfill true.
update public.visitation_requests
set confirmed_by_family = true
where status = 'Approved';

-- Clarify that a reschedule needs a response, without clobbering any admin customization.
update public.notification_templates
set body = 'Your visit for {{patient_name}} was rescheduled to {{confirmed_date}} at {{confirmed_time}} ({{reason}}). Please accept or propose another time in the app.',
    updated_at = now()
where template_key = 'visitation_rescheduled'
  and body = 'Your visit for {{patient_name}} was rescheduled to {{confirmed_date}} at {{confirmed_time}} ({{reason}}).';
 