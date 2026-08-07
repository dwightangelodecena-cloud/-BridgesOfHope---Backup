# Architecture — Bridges of Hope (Kalinga)

## 1. System overview

```
┌─────────────────────┐     ┌──────────────────────┐
│   Web app (staff)    │     │  Mobile app (family) │
│   BRIDGESOFHOPE/     │     │   CapstoneMobile/     │
│   Vite + React       │     │   Expo + React Native │
└──────────┬───────────┘     └───────────┬───────────┘
           │                             │
           │        @supabase/supabase-js (shared project)
           └──────────────┬──────────────┘
                           ▼
                 ┌───────────────────────┐
                 │       Supabase        │
                 │ Postgres + Auth        │
                 │ Storage + Realtime     │
                 │ Edge Functions (Deno)  │
                 └───────────────────────┘
                           │
                 ┌─────────┴─────────┐
                 │   Groq API (AI)    │  hospital referral scan,
                 │   Resend (email)   │  AI-drafted notifications,
                 └────────────────────┘  staff welcome emails
```

Both clients are independent deployables that talk directly to the same Supabase project — there
is no custom backend server. Business logic that must run with elevated privileges (creating/
deleting staff auth users, sending transactional email) lives in Supabase Edge Functions, not in
either client.

## 2. Repository layout

This is a monorepo. Top-level layout:

```
/
├── BRIDGESOFHOPE/     # Web app (staff) — deployable to Vercel. See its own README.md.
├── CapstoneMobile/    # Mobile app (family) — Expo/EAS. See its own README.md.
├── docs/              # PRD, architecture, QA test docs (this folder)
└── .github/workflows/ # CI (lint + build/typecheck for both apps)
```

**Migrations live under `BRIDGESOFHOPE/supabase/migrations/`** — that is the single source of
truth for the database schema. There is intentionally no root-level `supabase/` folder; an
earlier, stale duplicate was removed because it predated the current migration set and nothing
referenced it.

`CapstoneMobile/` and `BRIDGESOFHOPE/` each have their own `package.json`, `.env.example`, and
`README.md` — they are built, run, and versioned independently even though they live in one repo.

## 3. Web app (`BRIDGESOFHOPE/`)

- **Build tool**: Vite 7. **Framework**: React 19 with `react-router-dom` for client-side
  routing (`src/App.jsx` defines all routes).
- **Routing/access control**: routes are grouped by role (`nurse`, `program`, `admin`, `staff`)
  and wrapped in `RoleGuard` (`src/components/RoleGuard.jsx`), which checks the authenticated
  user's role before rendering.
- **Pages**: `src/pages/{admin,nurse,program,auth,public,family}/` — one folder per role/area.
- **Business logic / data access**: `src/lib/*.js` — thin modules wrapping Supabase queries and
  domain logic (e.g. `admissionWorkflow.js`, `dischargeRequestWorkflow.js`,
  `predictiveAnalytics.js`, `staffNotifications.js`). Components call into `lib/`, not into
  `@supabase/supabase-js` directly, so query logic stays reusable and testable in one place.
- **Realtime**: custom hooks (`useAdminRealtimeRefresh`, `useFamilyPatientProgressRealtime`,
  `useAdminUnreadMessages`) subscribe to Supabase Realtime channels for live UI updates.
- **Styling**: Tailwind CSS 4 (`tailwind.config.js`, `postcss.config.js`) plus a handful of
  hand-written CSS modules under `src/styles/` for complex admin layouts.
- **Supabase client**: `src/lib/supabase.js`, configured from `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`.
- **AI integrations**: Groq API for hospital-referral document scanning
  (`src/lib/hospitalReferralScan.js`) and AI-drafted notification text
  (`src/lib/aiNotificationDraft.js`), configured via `VITE_GROQ_API_KEY`.

## 4. Mobile app (`CapstoneMobile/`)

