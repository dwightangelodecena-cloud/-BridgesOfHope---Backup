/*
  Dashboard Facility "Staff" count: full-table count under RLS-safe path.

  Problem: bh_is_admin() only checks profiles.account_type. Admins who only have
  account_type in JWT user_metadata still pass the app RoleGuard but RLS only
  returns their own profile row—often with empty account_type—so client-side
  filters yield 0.

  This RPC runs as SECURITY DEFINER, counts non-family profiles, and only runs
  when the caller is admin via profile OR JWT metadata (same spirit as RoleGuard).
*/

create or replace function public.bh_dashboard_staff_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  jwt_meta text;
  jwt_app text;
  n bigint;
begin
  jwt_meta := lower(trim(coalesce((select auth.jwt())->'user_metadata'->>'account_type', '')));
  jwt_app := lower(trim(coalesce((select auth.jwt())->'app_metadata'->>'account_type', '')));

  select
    jwt_meta = 'admin'
    or jwt_app = 'admin'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  into is_admin;

  if not coalesce(is_admin, false) then
    return null;
  end if;

  select count(*)::bigint into n
  from public.profiles p
  where lower(trim(coalesce(p.account_type::text, ''))) <> 'family';

  return n;
end;
$$;

grant execute on function public.bh_dashboard_staff_count() to authenticated;

comment on function public.bh_dashboard_staff_count() is
  'Admin dashboard: count of profiles excluding account_type family. Uses JWT or profile admin check.';
