# Bridges of Hope (Web)

Admin web app for patient management, admissions/discharge workflows, and weekly AI care recommendations.

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

## 3) Weekly AI provider setup

The weekly AI insights feature supports:
- `groq`
- `gemini`
- `openai`
- `anthropic`

Set one of the provider keys in `.env`. You can also force provider selection with:

```env
VITE_AI_WEEKLY_REPORT_PROVIDER=groq
```

If `VITE_AI_WEEKLY_REPORT_PROVIDER` is not set, the app auto-selects based on whichever API key exists.

### Recommended free setup (Groq)

```env
VITE_AI_WEEKLY_REPORT_PROVIDER=groq
VITE_GROQ_API_KEY=gsk_...
VITE_GROQ_WEEKLY_REPORT_MODEL=llama-3.1-8b-instant
```

### Alternative providers

```env
# Gemini
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_WEEKLY_REPORT_MODEL=gemini-2.0-flash

# OpenAI
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_WEEKLY_REPORT_MODEL=gpt-4o-mini

# Anthropic
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_ANTHROPIC_WEEKLY_REPORT_MODEL=claude-3-5-haiku-20241022
```

## 4) Common env troubleshooting

- **AI says provider/env is not set**
  - Confirm values are in `BRIDGESOFHOPE/.env` (not another folder).
  - Restart `npm run dev`.
- **Still seeing old provider errors**
  - Hard refresh browser (`Ctrl+Shift+R`).
- **Provider quota errors**
  - API key is valid; provider-side quota/billing is the issue.
