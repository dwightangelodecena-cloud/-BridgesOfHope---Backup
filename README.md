# Bridges of Hope (Kalinga)

Case-management system for an inpatient recovery facility: admissions, discharge, ward/room
management, patient progress tracking, and family communication.

This repo is a monorepo with two independently deployable apps sharing one Supabase backend:

| App | Path | Stack | Who it's for |
|---|---|---|---|
| Web | [`BRIDGESOFHOPE/`](./BRIDGESOFHOPE) | Vite + React 19 | Admin, nurse, and program staff |
| Mobile | [`CapstoneMobile/`](./CapstoneMobile) | Expo + React Native | Patients' families |

**Docs:**
- [Product Requirements (PRD)](./docs/PRD.md) — what the product does and for whom.
- [Architecture](./docs/ARCHITECTURE.md) — how it's built, repo layout, deployment.
- [QA test cases](./docs/qa/Capstone_QA_Test_Cases_Web_and_Mobile.md) — web & mobile test plan.

## Quick start

### Web (`BRIDGESOFHOPE/`)
```bash
cd BRIDGESOFHOPE
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```
Full setup details (Groq API, troubleshooting): [`BRIDGESOFHOPE/README.md`](./BRIDGESOFHOPE/README.md).

### Mobile (`CapstoneMobile/`)
```bash
cd CapstoneMobile
npm install
cp .env.example .env   # or run `npm run sync-env` to copy values from ../BRIDGESOFHOPE/.env
npm run start:clear
```
Full setup details (Expo Go, device pairing): [`CapstoneMobile/README.md`](./CapstoneMobile/README.md).

Both apps must point at the **same Supabase project** — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#5-backend-supabase).

## Database

Migrations live in **`BRIDGESOFHOPE/supabase/migrations/`** — that's the single source of truth
for schema changes. There is no other migrations folder in this repo.

## Deploying the web app to Vercel

The web app lives in the `BRIDGESOFHOPE/` subfolder, so one manual project setting is required:

1. Import this repo into Vercel.
2. **Settings → General → Root Directory** → set to `BRIDGESOFHOPE`.
3. Add environment variables (Production + Preview) matching `BRIDGESOFHOPE/.env.example`:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally the `VITE_GROQ_*` /
   `VITE_STAFF_EMAIL_ROOT_DOMAIN` vars.
4. Deploy. Framework preset (Vite), build command, and SPA rewrites are already configured via
   `BRIDGESOFHOPE/package.json` and `BRIDGESOFHOPE/vercel.json` — no further changes needed.
5. In Supabase Auth → URL Configuration, add `<your-vercel-domain>/auth/callback` as an allowed
   redirect URL.

The mobile app is not deployed to Vercel — it ships via Expo/EAS. See
[`CapstoneMobile/README.md`](./CapstoneMobile/README.md).

## CI

`.github/workflows/ci.yml` lints and builds the web app (blocking) and lints/typechecks the
mobile app (currently non-blocking) on every push and pull request.
