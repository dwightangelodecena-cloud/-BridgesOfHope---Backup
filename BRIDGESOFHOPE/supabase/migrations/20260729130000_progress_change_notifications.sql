-- Automated guardian notifications when a resident's progress_percent changes meaningfully:
-- upward crossing a new 25% milestone (25/50/75/100), or any downward move at all. Fires from a
-- trigger on patients (not app code) so it catches every update path — Recovery Ladder saves in
-- patient-database.jsx, and the nurse/program weekly report forms — without needing to duplicate
-- notification logic at each call site. Mirrors the existing trigger pattern already used for
-- handle_new_user_profile() (20260510003000_profiles_family_address_and_fix_new_user_trigger.sql).

insert into public.notification_templates (template_key, title, body, description) values
  (
    'progress_milestone_reached',
    'Progress Update — Milestone Reached',
    'Great news — {{patient_name}}''s recovery progress has reached {{progress_percent}}%. Keep up the great work!',
    'Sent automatically when a resident''s progress crosses a new 25% milestone (25/50/75/100). Variables: {{patient_name}}, {{progress_percent}}'
  ),
  (
    'progress_declined',
    'Progress Update',
    'We wanted to update you — {{patient_name}}''s recovery progress is now {{progress_percent}}%, down from {{previous_percent}}%. Our team continues to provide dedicated care and support.',
    'Sent automatically whenever a resident''s progress decreases by any amount. Variables: {{patient_name}}, {{progress_percent}}, {{previous_percent}}'
  )
on conflict (template_key) do nothing;

create or replace function public.bh_notify_patient_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old int := coalesce(OLD.progress_percent, 0);
  v_new int := coalesce(NEW.progress_percent, 0);
  v_template public.notification_templates%rowtype;
  v_body text;
begin
  if NEW.family_id is null then
    return NEW;
  end if;
  -- First time a value is ever set (e.g. admission default) — nothing to compare against.
  if OLD.progress_percent is null then
    return NEW;
  end if;
  if v_new = v_old then
    return NEW;
  end if;

  if v_new > v_old then
    if floor(v_new / 25.0) <= floor(v_old / 25.0) then
      return NEW; -- moved up but didn't cross a new 25% line
    end if;
    select * into v_template from public.notification_templates where template_key = 'progress_milestone_reached';
  else
    select * into v_template from public.notification_templates where template_key = 'progress_declined';
  end if;

  if v_template.template_key is null then
    return NEW;
  end if;

  v_body := replace(
    replace(
      replace(v_template.body, '{{patient_name}}', coalesce(NEW.full_name, 'Resident')),
      '{{progress_percent}}', v_new::text
    ),
    '{{previous_percent}}', v_old::text
  );

  insert into public.family_notifications (family_id, template_key, title, body, related_type, related_id, category)
  values (NEW.family_id, v_template.template_key, v_template.title, v_body, 'patient_progress', NEW.id::text, 'progress');

  return NEW;
end;
$$;

drop trigger if exists patients_notify_progress_change on public.patients;
create trigger patients_notify_progress_change
  after update on public.patients
  for each row
  when (OLD.progress_percent is distinct from NEW.progress_percent)
  execute function public.bh_notify_patient_progress_change();
