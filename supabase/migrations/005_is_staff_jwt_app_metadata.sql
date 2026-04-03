-- Some Supabase users / edge cases store role in app_metadata instead of user_metadata.
-- Widen public.is_staff() so nurse/admin RLS still passes after login.

create or replace function public.is_staff ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt () -> 'user_metadata' ->> 'account_type'), ''),
    nullif(trim(auth.jwt () -> 'app_metadata' ->> 'account_type'), ''),
    ''
  )) in ('nurse', 'admin');
$$;

comment on function public.is_staff () is
  'Staff if JWT user_metadata or app_metadata account_type is nurse or admin (no profiles read).';

grant execute on function public.is_staff () to authenticated;
grant execute on function public.is_staff () to service_role;
