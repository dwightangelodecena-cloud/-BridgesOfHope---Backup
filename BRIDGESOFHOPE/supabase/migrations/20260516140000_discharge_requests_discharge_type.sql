-- Family discharge requests are temporary leave only; staff may record permanent elsewhere.
alter table public.discharge_requests
  add column if not exists discharge_type text not null default 'temporary';

alter table public.discharge_requests
  drop constraint if exists discharge_requests_discharge_type_check;

alter table public.discharge_requests
  add constraint discharge_requests_discharge_type_check
  check (discharge_type in ('temporary', 'permanent'));

comment on column public.discharge_requests.discharge_type is
  'temporary = short-term leave with return expected; permanent = final discharge from program.';
