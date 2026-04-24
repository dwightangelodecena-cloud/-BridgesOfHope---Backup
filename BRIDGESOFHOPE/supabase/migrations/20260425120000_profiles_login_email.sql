-- Sign-in email (e.g. decenad@nurse.bridgesofhope.ph); stored for admin directory display.
alter table if exists public.profiles
  add column if not exists login_email text;
