-- Ward & Room Management refinement: rooms are 2 beds (bottom/upper bunk), not 3.
-- Client feedback: the physical bunk beds only have 2 levels, not 3 — the "Middle" bunk
-- never existed in real life and was inflating room capacity/occupancy counts incorrectly.

-- Any resident currently placed on a "Middle" bunk has no equivalent level anymore —
-- unassign them from the room (clears bunk_level/room_id/room_code) so they surface in
-- "unassigned residents" for staff to manually re-place on a real bunk.
update public.patients
set room_id = null, room_code = null, bunk_level = null
where bunk_level = 'Middle';

-- Existing rooms were created at capacity 3; bring them down to the real 2-bed capacity.
update public.rooms set capacity = 2 where capacity <> 2;

alter table public.rooms drop constraint if exists rooms_capacity_check;
alter table public.rooms alter column capacity set default 2;
alter table public.rooms add constraint rooms_capacity_check check (capacity = 2);

comment on column public.rooms.capacity is 'Fixed at 2 beds per room (bottom + upper bunk only).';
