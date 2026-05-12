/*
 * Admission / assignment UIs need the full nurse & program staff roster.
 *
 * Policy "bh_profiles_select_own_or_admin" only returns all profile rows for admins.
 * Authenticated nurses and program users otherwise matched only their own row, so
 * client-side dropdowns from public.profiles were empty.
 *
 * This policy lets any user who passes public.bh_is_internal_staff() read rows for
 * operational staff account types only (not family accounts).
 */

drop policy if exists "bh_profiles_select_internal_staff_peers" on public.profiles;
create policy "bh_profiles_select_internal_staff_peers"
  on public.profiles
  for select
  to authenticated
  using (
    public.bh_is_internal_staff()
    and lower(trim(coalesce(public.profiles.account_type::text, ''))) in (
      'admin',
      'nurse',
      'program',
      'staff'
    )
  );
