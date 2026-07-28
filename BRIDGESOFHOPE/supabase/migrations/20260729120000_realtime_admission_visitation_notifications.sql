-- Extend Realtime delivery (same mechanism as 20260512130000_realtime_patients_recovery_sync.sql)
-- to admission_requests, visitation_requests, and family_notifications, so guardian and admin
-- screens can push-refresh instead of only refetching on focus/manual refresh. RLS already governs
-- what each client can select; this only enables the delivery mechanism, not new access.
-- Safe to re-run: skips any table already part of the publication.

do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.admission_requests';
    exception
      when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.visitation_requests';
    exception
      when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.family_notifications';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
