-- Families must update their own admission requests for attached_files after insert
-- and when uploading supplemental documents during in_review.

drop policy if exists "admission_family_update" on public.admission_requests;
create policy "admission_family_update"
  on public.admission_requests for update
  using (family_id = auth.uid ())
  with check (family_id = auth.uid ());
