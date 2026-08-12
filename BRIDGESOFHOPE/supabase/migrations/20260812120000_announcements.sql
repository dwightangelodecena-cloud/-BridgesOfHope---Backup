-- Family-app promotional "announcements" (staff-composed, shown as a popup on the mobile app).
-- Audience is always family/guardian users — there is deliberately no audience column.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  show_from timestamptz,
  hide_after timestamptz,
  notify_on_publish boolean not null default true,
  notified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_status_window_idx
  on public.announcements (status, show_from, hide_after);

comment on table public.announcements is
  'Family-app promotional announcements ("pop up like an ad"). Audience is always family/guardian users — no audience selector by design. notified_at is set once the "notify on publish" broadcast has actually been sent (only after show_from has passed), so it never double-sends and never sends early.';

alter table public.announcements enable row level security;

-- Staff: full read (including drafts) for the admin list view.
drop policy if exists "announcements_select_staff" on public.announcements;
create policy "announcements_select_staff"
  on public.announcements
  for select
  to authenticated
  using (public.bh_is_internal_staff());

-- Family: read only currently-active published announcements. Postgres RLS OR's multiple
-- select policies together, so staff match the policy above and everyone else falls through
-- to this one — no role-branching needed inside a single using() clause.
drop policy if exists "announcements_select_family_active" on public.announcements;
create policy "announcements_select_family_active"
  on public.announcements
  for select
  to authenticated
  using (
    status = 'published'
    and (show_from is null or show_from <= now())
    and (hide_after is null or hide_after >= now())
  );

drop policy if exists "announcements_insert_staff" on public.announcements;
create policy "announcements_insert_staff"
  on public.announcements
  for insert
  to authenticated
  with check (public.bh_is_internal_staff());

drop policy if exists "announcements_update_staff" on public.announcements;
create policy "announcements_update_staff"
  on public.announcements
  for update
  to authenticated
  using (public.bh_is_internal_staff())
  with check (public.bh_is_internal_staff());

drop policy if exists "announcements_delete_staff" on public.announcements;
create policy "announcements_delete_staff"
  on public.announcements
  for delete
  to authenticated
  using (public.bh_is_internal_staff());
