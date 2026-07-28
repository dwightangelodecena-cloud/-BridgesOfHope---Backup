-- Seed guardian-facing notification templates for the new visitation "Cancelled" and
-- "Completed" statuses (admin-appointments.jsx status system enhancement). Additive only —
-- reuses the existing notification_templates table/RLS from 20260723120000.

insert into public.notification_templates (template_key, title, body, description) values
  (
    'visitation_cancelled',
    'Visitation — Cancelled',
    'Your visitation request for {{patient_name}} has been cancelled.',
    'Sent when admin cancels a previously approved/rescheduled visitation. Variables: {{patient_name}}'
  ),
  (
    'visitation_completed',
    'Visitation — Completed',
    'The visit for {{patient_name}} on {{confirmed_date}} has been marked complete.',
    'Sent when admin marks a visitation as completed. Variables: {{patient_name}}, {{confirmed_date}}'
  )
on conflict (template_key) do nothing;
