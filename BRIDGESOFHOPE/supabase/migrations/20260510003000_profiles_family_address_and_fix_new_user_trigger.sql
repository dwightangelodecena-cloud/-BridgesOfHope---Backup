/*
  Signup trigger failed with "Database error saving new user" because public.profiles
  had no province/municipality/barangay/street/house_block_lot columns in many DBs.
  Add them, then replace the trigger function with a version that matches the app signup payload.
*/

alter table if exists public.profiles
  add column if not exists province text,
  add column if not exists municipality text,
  add column if not exists barangay text,
  add column if not exists street text,
  add column if not exists house_block_lot text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  fn text := nullif(trim(meta->>'first_name'), '');
  ln text := nullif(trim(meta->>'last_name'), '');
  mi text := nullif(trim(meta->>'middle_initial'), '');
  full_n text := nullif(trim(meta->>'full_name'), '');
  phone text := nullif(trim(meta->>'contact_number'), '');
  addr text := nullif(trim(meta->>'address'), '');
  atype text := lower(nullif(trim(meta->>'account_type'), ''));
begin
  if full_n is null and (fn is not null or ln is not null) then
    full_n := trim(
      concat_ws(
        ' ',
        fn,
        case when mi is not null and mi <> '' then upper(left(mi, 1)) || '.' else null end,
        ln
      )
    );
  end if;
  if full_n is null or full_n = '' then
    full_n := 'User';
  end if;
  if atype is null or atype not in ('admin', 'nurse', 'family', 'program') then
    atype := 'family';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    account_type,
    first_name,
    last_name,
    middle_initial,
    province,
    municipality,
    barangay,
    street,
    house_block_lot,
    contact_number,
    address
  )
  values (
    NEW.id,
    full_n,
    phone,
    atype,
    fn,
    ln,
    nullif(trim(upper(left(coalesce(mi, ''), 1))), ''),
    nullif(trim(meta->>'province'), ''),
    nullif(trim(meta->>'municipality'), ''),
    nullif(trim(meta->>'barangay'), ''),
    nullif(trim(meta->>'street'), ''),
    nullif(trim(meta->>'house_block_lot'), ''),
    phone,
    addr
  )
  on conflict (id) do nothing;

  return NEW;
end;
$$;
