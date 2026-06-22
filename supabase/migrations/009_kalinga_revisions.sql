-- Kalinga revisions: admission workflow, document attachments, appointment reason

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
