-- Ensure weekly_reports can be read by the owning family and managed by internal staff.
-- This fixes Family timeline/vitals visibility when nurse reports are already submitted.

create or replace function public.bh_is_internal_staff()
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
      and lower(coalesce(p.account_type::text, '')) in ('admin', 'nurse', 'program')
  );
$$;

grant execute on function public.bh_is_internal_staff() to authenticated;

alter table if exists public.weekly_reports enable row level security;

drop policy if exists "weekly_reports_select_family_owned_patients" on public.weekly_reports;
create policy "weekly_reports_select_family_owned_patients"
  on public.weekly_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.patients p
      where p.id = weekly_reports.patient_id
        and p.family_id = auth.uid()
    )
  );

drop policy if exists "weekly_reports_select_internal_staff" on public.weekly_reports;
create policy "weekly_reports_select_internal_staff"
  on public.weekly_reports
  for select
  to authenticated
  using (public.bh_is_internal_staff());

drop policy if exists "weekly_reports_insert_internal_staff" on public.weekly_reports;
create policy "weekly_reports_insert_internal_staff"
  on public.weekly_reports
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "weekly_reports_update_internal_staff" on public.weekly_reports;
create policy "weekly_reports_update_internal_staff"
  on public.weekly_reports
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());
