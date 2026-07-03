-- Allow is_staff() to match account_type stored on profiles when JWT metadata is stale.
-- SECURITY DEFINER reads profiles as owner (bypasses RLS) so this does not recurse.

create or replace function public.is_staff ()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text;
  profile_role text;
begin
  jwt_role := lower(trim(coalesce(
    nullif(auth.jwt () -> 'user_metadata' ->> 'account_type', ''),
    nullif(auth.jwt () -> 'app_metadata' ->> 'account_type', ''),
    ''
  )));
  if jwt_role in ('nurse', 'admin') then
    return true;
  end if;

  select lower(trim(coalesce(p.account_type::text, '')))
    into profile_role
  from public.profiles p
  where p.id = auth.uid();

  return profile_role in ('nurse', 'admin');
end;
$$;

comment on function public.is_staff () is
  'Staff if JWT account_type or profiles.account_type is nurse or admin.';

grant execute on function public.is_staff () to authenticated;
grant execute on function public.is_staff () to service_role;
