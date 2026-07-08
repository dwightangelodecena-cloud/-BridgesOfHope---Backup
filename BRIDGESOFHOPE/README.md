# Bridges of Hope (Web)

Admin web app for patient management and admissions/discharge workflows.

## 1) Install and run

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## 2) Environment setup (important)

1. In `BRIDGESOFHOPE/`, copy `.env.example` to `.env`
2. Fill required Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Restart dev server after any `.env` change.

Notes:
- `.env` is ignored by git and should never be committed.
- `CapstoneMobile/.env` is separate; this web app only reads `BRIDGESOFHOPE/.env`.

## 3) Hospital referral scan (Groq)

Admission Management can scan a hospital referral PDF or image and show a structured summary using the **Groq API** (`VITE_GROQ_API_KEY`).

```env
VITE_GROQ_API_KEY=gsk_...
VITE_GROQ_REFERRAL_SCAN_MODEL=llama-3.2-11b-vision-preview
VITE_GROQ_REFERRAL_TEXT_MODEL=llama-3.3-70b-versatile
```

Restart `npm run dev` after changing `.env`.

## 4) Common env troubleshooting

- **Supabase connection issues**
  - Confirm values are in `BRIDGESOFHOPE/.env` (not another folder).
  - Restart `npm run dev`.
- **Still seeing old config**
  - Hard refresh browser (`Ctrl+Shift+R`).
