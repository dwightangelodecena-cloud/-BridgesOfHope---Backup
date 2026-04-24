/*
  Staff Management: admin creates Auth users then upserts public.profiles for another id.
  Uses SECURITY DEFINER helper so policy subqueries do not recurse on RLS.
*/

alter table if exists public.profiles enable row level security;

create or replace function public.bh_is_admin()
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
      and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
  );
$$;

grant execute on function public.bh_is_admin() to authenticated;

-- SELECT: own row, or any row when caller is admin
drop policy if exists "bh_profiles_select_own_or_admin" on public.profiles;
create policy "bh_profiles_select_own_or_admin"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.bh_is_admin());

-- INSERT: new user creates own row, or admin creates staff row
drop policy if exists "bh_profiles_insert_self" on public.profiles;
create policy "bh_profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "bh_profiles_insert_admin" on public.profiles;
create policy "bh_profiles_insert_admin"
  on public.profiles
  for insert
  to authenticated
  with check (public.bh_is_admin());

-- UPDATE: own profile, or admin
drop policy if exists "bh_profiles_update_self" on public.profiles;
create policy "bh_profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "bh_profiles_update_admin" on public.profiles;
create policy "bh_profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.bh_is_admin())
  with check (public.bh_is_admin());
