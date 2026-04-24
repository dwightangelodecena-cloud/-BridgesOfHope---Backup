do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_select_anon'
  ) then
    create policy visitation_requests_select_anon
      on public.visitation_requests
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_insert_anon'
  ) then
    create policy visitation_requests_insert_anon
      on public.visitation_requests
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_requests'
      and policyname = 'visitation_requests_update_anon'
  ) then
    create policy visitation_requests_update_anon
      on public.visitation_requests
      for update
      to anon
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_settings'
      and policyname = 'visitation_settings_select_anon'
  ) then
    create policy visitation_settings_select_anon
      on public.visitation_settings
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'visitation_settings'
      and policyname = 'visitation_settings_upsert_anon'
  ) then
    create policy visitation_settings_upsert_anon
      on public.visitation_settings
      for all
      to anon
      using (true)
      with check (true);
  end if;
end
$$;
