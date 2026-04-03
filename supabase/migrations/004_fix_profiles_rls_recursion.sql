-- Fix: "infinite recursion detected in policy for relation profiles"
-- Cause: policies on public.profiles used EXISTS (SELECT ... FROM public.profiles ...),
--        which re-triggers RLS on profiles while evaluating the same policy.
-- Fix: staff checks must NOT query public.profiles from inside a profiles RLS policy.
--      We use JWT user_metadata.account_type (same source as your signup trigger) so the
--      policy expression never touches the profiles table → no recursion.
--
-- If nurse/admin users lose access after this, re-login or set user_metadata.account_type
-- to 'nurse' or 'admin' in Supabase Auth for that user.

create or replace function public.is_staff ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    auth.jwt () -> 'user_metadata' ->> 'account_type',
    ''
  ))) in ('nurse', 'admin');
$$;

comment on function public.is_staff () is
  'True if JWT user_metadata.account_type is nurse or admin (no read of profiles — avoids RLS recursion).';

grant execute on function public.is_staff () to authenticated;
grant execute on function public.is_staff () to service_role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_staff_select_all" on public.profiles;
create policy "profiles_staff_select_all"
  on public.profiles for select
  using (public.is_staff ());

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
drop policy if exists "patients_staff_all" on public.patients;
create policy "patients_staff_all"
  on public.patients for all
  using (public.is_staff ());

-- ---------------------------------------------------------------------------
-- admission_requests
-- ---------------------------------------------------------------------------
drop policy if exists "admission_staff_select" on public.admission_requests;
create policy "admission_staff_select"
  on public.admission_requests for select
  using (public.is_staff ());

drop policy if exists "admission_staff_update" on public.admission_requests;
create policy "admission_staff_update"
  on public.admission_requests for update
  using (public.is_staff ());

-- ---------------------------------------------------------------------------
-- discharge_requests
-- ---------------------------------------------------------------------------
drop policy if exists "discharge_staff_all" on public.discharge_requests;
create policy "discharge_staff_all"
  on public.discharge_requests for all
  using (public.is_staff ());

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
drop policy if exists "activity_staff_select" on public.activity_log;
create policy "activity_staff_select"
  on public.activity_log for select
  using (public.is_staff ());

drop policy if exists "activity_staff_insert" on public.activity_log;
create policy "activity_staff_insert"
  on public.activity_log for insert
  with check (public.is_staff ());

-- ---------------------------------------------------------------------------
-- weekly_reports (from 003 — skip if table not created yet)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.weekly_reports') is not null then
    execute 'drop policy if exists "weekly_reports_staff_all" on public.weekly_reports';
    execute $p$
      create policy "weekly_reports_staff_all"
        on public.weekly_reports for all
        using (public.is_staff ())
        with check (public.is_staff ())
    $p$;
  end if;
end
$$;
