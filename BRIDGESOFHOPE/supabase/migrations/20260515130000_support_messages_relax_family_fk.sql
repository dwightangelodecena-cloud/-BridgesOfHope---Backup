-- Allow messages when auth user exists but profiles row is missing (FK was blocking inserts).
alter table if exists public.support_messages
  drop constraint if exists support_messages_family_id_fkey;
