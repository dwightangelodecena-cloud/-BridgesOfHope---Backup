-- Admin "Recovery Roadmap" UI (route /admin-recovery-roadmap) was removed from the app.
-- That screen had no dedicated tables, views, or RPCs in this repository: it queried
-- public.patients and public.weekly_reports and stored overrides in browser localStorage
-- (e.g. bh_recovery_ladder_overrides_v1, bh_recovery_ladder_profiles_v1).
--
-- Do NOT drop public.nurse_recovery_ladders here — admin Patient Management still uses it
-- for recovery ladder persistence (see migration 20260508235500_create_nurse_recovery_ladders.sql).

select 1;
