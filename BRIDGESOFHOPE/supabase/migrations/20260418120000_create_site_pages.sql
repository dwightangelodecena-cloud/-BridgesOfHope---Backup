/*
  STEP-BY-STEP (run in Supabase SQL Editor OR `supabase db push` with CLI)

  1. Open Supabase Dashboard → SQL → New query.
  2. Paste this entire file and Run (creates table + RLS policies).
  3. Confirm Table Editor → public.site_pages exists with columns: slug, content (jsonb), updated_at, updated_by.
  4. Your app already has VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env (same project).
  5. Public home page: anon users can SELECT (read published JSON) — required for visitors without login.
  6. Only users with profiles.account_type = 'admin' can INSERT/UPDATE (CMS Save in admin).
  7. First publish: log in as admin → Content management → Save (creates/updates the 'home' row).
  8. Optional: seed one row manually in Table Editor — slug = home, content = {} (merge happens in app).

  Troubleshooting:
  - Save fails with RLS: ensure your user’s row in public.profiles has account_type = admin.
  - Empty read: no row yet — use Save once or insert a row.
*/

-- Site-wide CMS document (one row per slug; app uses slug 'home')
create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default 'home',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists site_pages_slug_idx on public.site_pages (slug);

alter table public.site_pages enable row level security;

-- Anyone can read (marketing site loads without auth)
drop policy if exists "site_pages_select_public" on public.site_pages;
create policy "site_pages_select_public"
  on public.site_pages
  for select
  to anon, authenticated
  using (true);

-- Helpers: admin check via profiles (matches app RoleGuard / account_type)
drop policy if exists "site_pages_insert_admin" on public.site_pages;
create policy "site_pages_insert_admin"
  on public.site_pages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  );

drop policy if exists "site_pages_update_admin" on public.site_pages;
create policy "site_pages_update_admin"
  on public.site_pages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  );
