-- Add structured address fields to profiles (family sign-up)
-- Run in Supabase SQL Editor after 001_core_schema.sql

alter table public.profiles
  add column if not exists province text,
  add column if not exists municipality text,
  add column if not exists street text,
  add column if not exists house_block_lot text;

-- Keep new user rows in sync with auth metadata (including phone + address)
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone,
    account_type,
    province,
    municipality,
    street,
    house_block_lot
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'contact_number', '')), ''),
    lower(coalesce(new.raw_user_meta_data->>'account_type', 'family')),
    nullif(trim(coalesce(new.raw_user_meta_data->>'province', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'municipality', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'street', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'house_block_lot', '')), '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        account_type = excluded.account_type,
        phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
        province = coalesce(nullif(excluded.province, ''), public.profiles.province),
        municipality = coalesce(nullif(excluded.municipality, ''), public.profiles.municipality),
        street = coalesce(nullif(excluded.street, ''), public.profiles.street),
        house_block_lot = coalesce(nullif(excluded.house_block_lot, ''), public.profiles.house_block_lot),
        updated_at = now();
  return new;
end;
$$;
