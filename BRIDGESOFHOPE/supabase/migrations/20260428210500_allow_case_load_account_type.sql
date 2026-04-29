/*
  Allow case load manager profile account types.

  Fixes error on staff create:
  "new row for relation profiles violates check constraint profiles_account_type_check"
*/

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (
    lower(trim(coalesce(account_type::text, ''))) in (
      'family',
      'nurse',
      'admin',
      'staff',
      'case_manager',
      'case_load_manager',
      'case load manager'
    )
  );
