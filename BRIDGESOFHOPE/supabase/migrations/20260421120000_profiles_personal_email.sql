/*
  Optional personal / recovery email for staff (institutional email is the Auth login).
*/

alter table if exists public.profiles
  add column if not exists personal_email text;
