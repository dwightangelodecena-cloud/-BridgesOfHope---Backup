-- Program staff: pending family discharge requests for assigned residents.
-- Self-contained: creates helper functions if missing, then RLS policies.
-- Safe to run in SQL Editor even if 20260516120000 was not applied first.

create or replace function public.program_staff_identity_names ()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with jwt_names as (
    select array_remove(array[
      nullif(trim(auth.jwt () -> 'user_metadata' ->> 'full_name'), ''),
      nullif(trim(auth.jwt () -> 'user_metadata' ->> 'name'), ''),
      nullif(
        trim(
          regexp_replace(
            split_part(coalesce(auth.jwt () ->> 'email', ''), '@', 1),
            '[._-]+',
            ' ',
            'g'
          )
        ),
        ''
      )
    ], null::text) as names
  ),
  profile_name as (
    select nullif(trim(p.full_name), '') as full_name
    from public.profiles p
    where p.id = auth.uid ()
    limit 1
  )
  select coalesce(
    (
      select array_agg(distinct lower(trim(n)))
      from (
        select unnest(j.names) as n from jwt_names j
        union all
        select pn.full_name from profile_name pn where pn.full_name is not null
      ) s
      where coalesce(trim(n), '') <> ''
    ),
    '{}'::text[]
  );
$$;

comment on function public.program_staff_identity_names () is
  'Lowercase identity strings for the signed-in program user (profile + JWT).';

grant execute on function public.program_staff_identity_names () to authenticated;
grant execute on function public.program_staff_identity_names () to service_role;

create or replace function public.patient_assigned_to_program_staff (p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patients pat
    where pat.id = p_patient_id
      and coalesce(trim(pat.case_load_manager), '') <> ''
      and lower(trim(pat.case_load_manager)) = any (public.program_staff_identity_names ())
  );
$$;

comment on function public.patient_assigned_to_program_staff (uuid) is
  'True when patients.case_load_manager matches the current program user identity.';

grant execute on function public.patient_assigned_to_program_staff (uuid) to authenticated;
grant execute on function public.patient_assigned_to_program_staff (uuid) to service_role;

create or replace function public.is_program_account ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid ()
        and lower(coalesce(p.account_type::text, '')) in (
          'program',
          'case_load_manager',
          'case load manager',
          'case manager',
          'staff'
        )
    )
    or lower(coalesce(
      nullif(trim(auth.jwt () -> 'user_metadata' ->> 'account_type'), ''),
      nullif(trim(auth.jwt () -> 'app_metadata' ->> 'account_type'), ''),
      ''
    )) in ('program', 'case_load_manager', 'case load manager', 'case manager', 'staff');
$$;

comment on function public.is_program_account () is
  'Program workspace role from profiles.account_type and/or JWT metadata.';

grant execute on function public.is_program_account () to authenticated;
grant execute on function public.is_program_account () to service_role;

-- Admin/nurse: processed discharge rows only (not the pending family queue).
drop policy if exists "discharge_staff_all" on public.discharge_requests;

drop policy if exists "discharge_staff_select_non_pending" on public.discharge_requests;
create policy "discharge_staff_select_non_pending"
  on public.discharge_requests
  for select
  to authenticated
  using (public.is_staff () and status <> 'pending');

drop policy if exists "discharge_staff_update_non_pending" on public.discharge_requests;
create policy "discharge_staff_update_non_pending"
  on public.discharge_requests
  for update
  to authenticated
  using (public.is_staff () and status <> 'pending')
  with check (public.is_staff () and status <> 'pending');

-- Program: pending + processed for assigned residents only.
drop policy if exists "discharge_program_select_assigned_pending" on public.discharge_requests;
create policy "discharge_program_select_assigned_pending"
  on public.discharge_requests
  for select
  to authenticated
  using (
    public.is_program_account ()
    and status = 'pending'
    and public.patient_assigned_to_program_staff (patient_id)
  );

drop policy if exists "discharge_program_select_assigned" on public.discharge_requests;
create policy "discharge_program_select_assigned"
  on public.discharge_requests
  for select
  to authenticated
  using (
    public.is_program_account ()
    and status <> 'pending'
    and public.patient_assigned_to_program_staff (patient_id)
  );

drop policy if exists "discharge_program_update_assigned" on public.discharge_requests;
create policy "discharge_program_update_assigned"
  on public.discharge_requests
  for update
  to authenticated
  using (
    public.is_program_account ()
    and public.patient_assigned_to_program_staff (patient_id)
  )
  with check (
    public.is_program_account ()
    and public.patient_assigned_to_program_staff (patient_id)
  );

do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.discharge_requests';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
