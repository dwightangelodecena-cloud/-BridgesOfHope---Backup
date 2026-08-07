# Product Requirements Document — Bridges of Hope (Kalinga)

## 1. Overview

Bridges of Hope (product name shown in-app: **Kalinga**) is a case-management system for an
inpatient recovery/rehabilitation facility. It replaces manual, paper-based tracking of
admissions, discharges, ward assignments, and patient progress with a shared system used by
facility staff and patients' families.

The product ships as two clients against one shared backend:

- **Web app** (`BRIDGESOFHOPE/`) — the staff-facing system of record: admin, nurse, and program
  staff workflows.
- **Mobile app** (`CapstoneMobile/`) — the family-facing companion app: admissions requests,
  visitation/appointments, and progress updates for a resident's family.

Both clients read and write the same Supabase project (Postgres + Auth + Storage + Edge
Functions + Realtime). See [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical design.

## 2. Problem statement

Facility staff previously tracked admissions, ward/bed capacity, discharge status, and patient
progress across disconnected paper forms and manual communication with families. This causes:

- Delays and errors in admission/discharge processing.
- No single source of truth for ward/room capacity.
- Families having no visibility into a resident's status without calling the facility.
- Manual, error-prone staff notifications about important events (new admission requests,
  discharge readiness, visitation requests).

## 3. Users / roles

| Role | Client | Responsibilities |
|---|---|---|
| **Admin** | Web | Full oversight: admissions/discharge approval, ward & room management, staff & user management, analytics, content management (public landing page), notification templates, printable reports. |
| **Nurse** | Web | Clinical care: medical reports, patient database, pending admissions, recovery ladder/calendar, vitals & medication tracking. |
| **Program staff** | Web | Program-side case management: weekly reports, program calendar, discharge workflow, resident placement. |
| **Staff** (shared) | Web | Cross-role access to appointments, printable reports, and messages (in addition to admin/nurse/program-specific scopes). |
| **Family** | Mobile (primary), Web (`/pages/family`) | Submit admission requests, request visitation/appointments, view resident progress and weekly reports, receive notifications, message staff. |

Role-based access is enforced client-side via `RoleGuard` (`BRIDGESOFHOPE/src/components/RoleGuard.jsx`)
and server-side via Supabase Row Level Security policies defined in the migrations.

## 4. Core features

Derived from the actual page and library structure under `BRIDGESOFHOPE/src/pages/` and
`BRIDGESOFHOPE/src/lib/`:

### Admissions & discharge
- Admission request intake, pre-assessment/pre-admission summaries, and approval workflow.
- Hospital referral document scan: extracts a structured summary from an uploaded referral
  PDF/image using the Groq API (`src/lib/hospitalReferralScan.js`).
- Discharge management, including temporary discharge/leave tracking and pickup-meeting
  scheduling.
- Resident placement and room/ward assignment, with room capacity enforcement.

### Clinical & progress tracking
- Nurse medical reports, vitals, and medication tables.
- Recovery ladder / progress board tracking.
- Weekly program reports, visible to family accounts.
- Realtime patient progress sync (`useFamilyPatientProgressRealtime`).

### Scheduling & communication
- Visitation/appointment requests, confirmation, rescheduling, and cancellation.
- Support messaging between family and staff.
- Staff notifications (broadcast and targeted), with AI-drafted notification content.
- Notification templates management (admin-configurable).
- Family notifications for admission, discharge, progress, and visitation events.

### Administration
- User, staff, and ward/room management.
- Analytics and predictive analytics dashboards.
- Content management system (CMS) for the public landing page, including image uploads and
  custom content blocks.
- Printable reports (admissions, discharge, weekly) via `jspdf`.
- Two-factor approval flow for sensitive admin actions.

## 5. Platforms

- **Web**: desktop-first, used by facility staff on facility computers. Deployed to Vercel.
- **Mobile**: iOS/Android via Expo, used by families. Distributed via Expo/EAS, not Vercel.

## 6. Out of scope

- Billing / payment processing.
- Public self-service account creation for staff roles (staff accounts are provisioned by
  admins).
- Multi-facility / multi-tenant support (current design assumes one facility).

## 7. Success criteria (qualitative)

- Admission and discharge requests are processed without relying on out-of-band communication
  (phone/paper).
- Families can check a resident's status and weekly progress without contacting staff directly.
- Ward/room capacity is never inconsistent between what's recorded and what's physically true.
- Staff receive timely, accurate notifications for events requiring action.
