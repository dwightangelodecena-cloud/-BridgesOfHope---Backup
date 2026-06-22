-- Kalinga revisions: admission workflow, document attachments, appointment reason

-- Expand admission request statuses
alter table public.admission_requests drop constraint if exists admission_requests_status_check;
alter table public.admission_requests add constraint admission_requests_status_check
  check (status in (
    'pending', 'processing', 'in_review',
    'approved', 'declined', 'accepted', 'rejected'
  ));

alter table public.admission_requests
  add column if not exists form_data jsonb,
  add column if not exists attached_files jsonb not null default '[]'::jsonb,
  add column if not exists meeting_date date,
  add column if not exists meeting_time text,
  add column if not exists meeting_scheduled_at timestamptz,
  add column if not exists meeting_completed boolean not null default false,
  add column if not exists documents_complete boolean not null default false,
  add column if not exists required_document_notes text;

alter table public.visitation_requests
  add column if not exists appointment_reason text;

comment on column public.admission_requests.form_data is 'Snapshot of patient admission form at submission.';
comment on column public.admission_requests.attached_files is 'Array of {name, path, url} uploaded documents.';
comment on column public.admission_requests.meeting_date is 'Scheduled BOH meeting date for family admission review.';

-- Admission document storage (family uploads, staff reads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admission-documents',
  'admission-documents',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "admission_docs_select_own_or_staff" on storage.objects;
create policy "admission_docs_select_own_or_staff"
  on storage.objects for select
  using (
    bucket_id = 'admission-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff()
    )
  );

drop policy if exists "admission_docs_insert_own" on storage.objects;
create policy "admission_docs_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'admission-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admission_docs_update_own" on storage.objects;
create policy "admission_docs_update_own"
  on storage.objects for update
  using (
    bucket_id = 'admission-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admission_docs_delete_own" on storage.objects;
create policy "admission_docs_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'admission-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
