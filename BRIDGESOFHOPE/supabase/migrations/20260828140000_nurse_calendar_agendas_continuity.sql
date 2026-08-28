-- Continuity of care fix: nurse calendar notes are patient records and must follow the
-- PATIENT, not stay locked to the authoring nurse. Previously SELECT required
-- auth.uid() = nurse_user_id, so a reassigned nurse (or admin) could not see a prior
-- nurse's calendar notes for a shared patient at all. Writes stay restricted to the
-- authoring nurse (or admin) so notes can't be edited by someone else — only reading
-- is opened up for continuity.

drop policy if exists "nurse_calendar_agendas_select_own" on public.nurse_calendar_agendas;
create policy "nurse_calendar_agendas_select_internal_staff"
  on public.nurse_calendar_agendas
  for select
  to authenticated
  using (public.bh_is_internal_staff());

comment on policy "nurse_calendar_agendas_select_internal_staff" on public.nurse_calendar_agendas is
  'Any internal staff (admin/nurse/program) can read calendar notes for continuity of care across reassignment. Insert/update/delete remain restricted to the authoring nurse.';
