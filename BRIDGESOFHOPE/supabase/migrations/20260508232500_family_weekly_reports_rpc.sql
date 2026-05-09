-- Family-safe reader for weekly reports through SECURITY DEFINER.
-- This avoids timeline/vitals blank states when direct table policies are incomplete.

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
  where p.family_id = auth.uid();
$$;

grant execute on function public.bh_family_weekly_reports() to authenticated;
