-- Two related changes:
--
-- 1. Weekly reports gain a "Conclude" step. A weekly_reports row is now a staff/admin draft
--    until a nurse or program staffer concludes it (sets concluded_at). Only concluded weekly
--    reports are visible to the owning family. The conclude action also snapshots that week's
--    daily_reports verbatim into compiled_daily_reports (jsonb) so the family sees the compiled
--    day-by-day notes without ever getting access to the daily_reports table.
--
-- 2. Daily reports become nurse/program-only — admins lose read access. daily_reports is the
--    internal source record used to build the weekly report; only the concluded weekly report
--    is admin/family-facing.

-- ---------------------------------------------------------------------------
-- 1. weekly_reports: conclude columns
-- ---------------------------------------------------------------------------

alter table if exists public.weekly_reports
  add column if not exists concluded_at timestamptz;
alter table if exists public.weekly_reports
  add column if not exists concluded_by uuid references public.profiles (id);
alter table if exists public.weekly_reports
  add column if not exists compiled_daily_reports jsonb;

comment on column public.weekly_reports.concluded_at is
  'Set when a nurse/program staffer clicks "Conclude Weekly Report". Null = draft (staff/admin only). Non-null = finalized and visible to the owning family.';
comment on column public.weekly_reports.compiled_daily_reports is
  'Verbatim snapshot of that week''s daily_reports rows, captured at conclude time: [{report_date, author_role, observations, assessment, follow_up, notes}].';

-- Existing weekly reports were already family-visible under the old rules — keep them visible
-- by treating them as concluded as of their submission (or creation) time.
update public.weekly_reports
  set concluded_at = coalesce(submitted_at, created_at, now())
  where concluded_at is null;

-- ---------------------------------------------------------------------------
-- 2. weekly_reports RLS: family sees concluded reports only; staff/admin unchanged
-- ---------------------------------------------------------------------------

drop policy if exists "weekly_reports_select_family_owned_patients" on public.weekly_reports;
create policy "weekly_reports_select_family_owned_patients"
  on public.weekly_reports
  for select
  to authenticated
  using (
    weekly_reports.concluded_at is not null
    and exists (
      select 1
      from public.patients p
      where p.id = weekly_reports.patient_id
        and p.family_id = auth.uid()
    )
  );

-- SECURITY DEFINER reader bypasses RLS, so the concluded filter must be repeated here.
create or replace function public.bh_family_weekly_reports()
returns setof public.weekly_reports
language sql
stable
security definer
set search_path = public
as $$
  select wr.*
  from public.weekly_reports wr
  join public.patients p on p.id = wr.patient_id
  where p.family_id = auth.uid()
    and wr.concluded_at is not null;
$$;

grant execute on function public.bh_family_weekly_reports() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Family notification fires on conclude, not on first insert
-- ---------------------------------------------------------------------------

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

-- Fire once, when concluded_at transitions NULL -> NOT NULL (on insert of an already-concluded
-- row, or on the upsert UPDATE path that concludes an existing draft). Later re-saves of an
-- already-concluded week do not re-notify.
drop trigger if exists weekly_reports_notify_family on public.weekly_reports;
drop trigger if exists weekly_reports_notify_family_on_conclude_insert on public.weekly_reports;
create trigger weekly_reports_notify_family_on_conclude_insert
  after insert on public.weekly_reports
  for each row
  when (NEW.concluded_at is not null)
  execute function public.bh_notify_weekly_report_submitted();

drop trigger if exists weekly_reports_notify_family_on_conclude_update on public.weekly_reports;
create trigger weekly_reports_notify_family_on_conclude_update
  after update on public.weekly_reports
  for each row
  when (OLD.concluded_at is null and NEW.concluded_at is not null)
  execute function public.bh_notify_weekly_report_submitted();

-- ---------------------------------------------------------------------------
-- 4. daily_reports: nurse/program only (admins lose read/write)
-- ---------------------------------------------------------------------------

create or replace function public.bh_is_nurse_or_program()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.account_type::text, '')) in ('nurse', 'program')
  );
$$;

grant execute on function public.bh_is_nurse_or_program() to authenticated;

drop policy if exists "daily_reports_select_internal_staff" on public.daily_reports;
create policy "daily_reports_select_nurse_program"
  on public.daily_reports
  for select
  to authenticated
  using (public.bh_is_nurse_or_program());

drop policy if exists "daily_reports_insert_internal_staff" on public.daily_reports;
create policy "daily_reports_insert_nurse_program"
  on public.daily_reports
  for insert
  to authenticated
  with check (public.bh_is_nurse_or_program());

drop policy if exists "daily_reports_update_internal_staff" on public.daily_reports;
create policy "daily_reports_update_nurse_program"
  on public.daily_reports
  for update
  to authenticated
  using (public.bh_is_nurse_or_program())
  with check (public.bh_is_nurse_or_program());

comment on table public.daily_reports is
  'Nurse/program-only per-day patient notes. Not visible to admins or family. Compiled verbatim into weekly_reports.compiled_daily_reports when a week is concluded.';
