# Phase 1 — Appointment Ownership, Synchronization & AI Scheduling Suggestions

Act as a senior full-stack developer and software architect on the
BridgesOfHope admission platform (web admin: `BRIDGESOFHOPE/`, guardian
mobile app: `CapstoneMobile/`, Supabase backend).

Inspect before changing. Identify root causes before proposing fixes. Do not
guess at business rules — if something is ambiguous or conflicts with what
you find in the code, stop and explain the conflict instead of inventing an
answer.

## Context

The appointment/admission flow is meant to be negotiated — guardian proposes
a date, admin accepts or reschedules — spanning:

- `BRIDGESOFHOPE/src/pages/admin/admission-management.jsx`
- `BRIDGESOFHOPE/src/pages/admin/admin-appointments.jsx`
- `BRIDGESOFHOPE/src/lib/visitationAppointments.js`
- `CapstoneMobile/lib/admissionMeetingRequestMobile.ts`
- `CapstoneMobile/lib/visitationAppointmentsMobile.ts`

Status strings (`processing`, `pending`, `awaiting_schedule_review`,
`awaiting_guardian_response`, `in_review`, `declined`) are duplicated ad hoc
across both codebases with no canonical enum. That inconsistency — not
necessarily wrong ownership — is the suspected root cause of admin/mobile
desync. Confirm or correct this diagnosis with evidence before fixing it.

## Step 1 — Audit Report (required before any code changes)

Trace the full appointment data flow: **Mobile → Backend/Supabase →
Database → Realtime/state management → Admin Web → Mobile**. For the
appointment feature specifically, answer:

1. Where does an appointment request originate today, and where can the
   admin currently create/schedule one without a prior guardian request?
2. What is the complete current set of status values, and where does each
   get read/written (list files + line ranges)?
3. How does the admin side learn that a guardian made changes, and vice
   versa — Supabase Realtime subscription, polling, manual refresh, or
   nothing? Can stale state be displayed after a refresh/reconnect?
4. What happens if two admins act on the same appointment concurrently, or a
   guardian cancels while an admin is mid-accept? Is there any DB constraint,
   transaction, or optimistic-concurrency check preventing conflicting
   writes, or is correctness only assumed from frontend behavior?
5. Are there any duplicate-booking or conflicting-schedule scenarios
   currently possible (e.g. two requests landing on the same slot)?

Present this as an Audit Report before proposing the fix.

## Step 2 — Design & Fix

1. Define a single canonical status lifecycle (e.g. `Pending → Accepted →
   Completed`, with `Reschedule Requested`, `Rejected`, `Cancelled` as
   alternate branches) — adapt to what the existing architecture actually
   supports rather than inventing new statuses wholesale. This must become
   the single source of truth referenced by DB, backend, Admin Web, Mobile,
   notifications, and reports — no more ad hoc string duplication.
2. Fix so the admin can only respond to guardian-submitted requests (accept
   or reschedule) — never originate a meeting from Admission Management
   unprompted. If an administrative override is genuinely required by
   existing business rules, implement it as a clearly separated, authorized,
   audit-logged function rather than folding it into the normal flow.
3. Add concurrency safety: appropriate database constraints (e.g. unique
   constraint on slot/patient), transactions, and/or optimistic-concurrency
   checks so two admins can't accept the same appointment and a
   cancel-during-accept race can't corrupt state. Server-side validation is
   required — do not rely on frontend checks alone.
4. Add audit logging for appointment lifecycle events (created, accepted,
   rejected, rescheduled, cancelled) — who did it, when, and the before/after
   status. Use existing logging/audit patterns in the codebase if present.

## Step 3 — AI-Assisted Date Recommendations

Use the existing Groq pattern (see `src/lib/hospitalReferralScan.js`,
`aiNotificationDraft.js`, `weeklyReportDigest.js` for the established
fetch/prompt/parse structure).

- **Guardian-facing**: suggest available dates/times based on the admin's
  current schedule load.
- **Admin-facing (reschedule flow)**: suggest optimal reschedule dates based
  on appointment density, staff/nurse/program availability, and existing
  conflicts. Compare against the existing rule-based `predictiveAnalytics.js`
  and tell me whether AI or rule-based logic fits better here, and why.

**Hard constraints — AI recommends, it never decides:**
- Actual availability must always be read from the database/backend. The AI
  must never invent or assume available slots.
- The AI must never modify an appointment directly — every AI suggestion
  requires explicit user (admin or guardian) confirmation before it's
  applied.
- Do not let the AI expose patient information beyond what the requesting
  role is already authorized to see.
- Where practical, persist the recommendation itself: what was suggested,
  what factors were considered, the timestamp, and which user accepted it —
  so recommendations are auditable after the fact.

## Process

Work in this order: Audit Report → proposed canonical status design (Plan
Mode) → my approval → implementation. Do not skip straight to code.
