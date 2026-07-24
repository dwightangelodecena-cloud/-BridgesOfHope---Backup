-- Real, DB-backed guardian notifications (replaces the old web-local-storage-only
-- appendFamilyNotificationsIfNew, which wrote to the admin's own browser and never
-- reached the guardian). Stores the fully-rendered text so template edits never
-- rewrite notification history.

create table if not exists public.family_notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references auth.users (id) on delete cascade,
  template_key text references public.notification_templates (template_key) on delete set null,
  title text,
  body text not null,
  related_type text,
  related_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists family_notifications_family_id_idx
  on public.family_notifications (family_id, created_at desc);

comment on table public.family_notifications is 'Guardian-facing notifications, rendered from notification_templates at insert time.';

alter table public.family_notifications enable row level security;

drop policy if exists "family_notifications_select_own" on public.family_notifications;
create policy "family_notifications_select_own"
  on public.family_notifications
  for select
  to authenticated
  using (family_id = auth.uid());

drop policy if exists "family_notifications_update_own_read" on public.family_notifications;
create policy "family_notifications_update_own_read"
  on public.family_notifications
  for update
  to authenticated
  using (family_id = auth.uid())
  with check (family_id = auth.uid());

drop policy if exists "family_notifications_insert_staff" on public.family_notifications;
create policy "family_notifications_insert_staff"
  on public.family_notifications
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());
