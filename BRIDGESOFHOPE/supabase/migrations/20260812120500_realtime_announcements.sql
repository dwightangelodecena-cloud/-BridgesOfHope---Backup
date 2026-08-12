-- Extend Realtime delivery (same mechanism as 20260729120000_realtime_admission_visitation_notifications.sql)
-- to announcements, so the family app's popup can react to publish/edit/expire without a manual
-- refresh. RLS already governs what each client can select; this only enables the delivery
-- mechanism, not new access. Safe to re-run: skips the table if already part of the publication.

do $$
begin
  if exists (select 1 from pg_publication p where p.pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.announcements';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
