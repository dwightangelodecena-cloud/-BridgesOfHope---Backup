create table if not exists public.visitation_settings (
  id text primary key,
  days text[] not null default array['Wednesday', 'Saturday']::text[],
  start_time text not null default '13:00',
  end_time text not null default '17:00',
  updated_at timestamptz not null default now()
);

insert into public.visitation_settings (id)
values ('global')
on conflict (id) do nothing;

alter table public.visitation_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_settings'
      and policyname = 'visitation_settings_select_authenticated'
  ) then
    create policy visitation_settings_select_authenticated
      on public.visitation_settings
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_settings'
      and policyname = 'visitation_settings_upsert_authenticated'
  ) then
    create policy visitation_settings_upsert_authenticated
      on public.visitation_settings
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;
