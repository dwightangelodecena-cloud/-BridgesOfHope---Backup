-- Two small missing notification flows found in QA audit:
-- 1. Guardians get no signal when a new weekly report is submitted for their resident.
-- 2. Guardians get no closing confirmation once a discharge is finalized (pickup scheduling/
--    confirmation notifications exist, but nothing says "this is now complete").

insert into public.notification_templates (template_key, title, body, description) values
  (
    'weekly_report_submitted',
    'New Weekly Report Available',
    'A new weekly report for {{patient_name}} (Week {{week_number}}) is now available to view.',
    'Sent automatically the first time a given week''s report is submitted for a resident (not on later edits). Variables: {{patient_name}}, {{week_number}}'
  ),
  (
    'discharge_finalized',
    'Discharge Finalized',
    '{{patient_name}}''s discharge has been finalized. Thank you for trusting Bridges of Hope with their care.',
    'Sent when admin clicks Finalize in Discharge Management. Variables: {{patient_name}}'
  )
on conflict (template_key) do nothing;

-- weekly_reports is written via .upsert(..., { onConflict: 'patient_id,week_number' }) from both
-- nurse/medical-report.jsx and program/weekly-report.jsx. An AFTER INSERT trigger only fires for
-- the row's first-ever insert, not later re-saves of the same week via the upsert's UPDATE path —
-- exactly "new report available" semantics, not "report edited".
create or replace function public.bh_notify_weekly_report_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_patient_name text;
  v_template public.notification_templates%rowtype;
  v_body text;
begin
  select family_id, full_name into v_family_id, v_patient_name
  from public.patients where id = NEW.patient_id;

  if v_family_id is null then
    return NEW;
  end if;

  select * into v_template from public.notification_templates where template_key = 'weekly_report_submitted';
  if v_template.template_key is null then
    return NEW;
  end if;

  v_body := replace(
    replace(v_template.body, '{{patient_name}}', coalesce(v_patient_name, 'Resident')),
    '{{week_number}}', coalesce(NEW.week_number::text, '')
  );

  insert into public.family_notifications (family_id, template_key, title, body, related_type, related_id, category)
  values (v_family_id, v_template.template_key, v_template.title, v_body, 'weekly_report', NEW.id::text, 'progress');

  return NEW;
end;
$$;

drop trigger if exists weekly_reports_notify_family on public.weekly_reports;
create trigger weekly_reports_notify_family
  after insert on public.weekly_reports
  for each row
  execute function public.bh_notify_weekly_report_submitted();