- **Framework**: Expo SDK 57 (React Native 0.86) with **Expo Router** — file-based routing under
  `app/` (`app/tabs/*.tsx` are the authenticated family tabs; top-level files like `login.tsx`,
  `signup.tsx`, `consent.tsx` are the auth/onboarding flow).
- **State**: React Context under `contexts/` (`DarkModeContext`, `SupportChatContext`,
  `TermsContext`).
- **Business logic / data access**: `lib/*.ts` — the mobile equivalents of the web app's `lib/`
  modules (e.g. `admissionWorkflow.ts`, `familyWeeklyReportsMobile.ts`,
  `visitationAppointmentsMobile.ts`), talking to the same Supabase project via
  `lib/supabase.ts`.
- **Env vars**: Expo requires the `EXPO_PUBLIC_` prefix to inline values into the bundle
  (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). `scripts/sync-web-supabase-env.mjs`
  copies these from `../BRIDGESOFHOPE/.env` so both apps stay pointed at the same backend without
  manual duplication.
- **Distribution**: Expo Go for development; EAS Build for production binaries. **Not** deployed
  to Vercel (Vercel serves web output only — see §6).

## 5. Backend (Supabase)

- **Migrations**: `BRIDGESOFHOPE/supabase/migrations/*.sql`, timestamp-ordered, applied via the
  Supabase CLI (`npx supabase db push` / the Supabase dashboard). This is the authoritative
  schema history — do not create a second migrations folder elsewhere in the repo.
- **Row Level Security**: access control for admin/nurse/program/staff/family roles is enforced
  at the database layer via RLS policies defined in the migrations (not just client-side
  `RoleGuard` checks).
- **Edge Functions** (`BRIDGESOFHOPE/supabase/functions/`, Deno runtime):
  - `create-staff-auth-user` — provisions a Supabase Auth user for a new staff account
    (privileged; can't run client-side with the anon key).
  - `delete-staff-auth-user` — deprovisions a staff account.
  - `send-staff-welcome-email` — sends the initial-password welcome email via Resend.
- **Email templates**: `BRIDGESOFHOPE/supabase/templates/` (`confirm_signup.html`,
  `recovery.html`) — used by Supabase Auth's transactional emails.

## 6. Deployment

### Web → Vercel
The web app is a subfolder (`BRIDGESOFHOPE/`), not the repo root, so Vercel's monorepo support is
used instead of moving files:

1. In the Vercel project's **Settings → General → Root Directory**, set it to `BRIDGESOFHOPE`.
2. Framework preset: Vite (auto-detected). Build command `npm run build`, output directory
   `dist` (from `BRIDGESOFHOPE/package.json` / `vite.config.js` — unchanged, no config needed).
3. Set environment variables in the Vercel project (Production + Preview) matching
   `BRIDGESOFHOPE/.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally
   `VITE_GROQ_API_KEY` / `VITE_GROQ_REFERRAL_SCAN_MODEL` / `VITE_GROQ_REFERRAL_TEXT_MODEL` /
   `VITE_STAFF_EMAIL_ROOT_DOMAIN`.
4. `BRIDGESOFHOPE/vercel.json` already contains the SPA rewrite (`/(.*) → /index.html`) required
   for client-side routing to work on refresh/deep links.
5. In Supabase Auth → URL Configuration, add the deployed Vercel URL's `/auth/callback` as an
   allowed redirect URL (alongside the local `http://localhost:5173/auth/callback`).

### Mobile → Expo/EAS
Not deployed to Vercel. Distributed via Expo Go (development) and EAS Build (production
App Store / Play Store binaries). See `CapstoneMobile/README.md` for the day-to-day dev flow.

## 7. CI

`.github/workflows/ci.yml` runs on every push/PR:
- **web** job: `npm ci && npm run lint && npm run build` inside `BRIDGESOFHOPE/` — blocking.
- **mobile** job: `npm ci && npm run lint && npm run typecheck` inside `CapstoneMobile/` —
  non-blocking (`continue-on-error: true`) due to pre-existing baseline lint/type issues; flip
  that flag once those are cleaned up.
