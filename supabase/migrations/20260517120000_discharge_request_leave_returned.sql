-- Track when a resident returns from approved temporary leave (clears UI fallback from discharge_requests).

alter table public.discharge_requests
  add column if not exists leave_returned_at timestamptz;

comment on column public.discharge_requests.leave_returned_at is
  'Set when staff or family marks the resident as returned; null while still on temporary leave.';
