/*
  Retire case_manager / case_load_manager as profile account_type values.
  Existing rows are normalized to staff (same app access as former CLM workspace users).
  Check constraint and internal-staff helper updated accordingly.
*/

-- Normalize legacy CLM account types to staff
update public.profiles
set account_type = 'staff'
where lower(trim(coalesce(account_type::text, ''))) in (
  'case_manager',
  'case_load_manager',
  'case load manager'
);

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (
    lower(trim(coalesce(account_type::text, ''))) in (
      'family',
      'nurse',
      'admin',
      'staff'
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
        'staff'
      )
  );
$$;
