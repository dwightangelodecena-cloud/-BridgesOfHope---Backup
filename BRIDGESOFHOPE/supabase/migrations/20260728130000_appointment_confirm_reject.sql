-- Guardian-facing "Visits" appointment notices (mobile Phase 2): confirm/reject a scheduled
-- meeting, plus a second independent guardian signal confirming an actual discharge pickup
-- happened (in addition to, not instead of, staff's on-site pickup confirmation).

alter table public.patients
  add column if not exists pickup_meeting_rejected_at timestamptz,
  add column if not exists pickup_meeting_rejected_reason text,
  add column if not exists pickup_family_confirmed_at timestamptz;

comment on column public.patients.pickup_meeting_rejected_reason is
  'Guardian-provided reason for rejecting the proposed pickup date/time, shown to admin so they can reschedule.';
comment on column public.patients.pickup_family_confirmed_at is
  'Guardian''s own confirmation (from the mobile app) that they have already picked up the resident. Independent of admin''s pickup_completed_at — both are required before Discharge Management treats pickup as complete.';

alter table public.admission_requests
  add column if not exists meeting_rejected_at timestamptz,
  add column if not exists meeting_rejected_reason text;

comment on column public.admission_requests.meeting_rejected_reason is
  'Guardian-provided reason for rejecting the proposed admission meeting date/time.';

-- patients is a more sensitive table than admission_requests, so guardian writes go through
-- security-definer RPCs (each checks the caller owns the resident) rather than a broad UPDATE
-- policy. admission_requests keeps its existing direct-update precedent (see
-- CapstoneMobile/lib/admissionMeetingRequestMobile.ts) for the same reject action.

create or replace function public.bh_family_confirm_pickup_meeting(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.patients where id = p_patient_id and family_id = auth.uid()) then
    raise exception 'Not authorized to update this resident.';
  end if;
  update public.patients
  set
    pickup_meeting_confirmed_by_family = true,
    pickup_meeting_rejected_at = null,
    pickup_meeting_rejected_reason = null
  where id = p_patient_id;
end;
$$;

create or replace function public.bh_family_reject_pickup_meeting(p_patient_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.patients where id = p_patient_id and family_id = auth.uid()) then
    raise exception 'Not authorized to update this resident.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to reject the pickup time.';
  end if;
  update public.patients
  set
    pickup_meeting_rejected_at = now(),
    pickup_meeting_rejected_reason = trim(p_reason),
    pickup_meeting_confirmed_by_family = false
  where id = p_patient_id;
end;
$$;

create or replace function public.bh_family_confirm_pickup_received(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.patients where id = p_patient_id and family_id = auth.uid()) then
    raise exception 'Not authorized to update this resident.';
  end if;
  update public.patients
  set pickup_family_confirmed_at = now()
  where id = p_patient_id;
end;
$$;

grant execute on function public.bh_family_confirm_pickup_meeting(uuid) to authenticated;
grant execute on function public.bh_family_reject_pickup_meeting(uuid, text) to authenticated;
grant execute on function public.bh_family_confirm_pickup_received(uuid) to authenticated;
