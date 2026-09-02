-- Daily reports gain an explicit week_number so the nurse/program "patient reports" folder
-- view can group them per week without re-deriving from admission dates. New rows are stamped
-- with the patient's current working week by the client; existing rows are backfilled here
-- from report_date vs the patient's admission date (same 7-day window logic as
-- src/lib/dailyReports.js weekDateRange).

alter table public.daily_reports add column if not exists week_number int;

update public.daily_reports d
set week_number = greatest(1, floor((d.report_date - p.admitted_at::date)::numeric / 7)::int + 1)
from public.patients p
where p.id = d.patient_id
  and d.week_number is null
  and p.admitted_at is not null;

-- Rows with no resolvable admission date fall back to week 1.
update public.daily_reports set week_number = 1 where week_number is null;

create index if not exists daily_reports_patient_week_idx
  on public.daily_reports (patient_id, week_number);

comment on column public.daily_reports.week_number is
  'The care week this daily report belongs to. Stamped by the client at creation from the patient''s current working week (max concluded weekly_reports week + 1).';
