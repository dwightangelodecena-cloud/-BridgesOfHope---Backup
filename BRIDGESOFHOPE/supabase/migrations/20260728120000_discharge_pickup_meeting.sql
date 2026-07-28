-- Discharge "Call for Pickup": admin schedules a pickup meeting for a resident ready for
-- discharge, guardian is notified via family_notifications. Mirrors the admission meeting
-- negotiation columns (admission_requests.meeting_*), but lives on patients since discharge
-- has no dedicated "request" row of its own.

alter table public.patients
  add column if not exists pickup_meeting_date date,
  add column if not exists pickup_meeting_time text,
  add column if not exists pickup_meeting_scheduled_at timestamptz,
  add column if not exists pickup_meeting_confirmed_by_family boolean not null default false,
  add column if not exists pickup_completed_at timestamptz;

comment on column public.patients.pickup_meeting_confirmed_by_family is
  'True once the guardian has confirmed the scheduled pickup time (via admin marking it confirmed by phone, or the guardian app in a later phase).';
comment on column public.patients.pickup_completed_at is
  'Set when admin marks the resident as physically picked up by the guardian; gates Discharge Management''s Finalize action.';

insert into public.notification_templates (template_key, title, body, description) values
  (
    'discharge_pickup_scheduled',
    'Discharge — Pickup Scheduled',
    'A pickup has been scheduled for {{patient_name}} on {{pickup_date}} at {{pickup_time}}. Please plan to arrive at that time, or contact us if you need to reschedule.',
    'Sent when admin schedules or reschedules a resident''s discharge pickup meeting. Variables: {{patient_name}}, {{pickup_date}}, {{pickup_time}}'
  )
on conflict (template_key) do nothing;
