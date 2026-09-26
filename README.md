# Lucid — Dream Journal

A private dream journal. Each person signs up with email, confirms the address, and only sees their own dreams. React + Vite + Tailwind on the front end, Supabase (Postgres + Auth) on the back end.

The repo is `app/` (Vite + React + TypeScript) plus `supabase/functions/transcribe` for optional voice notes. The live Supabase project already has the tables.

## 1. Which Supabase keys to use

Open your Supabase project → **Project Settings → API** (or **Settings → API Keys** in newer dashboards). You need exactly two values:

| Value | Where it goes | Notes |
| --- | --- | --- |
| **Project URL** (`https://xxxx.supabase.co`) | `VITE_SUPABASE_URL` | |
| **anon / publishable** key (`eyJ…` or `sb_publishable_…`) | `VITE_SUPABASE_ANON_KEY` | Safe to ship to the browser. |

**Do not** use the **`service_role` / secret** key anywhere in the app. It bypasses Row Level Security and anyone who opens DevTools could read it. The anon key on its own cannot read your dreams — RLS only grants access to a signed-in user.

## 2. Per-user accounts (required before signup)

Journals must be scoped to `auth.uid()`. Run these in **Supabase → SQL Editor** before anyone else can sign up, or every signed-in user could see the existing journal:

1. `supabase/per-user.sql` — add owners and per-user RLS
2. `supabase/lockdown.sql` — revoke leftover public/anon privileges and force RLS
3. `supabase/profiles.sql` — theme, list, and Stats preferences on the account
4. `supabase/voice.sql` — 2 voice recordings per account per UTC day

Then:

1. **Authentication → Providers → Email** — enable Email, enable **Confirm email**, enable **Allow new users to sign up**.
2. **Authentication → URL Configuration** — Site URL = your app origin. Redirect URLs must include `http://localhost:5173/**` and the production origin.
3. Your existing account still works: sign in with that email and the old passcode (now just the password).

Confirm emails and password-reset emails come from Supabase (default templates). Custom SMTP is optional under **Project Settings → Auth**.

## 3. Run the app locally

```bash
cd app
cp .env.example .env        # then fill in the two values
npm install
npm run dev                 # http://localhost:5173
```

`.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`app/.env` is git-ignored. If a placeholder `.env` already exists from development, overwrite it with your real values.

## 4. Deploy

Any static host works. `npm run build` outputs `app/dist`.

- **Vercel / Netlify**: import the repo, set root directory to `app`, build command `npm run build`, output `dist`, and add the two `VITE_*` variables in the project's environment settings. Both hosts need an SPA fallback so `/stats`, `/dream/…` etc. load on refresh:
  - Netlify: create `app/public/_redirects` containing `/* /index.html 200`
  - Vercel: create `app/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Then in Supabase → **Authentication → URL Configuration**, add your deployed URL to **Site URL / Redirect URLs**.

## 5. Voice (optional)

Write now and New dream have a **Record** button: tap, talk, tap stop. Recording stops on its own after **5 minutes**. Each account can send **2 recordings per UTC day**; the Edge Function refuses a third before it calls Whisper. The clip is sent once and then discarded — it is never stored.

This is **not free**. OpenAI Whisper is about **$0.006 per minute** of audio (a typical morning dump is well under a cent). You need an OpenAI API key with billing enabled. The daily cap keeps a shared key from being run all day.

One-time setup (from the repo root, after `npx supabase login` and linking this project):

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase functions deploy transcribe
```

Until that function is deployed, Record will show an error instead of text.

## Features

- **Accounts** — email + password, confirm-email signup, password reset; optional auto-lock after inactivity. Each account only sees its own dreams and tags. Appearance and Stats filters sync on the profile.
- **Dreams list** — pagination, full-text search, filters for date range, lucidity, induction method, tags (any/all), favorites, notes; sort newest/oldest/title. Filters live in the URL so they survive refresh and can be bookmarked.
- **Dream detail** — favorite, edit, delete (with confirmation). Tags link to a filtered list.
- **New / edit dream** — date defaults to today (change freely), entry type (dream/note), lucidity, induction method (DILD, MILD, WBTB, WILD, DEILD, EILD, SSILD, FILD or custom) with notes, tag picker that creates tags inline, auto-saving draft. Write now and New dream can **Record** a voice dump (transcribed, audio discarded; 2 per day, 5 minutes each).
- **Stats** — snapshot (counts, streaks) then three views: Recall (calendar, weekday, tips), Lucid (rings, trend), Patterns (emotion radar, top tags, pairs). Range 30d / 3m / 6m / 1y / all.
- **Tags** — rename, delete, see usage counts.
- **Settings** — accent color (presets or custom), dark/light/system theme, density, page size, default sort, card previews, auto-lock; these and Stats filters sync to your profile; beta scan that proposes emotion tags on older dreams (review before apply); export everything as TXT / JSON / CSV.

## Data model

- `dreams` — `date`, `title`, `description`, `lucidity` (`non-lucid | semi-lucid | lucid`), `induction_method`, `induction_notes`, `entry_type` (`dream | note`), `favorite`, `source`, timestamps, generated `search_vector`.
- `tags` — `name` (unique, case-insensitive), optional `color`.
- `dream_tags` — many-to-many.
- `profiles` — one row per auth user; `settings` and `stats` jsonb. Seeded on signup.
- `voice_daily` — recordings used today (UTC); increment only via `claim_voice_use()`.

All tables have RLS enabled. After `per-user.sql`, policies restrict each row to `auth.uid()`.
