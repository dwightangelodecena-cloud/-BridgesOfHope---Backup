# Phase 3 — Shared Daily Reports (Guardian-Hidden, Rolls into Weekly)

Act as a senior full-stack developer and database architect on the
BridgesOfHope admission platform (web admin: `BRIDGESOFHOPE/`, guardian
mobile app: `CapstoneMobile/`, Supabase backend).

> Run this phase after Phase 2 (`phase-2-intelligent-assignment-record-continuity.md`)
> is complete and merged, since daily reports depend on "who is currently
> assigned" to a patient.

Inspect before changing. Do not guess at business rules — if something is
ambiguous or conflicts with what you find in the code, stop and explain the
conflict instead of inventing an answer.

## Context

There is currently no daily report feature — only weekly:

- `BRIDGESOFHOPE/src/pages/program/weekly-report.jsx` (program staff)
- `BRIDGESOFHOPE/src/pages/nurse/medical-report.jsx` (nurse clinical notes)

Plus an AI guardian-facing digest at `BRIDGESOFHOPE/src/lib/weeklyReportDigest.js`.

Guardian ("family" role) visibility is enforced via `BRIDGESOFHOPE/src/components/RoleGuard.jsx`.

## Step 1 — Audit Report (required before any code changes)

1. How are `weekly-report.jsx` and `medical-report.jsx` currently scoped and
   authored (`created_by`), and how does that data reach the guardian-facing
   digest in `weeklyReportDigest.js`?
2. Confirm exactly how `RoleGuard.jsx` enforces the `family` role today —
   route-level only, or also query/RLS-level? Daily reports need the latter.
3. Note any existing audit-logging pattern in the codebase for
   record creation/modification you should reuse for report actions.

## Step 2 — Daily Report Design

1. Add a shared daily report that the assigned nurse and program staff for a
   patient can both contribute to and view. Investigate whether this should
   be one shared table both roles write to, or two role-scoped tables merged
   in the UI — propose an approach before implementing. Suggested fields:
   date, patient, author (nurse/program), activity, observations, progress,
   issues, actions taken, follow-up, timestamps — adapt to match the
   existing `weekly-report.jsx`/`medical-report.jsx` field conventions for
   consistency.
2. Daily reports must never be visible to the "family" (guardian) role —
   enforce this at the RLS/query layer, not just hidden in the UI. Verify a
   guardian can't reach a daily report by manipulating an ID directly.
3. Log report creation/modification (who, when, what changed) using the
   existing audit pattern from Phase 1/2 if one was established, or propose
   one consistent with the codebase's conventions.

## Step 3 — Weekly Rollup

Roll daily reports into the existing weekly report so the weekly report is
effectively a summary of that week's daily entries — staff should not have
to re-enter information that already exists in daily reports. Decide
whether this feeds `weekly-report.jsx`, `medical-report.jsx`, or a new
consolidated view, and whether to reuse the `weeklyReportDigest.js`
AI-summarization pattern for daily→weekly rollup.

If AI assists with the weekly summary draft:
- It must produce a **draft only** — the staff member must review and
  explicitly approve it before it becomes the official weekly report. It
  must never auto-publish.
- This internal weekly report stays staff-only. If a guardian-facing update
  is needed, that must go through the existing separate guardian digest
  (`weeklyReportDigest.js`) rather than exposing the internal report
  directly.

## Process

Work in this order: Audit Report → proposed schema/table design (Plan Mode),
showing where daily reports fit relative to `weekly-report.jsx` and
`medical-report.jsx` → my approval → implementation. Do not skip straight to
code.
