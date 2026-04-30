/*
  Fix: CLM users could not view the full patient table.

  This repo relies on `public.bh_is_internal_staff()` (created in a prior migration)
  to identify internal staff roles from `public.profiles.account_type`.

  If RLS is enabled on `public.patients`, add a permissive SELECT policy for internal
  staff (admin/nurse/staff/case load manager) so they can read patients consistently
  across CLM + Admin modes.
*/

create or replace function public.bh_is_internal_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(trim(coalesce(p.account_type::text, ''))) in (
        'admin',
        'nurse',
        'staff',
        'case_load_manager',
        'case manager',
        'case_manager'
      )
  );
$$;

grant execute on function public.bh_is_internal_staff() to authenticated;

alter table public.patients enable row level security;

drop policy if exists "bh_patients_select_internal_staff" on public.patients;

create policy "bh_patients_select_internal_staff"
  on public.patients
  for select
  to authenticated
  using (public.bh_is_internal_staff());

