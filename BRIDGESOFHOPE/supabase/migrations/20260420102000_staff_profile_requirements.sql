/*
  Staff account requirements for admin Staff Management modal.

  Adds optional profile columns used when creating staff/nurse accounts:
  - first_name, last_name, middle_initial
  - department, branch, shift, employment_type
  - address, contact_number

  Safe to re-run (IF NOT EXISTS + idempotent updates).
*/

alter table if exists public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists middle_initial text,
  add column if not exists department text,
  add column if not exists branch text,
  add column if not exists shift text,
  add column if not exists employment_type text,
  add column if not exists address text,
  add column if not exists contact_number text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'middle_initial'
  ) then
    update public.profiles
    set middle_initial = upper(left(regexp_replace(coalesce(middle_initial, ''), '[^A-Za-z]', '', 'g'), 1))
    where middle_initial is not null;
  end if;
end $$;

create index if not exists profiles_account_type_idx on public.profiles(account_type);
create index if not exists profiles_last_name_idx on public.profiles(last_name);
