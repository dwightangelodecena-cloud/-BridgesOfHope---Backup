-- ─────────────────────────────────────────────────────────────────────────────
--  Mobile push notifications for guardians
-- ─────────────────────────────────────────────────────────────────────────────
--  1. device_push_tokens — one row per (guardian, device). The Kalinga mobile
--     app upserts its Expo push token here after login, plus the notification
--     tone the guardian picked in Notification Settings.
--  2. A trigger on family_notifications fires the `send-push-notification` Edge
--     Function (via pg_net) whenever a new guardian notification row is inserted
--     — by ANY producer (progress/discharge/visitation triggers, admin actions),
--     the same "fire from the database, not each call site" pattern used by
--     bh_notify_patient_progress_change (20260729130000_progress_change_notifications.sql).
--
--  ── One-time setup after `supabase db push` (run in the SQL editor) ──────────
--     select vault.create_secret(
--       'https://<PROJECT_REF>.supabase.co/functions/v1/send-push-notification',
--       'push_edge_url');
--     select vault.create_secret('<LONG_RANDOM_STRING>', 'push_hook_secret');
--
--     …then set the SAME random string as the function secret:
--       supabase secrets set PUSH_HOOK_SECRET=<LONG_RANDOM_STRING>
--
--  Until both secrets exist the trigger is a silent no-op, so this migration is
--  safe to apply immediately.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net;

-- ── Token registry ──────────────────────────────────────────────────────────
create table if not exists public.device_push_tokens (
  user_id    uuid not null references auth.users (id) on delete cascade,
  token      text not null,
  platform   text not null default 'unknown' check (platform in ('ios', 'android', 'web', 'unknown')),
  sound      text not null default 'default',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id);

comment on table public.device_push_tokens is
  'Expo push tokens per guardian device, upserted by the Kalinga mobile app. `sound` is the tone chosen in Notification Settings.';

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own"
  on public.device_push_tokens
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
create policy "device_push_tokens_insert_own"
  on public.device_push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
create policy "device_push_tokens_update_own"
  on public.device_push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;
create policy "device_push_tokens_delete_own"
  on public.device_push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

-- ── Fire the Edge Function on every new guardian notification ────────────────
create or replace function public.bh_push_family_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Belt-and-braces: this is a push side-effect only. Nothing here — a missing
  -- extension, an unreachable Vault, a pg_net hiccup — may ever fail or roll
  -- back the family_notifications insert that fired us.
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'push_edge_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'push_hook_secret';

    -- Not configured yet — do nothing (in-app inbox still works).
    if v_url is null or v_secret is null then
      return NEW;
    end if;

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body    := jsonb_build_object(
        'family_id',       NEW.family_id,
        'title',           coalesce(NEW.title, 'Bridges of Hope'),
        'body',            NEW.body,
        'category',        NEW.category,
        'notification_id', NEW.id
      )
    );
  exception when others then
    raise warning 'bh_push_family_notification failed (ignored): %', sqlerrm;
  end;

  return NEW;
end;
$$;

comment on function public.bh_push_family_notification() is
  'AFTER INSERT on family_notifications: POSTs the row to the send-push-notification Edge Function via pg_net. No-op until the push_edge_url / push_hook_secret Vault secrets exist.';

drop trigger if exists family_notifications_push on public.family_notifications;
create trigger family_notifications_push
  after insert on public.family_notifications
  for each row
  execute function public.bh_push_family_notification();
