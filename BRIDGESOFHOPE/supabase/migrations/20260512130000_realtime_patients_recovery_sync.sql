-- Allow Supabase Realtime to broadcast patients row changes so family apps can refresh recovery progress.
-- Safe to re-run: skips if the table is already part of the publication.

do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.patients';
    exception
      when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.nurse_recovery_ladders';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
