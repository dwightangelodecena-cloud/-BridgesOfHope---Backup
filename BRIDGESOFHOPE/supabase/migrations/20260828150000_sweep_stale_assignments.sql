-- Deterministic auto-unassignment: if the currently assigned nurse/program staff has not
-- authored any record for a patient in `threshold_days`, clear that assignment. No AI/LLM
-- involved — pure business rule, per the capstone requirement that assignment logic must
-- be deterministic. Called opportunistically from the client on admin/nurse/program page
-- load (no cron infra in this project); safe to call repeatedly/concurrently.

create or replace function public.bh_sweep_stale_assignments(threshold_days int default 5)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => threshold_days);
  affected integer := 0;
  r record;
  last_activity timestamptz;
begin
  if not public.bh_is_internal_staff() then
    raise exception 'not authorized';
  end if;

  for r in
    select id, assigned_nurse_id, nurse_assigned_at
    from public.patients
    where assigned_nurse_id is not null
      and discharged_at is null
  loop
    select max(activity_at) into last_activity
    from (
      select created_at as activity_at from public.daily_reports
        where patient_id = r.id and author_id = r.assigned_nurse_id
      union all
      select created_at as activity_at from public.nurse_calendar_agendas
        where patient_id = r.id and nurse_user_id = r.assigned_nurse_id
      union all
      -- weekly_reports predates per-row author IDs (nurse_name is free text); best-effort
      -- name match against the assigned nurse's current profile name.
      select wr.created_at as activity_at
        from public.weekly_reports wr
        where wr.patient_id = r.id
          and lower(trim(wr.nurse_name)) = lower(trim((
            select full_name from public.profiles where id = r.assigned_nurse_id
          )))
    ) activity;

    if coalesce(last_activity, r.nurse_assigned_at) is not null
       and coalesce(last_activity, r.nurse_assigned_at) < cutoff then
      update public.patients
        set assigned_nurse_id = null, nurse_assigned_at = null
        where id = r.id;
      insert into public.activity_log (title, description, icon_name)
        values ('Nurse assignment auto-removed', 'Nurse unassigned from a patient after ' || threshold_days || ' days of inactivity.', 'users');
      affected := affected + 1;
    end if;
  end loop;

  for r in
    select id, assigned_program_staff_id, program_staff_assigned_at
    from public.patients
    where assigned_program_staff_id is not null
      and discharged_at is null
  loop
    select max(activity_at) into last_activity
    from (
      select created_at as activity_at from public.daily_reports
        where patient_id = r.id and author_id = r.assigned_program_staff_id
      union all
      -- weekly_reports predates per-row author IDs (nurse_name is free text, reused for
      -- whichever role submitted); best-effort name match against the assigned staffer.
      select wr.created_at as activity_at
        from public.weekly_reports wr
        where wr.patient_id = r.id
          and lower(trim(wr.nurse_name)) = lower(trim((
            select full_name from public.profiles where id = r.assigned_program_staff_id
          )))
      union all
      select submitted_at as activity_at from public.clm_weekly_reports
        where patient_id = r.id and created_by = r.assigned_program_staff_id
    ) activity;

    if coalesce(last_activity, r.program_staff_assigned_at) is not null
       and coalesce(last_activity, r.program_staff_assigned_at) < cutoff then
      update public.patients
        set assigned_program_staff_id = null, program_staff_assigned_at = null
        where id = r.id;
      insert into public.activity_log (title, description, icon_name)
        values ('Program staff assignment auto-removed', 'Program staff unassigned from a patient after ' || threshold_days || ' days of inactivity.', 'users');
      affected := affected + 1;
    end if;
  end loop;

  return affected;
end;
$$;

grant execute on function public.bh_sweep_stale_assignments(int) to authenticated;
