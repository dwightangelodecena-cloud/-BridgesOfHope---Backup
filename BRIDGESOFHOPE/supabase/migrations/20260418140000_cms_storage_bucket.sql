/*
  Supabase Storage for CMS image uploads (used by CmsImageField → cmsMediaUpload.js).

  Run after 20260418120000_create_site_pages.sql.
  Dashboard → Storage: you should see bucket cms-media (public read).

  If the insert fails, create the bucket manually: Storage → New bucket → name cms-media → Public.
*/

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cms_media_select_public" on storage.objects;
create policy "cms_media_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'cms-media');

drop policy if exists "cms_media_insert_admin" on storage.objects;
create policy "cms_media_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cms-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  );

drop policy if exists "cms_media_update_admin" on storage.objects;
create policy "cms_media_update_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cms-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  );

drop policy if exists "cms_media_delete_admin" on storage.objects;
create policy "cms_media_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cms-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.account_type::text, ''))) = 'admin'
    )
  );
