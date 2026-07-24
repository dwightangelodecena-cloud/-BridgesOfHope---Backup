-- Admin-editable wording for guardian-facing notifications (admission + visitation events).
-- Body text supports {{var}} placeholders, rendered client-side before insert into family_notifications.

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  title text not null,
  body text not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.notification_templates is 'Admin-editable notification wording, keyed by event type.';

alter table public.notification_templates enable row level security;

drop policy if exists "notification_templates_select_staff" on public.notification_templates;
create policy "notification_templates_select_staff"
  on public.notification_templates
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "notification_templates_write_admin" on public.notification_templates;
create policy "notification_templates_write_admin"
  on public.notification_templates
  for all
  to authenticated
  using (public.bh_is_admin())
  with check (public.bh_is_admin());

insert into public.notification_templates (template_key, title, body, description) values
  (
    'admission_meeting_confirmed',
    'Admission — Meeting Confirmed',
    'Your meeting for {{patient_name}}''s admission is confirmed on {{meeting_date}} at {{meeting_time}}.',
    'Sent when admin confirms the meeting date/time (either the guardian''s own proposed slot, or an admin-initiated first offer). Variables: {{patient_name}}, {{meeting_date}}, {{meeting_time}}'
  ),
  (
    'admission_meeting_unavailable',
    'Admission — Requested Time Unavailable',
    'Your requested time wasn''t available. We''ve proposed a new schedule for {{patient_name}}''s admission meeting: {{meeting_date}} at {{meeting_time}}. Please confirm or propose another time.',
    'Sent when admin counter-offers a different date/time than the one the guardian proposed. Variables: {{patient_name}}, {{meeting_date}}, {{meeting_time}}'
  ),
  (
    'admission_meeting_followup_docs',
    'Admission — Documents Needed After Meeting',
    'After your meeting, please complete required documents for {{patient_name}}''s admission.',
    'Sent when admin marks the family meeting complete and moves the request into document review. Variables: {{patient_name}}'
  ),
  (
    'admission_docs_needed',
    'Admission — Missing Documents',
    'Please upload the following documents for {{patient_name}}: {{notes}}',
    'Sent when admin marks required documents as incomplete during review, with notes on what is missing. Variables: {{patient_name}}, {{notes}}'
  ),
  (
    'admission_approved',
    'Admission — Approved',
    'Great news — {{patient_name}}''s admission has been approved.',
    'Sent when admin approves the admission request. Variables: {{patient_name}}'
  ),
  (
    'admission_rejected',
    'Admission — Rejected',
    'We''re unable to proceed with {{patient_name}}''s admission request at this time.',
    'Sent when admin rejects the admission request. Variables: {{patient_name}}'
  ),
  (
    'visitation_approved',
    'Visitation — Approved',
    'Your visit for {{patient_name}} is confirmed on {{confirmed_date}} at {{confirmed_time}}.',
    'Sent when admin approves a visitation request as proposed. Variables: {{patient_name}}, {{confirmed_date}}, {{confirmed_time}}'
  ),
  (
    'visitation_declined',
    'Visitation — Declined',
    'Your visitation request for {{patient_name}} was declined.',
    'Sent when admin declines a visitation request. Variables: {{patient_name}}'
  ),
  (
    'visitation_rescheduled',
    'Visitation — Rescheduled',
    'Your visit for {{patient_name}} was rescheduled to {{confirmed_date}} at {{confirmed_time}} ({{reason}}).',
    'Sent when admin reschedules a visitation request to a new date/time with a reason. Variables: {{patient_name}}, {{confirmed_date}}, {{confirmed_time}}, {{reason}}'
  )
on conflict (template_key) do nothing;
