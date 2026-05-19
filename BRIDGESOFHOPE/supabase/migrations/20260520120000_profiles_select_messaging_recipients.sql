/*
  Admin Messages inbox: staff (not only admins) must read family/customer profiles.

  bh_profiles_select_own_or_admin already lets admins read all profiles.
  bh_profiles_select_internal_staff_peers only exposes nurse/program/admin/staff rows.
  This policy lets internal staff read non-staff profile rows for the messaging UI.
*/

drop policy if exists "bh_profiles_select_messaging_recipients" on public.profiles;
create policy "bh_profiles_select_messaging_recipients"
  on public.profiles
  for select
  to authenticated
  using (
    public.bh_is_internal_staff()
    and lower(trim(coalesce(public.profiles.account_type::text, ''))) not in (
      'admin',
      'nurse',
      'staff',
      'program',
      'case_manager',
      'case_load_manager',
      'case load manager'
    )
  );
