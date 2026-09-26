# Lucid

A private dream journal. Write the night down before it fades, tag what returns, and watch recall — and lucidity — over time.

**Use it:** [lucid-dreamer.vercel.app](https://lucid-dreamer.vercel.app)

Sign up with email, confirm the address, and you only ever see your own dreams. Visitors who are not signed in land on a public page; signed-in users get a home dashboard.

React + Vite + Tailwind in `app/`. Supabase for Postgres, Auth, and an optional Whisper Edge Function in `supabase/`.

## What’s in the app

- **Home** — morning cue, streak, recent dreams, 12-week recall, voice left today
- **Write now / New dream** — dump, full entry, or voice (2 recordings per UTC day, 5 minutes each; audio is discarded)
- **Dreams** — search and filters (date, lucidity, induction, tags, favorites, notes)
- **Stats** — Recall, Lucid, Patterns (emotion radar, top tags, pairs)
- **Tags** — rename, merge, color
- **Settings** — appearance and list defaults (synced to your profile), auto-tag, auto-lock, emotion-scan beta, export

## Run locally

You need the two public Supabase values from **Project Settings → API** (Project URL and the **anon / publishable** key). Never put the `service_role` key in the app.

```bash
cd app
cp .env.example .env        # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:5173
```

`app/.env` is git-ignored. Point Supabase **Redirect URLs** at `http://localhost:5173/**` as well as production.

## Self-host

The live project already has tables, RLS, and Auth. Only do this for a **new** Supabase project.

1. Run in the SQL Editor, in order: `per-user.sql`, `lockdown.sql`, `profiles.sql`, `voice.sql`
2. **Authentication → Email** — enable Email, Confirm email, and signup
3. **URL Configuration** — Site URL and redirects = your app origin
4. Deploy `app/` as a static SPA (Vercel: root `app`, `npm run build`, output `dist`) with the two `VITE_*` variables

Voice is optional and billed to your OpenAI key (~$0.006/min). From the repo root, after `npx supabase login` and linking the project:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase functions deploy transcribe
```

## Data

RLS on every table; each row is limited to `auth.uid()`.

- `dreams` — date, title, description, lucidity, induction, entry type, favorite
- `tags` / `dream_tags` — names unique per user
- `profiles` — settings and Stats filters
- `voice_daily` — recordings used today (UTC), incremented only by `claim_voice_use()`
