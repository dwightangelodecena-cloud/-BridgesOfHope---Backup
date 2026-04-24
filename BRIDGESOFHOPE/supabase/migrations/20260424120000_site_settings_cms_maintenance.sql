-- Global flags for the public marketing site (CMS maintenance banner, etc.)
create table if not exists public.site_settings (
  id text primary key,
  cms_maintenance boolean not null default false,
  cms_maintenance_message text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, cms_maintenance)
values ('global', false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Visitors need to read maintenance state without auth
drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "site_settings_insert_admin" on public.site_settings;
create policy "site_settings_insert_admin"
  on public.site_settings
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

drop policy if exists "site_settings_update_admin" on public.site_settings;
create policy "site_settings_update_admin"
  on public.site_settings
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
