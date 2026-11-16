# Lucid

A private dream journal. Write the night down before it fades, tag what returns, and watch recall — and lucidity — over time.

**Use it:** [lucid-dreamer.vercel.app](https://lucid-dreamer.vercel.app)

Sign up with email, confirm the address, and you only ever see your own dreams. Visitors who are not signed in land on a public page; signed-in users get a home dashboard.

React + Vite + Tailwind in `app/`. Supabase for Postgres, Auth, and an optional Whisper Edge Function in `supabase/`.

## What’s in the app

- **Home** — morning cue, tonight’s line, streak, recent dreams, 12-week recall
- **Write now / New dream** — dump, full entry, or voice (2 recordings per UTC day, 5 minutes each); a new entry written offline is kept on the device and uploads when the connection returns
- **Dreams** — search that matches parts of words and tag names, filters, same-night grouping, multi-select to tag or delete, undo after a delete
- **Tag page** — span, lucidity, related tags, the dreams themselves
- **Practice** — plan Wake Back To Bed nights and see how many you did, a suggested alarm time from your usual bedtime, a reality-check counter triggered by your own dream signs (from the last dream-sign scan when there is one, otherwise your most used tags), missed cues found in recent dreams, and lucidity counted per attempt
- **Night session** — a dim red screen for the WBTB wake-up: recall a dream, pick the moment you could have noticed or one of your scanned dream signs, rehearse it (MILD), log the attempt; works offline
- **Sleep** — bed and wake times, alarm, a daily sleep-hygiene checklist, WBTB, awakenings, restedness, Garmin REM, and how each kind of night lines up with recall and lucidity
- **Stats** — Recall, Lucid (with an AI scan of your last 10–50 dreams for dream signs, once a day), Patterns (emotion radar, top tags, pairs)
- **Learn** — lucid dreaming basics, sleep stages, recall, journaling, induction methods
- **Tags** — rename, merge, color, tag every entry containing a word or phrase, and recurring words that aren’t tags yet
- **Settings** — appearance (synced to your profile), auto-tag, auto-lock, locked tags with an optional passcode, calendar reminders (morning, bedtime, optional reality-check nudges and a WBTB alert), emotion-scan beta, export and import

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

1. Run in the SQL Editor, in order: `per-user.sql`, `lockdown.sql`, `profiles.sql`, `voice.sql`, `hardening.sql`, `sleep.sql`, `tag-lock.sql`, `practice.sql`, `dream-signs.sql`
2. **Authentication → Email** — enable Email, Confirm email, and signup
3. **URL Configuration** — Site URL and redirects = your app origin
4. Deploy `app/` as a static SPA (Vercel: root `app`, `npm run build`, output `dist`) with the two `VITE_*` variables (plus optional `VITE_SENTRY_DSN` for error reports)

Voice is optional and billed to your OpenAI key (~$0.006/min). From the repo root, after `npx supabase login` and linking the project:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase functions deploy transcribe
```

Dream signs use the same OpenAI key. Run `dream-signs.sql`, then deploy the function. It sends the text of a user's last 10–50 visible dreams to OpenAI, once per account per UTC day. Set `OPENAI_SIGNS_MODEL` as a secret to change the model.

```bash
npx supabase functions deploy dream-signs
```

## Data

RLS on every table; each row is limited to `auth.uid()`.

- `dreams` — date, title, description, lucidity, induction, entry type, favorite
- `tags` / `dream_tags` — names unique per user; a `locked` tag hides itself and its dreams
- `visible_dreams` — dreams minus any with a locked tag, plus `search_text` and `tag_ids` for search and tag filters; the app reads dreams only through this view
- `profiles` — settings and Stats filters
- `practice_days` — one row per day: reality checks counted, and the night session done for that morning (cue, dream used). Until `practice.sql` is run, these stay on the device and upload once the table exists
- `voice_daily` — recordings used today (UTC), incremented only by `claim_voice_use()`
- `dream_sign_scans` — the day of the last dream-sign scan and its result, written only by the `dream-signs` function
