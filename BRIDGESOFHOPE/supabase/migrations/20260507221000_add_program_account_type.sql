/*
  Introduce "program" as a first-class profile account_type.
  Also normalize existing generic "staff" accounts to "program".
*/

update public.profiles
set account_type = 'program'
where lower(trim(coalesce(account_type::text, ''))) = 'staff';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (
    lower(trim(coalesce(account_type::text, ''))) in (
      'family',
      'nurse',
      'admin',
      'program'
    )
  );

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
        'program'
      )
  );
$$;
