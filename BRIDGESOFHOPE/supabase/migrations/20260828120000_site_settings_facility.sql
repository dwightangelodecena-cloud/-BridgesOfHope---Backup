-- Facility panel settings for the internal Admin Dashboard (bed capacity, card labels).
-- Reuses the existing `site_settings` row ('global') and its RLS policies
-- (public select, admin-only insert/update) from 20260424120000_site_settings_cms_maintenance.sql.
alter table public.site_settings
  add column if not exists facility_settings jsonb;
