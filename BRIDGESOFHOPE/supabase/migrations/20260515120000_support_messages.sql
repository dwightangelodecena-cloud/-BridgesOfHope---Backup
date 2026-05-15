-- Family ↔ admin support chat (web + mobile).

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles (id) on delete cascade,
  sender_role text not null check (sender_role in ('family', 'admin')),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_by_family_at timestamptz,
  read_by_admin_at timestamptz
);

create index if not exists support_messages_family_created_idx
  on public.support_messages (family_id, created_at);

comment on table public.support_messages is 'Support chat between family accounts and facility admins.';

alter table public.support_messages enable row level security;

drop policy if exists "support_messages_family_select" on public.support_messages;
create policy "support_messages_family_select"
  on public.support_messages
  for select
  to authenticated
  using (family_id = auth.uid());

drop policy if exists "support_messages_family_insert" on public.support_messages;
create policy "support_messages_family_insert"
  on public.support_messages
  for insert
  to authenticated
  with check (family_id = auth.uid() and sender_role = 'family');

drop policy if exists "support_messages_family_mark_read" on public.support_messages;
create policy "support_messages_family_mark_read"
  on public.support_messages
  for update
  to authenticated
  using (family_id = auth.uid())
  with check (family_id = auth.uid());

drop policy if exists "support_messages_admin_select" on public.support_messages;
create policy "support_messages_admin_select"
  on public.support_messages
  for select
  to authenticated
  using (public.bh_is_admin());

drop policy if exists "support_messages_admin_insert" on public.support_messages;
create policy "support_messages_admin_insert"
  on public.support_messages
  for insert
  to authenticated
  with check (public.bh_is_admin() and sender_role = 'admin');

drop policy if exists "support_messages_admin_mark_read" on public.support_messages;
create policy "support_messages_admin_mark_read"
  on public.support_messages
  for update
  to authenticated
  using (public.bh_is_admin())
  with check (public.bh_is_admin());

do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.support_messages';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
