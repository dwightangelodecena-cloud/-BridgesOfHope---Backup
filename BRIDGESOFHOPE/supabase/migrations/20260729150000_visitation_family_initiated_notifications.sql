-- Guardian-initiated visitation actions (cancel, propose a new time) currently produce no
-- family_notifications entry -- only admin-initiated status changes did. Adds the one new
-- template these actions need (cancellation reuses the existing 'visitation_cancelled'
-- template) and a narrow self-insert policy so the guardian's own device can log its own
-- action into the same notification feed the admin already writes to. Scoped to exactly
-- the two template_keys the mobile app uses -- guardians still cannot insert arbitrary
-- notifications for themselves or anyone else.

insert into public.notification_templates (template_key, title, body, description) values
  (
    'visitation_new_time_submitted',
    'Visitation — New Time Submitted',
    'Your new requested time for {{patient_name}}''s visit ({{preferred_date}} at {{preferred_time}}) has been submitted and is pending confirmation.',
    'Sent to the guardian when they propose a different date/time from the mobile app after admin rescheduled. Variables: {{patient_name}}, {{preferred_date}}, {{preferred_time}}'
  )
on conflict (template_key) do nothing;

drop policy if exists "family_notifications_insert_self_visitation" on public.family_notifications;
create policy "family_notifications_insert_self_visitation"
  on public.family_notifications
  for insert
  to authenticated
  with check (
    family_id = auth.uid()
    and template_key in ('visitation_cancelled', 'visitation_new_time_submitted')
  );
