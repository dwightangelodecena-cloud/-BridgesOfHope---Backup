# Phase 2 — Intelligent Assignment, Inactivity Unassignment & Record Continuity

Act as a senior full-stack developer, software architect, and database
architect on the BridgesOfHope admission platform (web admin:
`BRIDGESOFHOPE/`, guardian mobile app: `CapstoneMobile/`, Supabase backend).

> Run this phase after Phase 1 (`phase-1-appointment-ownership-ai-scheduling.md`)
> is complete and merged.

Inspect before changing. Do not guess at business rules — if something is
ambiguous or conflicts with what you find in the code, stop and explain the
conflict instead of inventing an answer. Preserve existing functionality
unless there's a clear reason to change it.

## Context

Patient-to-staff assignment lives in `BRIDGESOFHOPE/src/lib/staffAssignmentLists.js`,
persisted on the `patients` table via two confusingly-named columns:

- `patients.case_load_manager` is actually the **PROGRAM** staff name
- `patients.program_staff` is actually the assigned **NURSE** name

(see the clarifying comment in `staffAssignmentLists.js`). Do not get these
swapped.

There is currently no `lastActive`/inactivity tracking anywhere in the
codebase, and no unassignment logic for staff (only for room assignment, via
`assignPatientToRoom`/`unassignPatientFromRoom` in `roomAssignment.js`).

Assignment UI/persistence is in `BRIDGESOFHOPE/src/pages/admin/patient-database.jsx`
(save logic and assigned-nurse/program display).

## Step 1 — Audit Report (required before any code changes)

1. How does assignment work today end-to-end (`staffAssignmentLists.js`,
   `patient-database.jsx`) — is it manual admin selection, or is there any
   existing automatic logic?
2. What signals currently exist in the schema that could define "patient
   activity" (appointments, visits, reports, case notes, treatment records)?
   Do not assume — enumerate what's actually queryable today.
3. How are nurse-authored (`medical-report.jsx`, `created_by`-stamped) and
   program-authored (`weekly-report.jsx`) records currently scoped for
   visibility — is there any RLS policy or query filter that ties a record's
   visibility to the *author* rather than the *patient*? If so, that's the
   root cause to fix, not a symptom to work around.
4. Confirm whether records already correctly belong to the patient/case
   (with `author_id`/`author_role` for attribution) or whether they are
   effectively owned by the staff member who created them.

Present this as an Audit Report before proposing the design.

## Step 2 — Intelligent Assignment

Design intelligent patient assignment for nurses and program staff, backed
by **deterministic backend business rules** — not an opaque AI decision.
Consider factors such as: current active-patient workload per
nurse/program, program/specialty compatibility, continuity of care (avoid
needless reassignment), and any existing schedule/availability signals in
the schema. The system should recommend an appropriate nurse/program based
on this logic (e.g. lower current caseload) rather than assigning
arbitrarily. AI may assist with the recommendation *explanation*, but the
backend must enforce the actual assignment rule. Propose your heuristic
before implementing.

## Step 3 — Automatic Assignment Expiration

Before implementing a timer, establish the actual business meaning of
"inactive" from what's queryable in the current schema (Step 1, item 2) —
do not arbitrarily pick a signal.

- Auto-unassign a nurse/program from a patient after 4–7 days of inactivity,
  with the threshold as a configurable constant (e.g.
  `INACTIVE_ASSIGNMENT_DAYS = 7`), not hardcoded inline.
- Investigate whether this should run as a Supabase scheduled/edge function
  or a client-side check-on-load, and propose the approach before
  implementing.
- **Preserve history — do not delete assignment records.** Track
  `assigned_at`, `assigned_by`, `ended_at`, `ended_reason`, `status` so past
  assignments remain auditable even after expiration/reassignment.

## Step 4 — Record Continuity & Access Control

- Ensure patient records follow the **patient/case**, not the individual
  staff member: when Patient 1 moves from Nurse 1 to Nurse 2, Nurse 2 must
  be able to see Nurse 1's prior notes/observations for that patient, with
  authorship (`author_id`, `author_role`, `created_at`) preserved per record.
- Check current RLS policies for anything that scopes visibility by author
  rather than patient, and loosen only what's needed for the
  currently-assigned nurse/program — not a blanket opening.
- Implement role- and assignment-based authorization: assigned staff see
  the records relevant to their assignment; unassigned nurses/programs
  should not have access unless explicitly authorized; guardians must never
  see internal clinical/administrative records. Verify this server-side —
  do not rely on hiding UI elements. Specifically confirm a user can't reach
  another patient's records by manipulating an ID in a request.

## Process

Work in this order: Audit Report → proposed assignment heuristic + schema
changes (Plan Mode) → my approval → implementation. Do not skip straight to
code.
