# Lucid — Dream Journal

A private, passcode-locked dream journal. React + Vite + Tailwind on the front end, Supabase (Postgres + Auth) on the back end.

```
.
├── app/                 # the web app (Vite + React + TypeScript)
└── supabase/
    ├── schema.sql       # tables, indexes, RLS policies — run first
    └── autotag.sql      # optional: tag existing dreams from their text
```

Journal exports and seed data stay on your machine (they are git-ignored) so a public clone never includes anyone's dreams.

## 1. Which Supabase keys to use

Open your Supabase project → **Project Settings → API** (or **Settings → API Keys** in newer dashboards). You need exactly two values:

| Value | Where it goes | Notes |
| --- | --- | --- |
| **Project URL** (`https://xxxx.supabase.co`) | `VITE_SUPABASE_URL` | |
| **anon / publishable** key (`eyJ…` or `sb_publishable_…`) | `VITE_SUPABASE_ANON_KEY` | Safe to ship to the browser. |

**Do not** use the **`service_role` / secret** key anywhere in the app. It bypasses Row Level Security and anyone who opens DevTools could read it. The anon key on its own cannot read your dreams — RLS only grants access to a signed-in user.

## 2. Create the database

In the Supabase dashboard → **SQL Editor**:

1. Paste and run `supabase/schema.sql`. This creates the `dreams`, `tags`, `dream_tags` tables, full-text search, the `tags_with_counts` view, and RLS policies that only allow **authenticated** users.
2. Add dreams in the app, or import your own SQL. A local `supabase/seed.sql` is git-ignored on purpose so personal entries never land in a public clone.
3. Optional: run `supabase/autotag.sql` after you have entries. It scans title + description and attaches tags for people, places, themes (flying, family, school…) and lucid techniques (false awakening, reality check, DILD…). Edit the rule list at the top of the file before running; it only ever adds links, and you can clean up afterwards in the app's Tags page. The same rules run live in the new-dream form.

## 3. Create the passcode user

The app has one account. The **passcode you type on the lock screen is that account's password**.

1. **Authentication → Users → Add user → Create new user**
2. Email: anything you like (e.g. `me@dreams.local`) — you never see it in the app
3. Password: your passcode (min 6 characters; digits only is fine, the lock screen has a keypad)
4. Tick **Auto Confirm User**
5. Recommended: **Authentication → Providers → Email → disable "Allow new users to sign up"**, so nobody else can create an account.

To change your passcode later, edit the user's password in that same screen.

## 4. Run the app locally

```bash
cd app
cp .env.example .env        # then fill in the three values
npm install
npm run dev                 # http://localhost:5173
```

`.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_EMAIL=me@dreams.local
```

`app/.env` is git-ignored. If a placeholder `.env` already exists from development, overwrite it with your real values.

## 5. Deploy

Any static host works. `npm run build` outputs `app/dist`.

- **Vercel / Netlify**: import the repo, set root directory to `app`, build command `npm run build`, output `dist`, and add the three `VITE_*` variables in the project's environment settings. Both hosts need an SPA fallback so `/stats`, `/dream/…` etc. load on refresh:
  - Netlify: create `app/public/_redirects` containing `/* /index.html 200`
  - Vercel: create `app/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Then in Supabase → **Authentication → URL Configuration**, add your deployed URL to **Site URL / Redirect URLs**.

## Features

- **Passcode lock** — Supabase email/password under the hood; optional auto-lock after inactivity.
- **Dreams list** — pagination, full-text search, filters for date range, lucidity, induction method, tags (any/all), favorites, notes; sort newest/oldest/title. Filters live in the URL so they survive refresh and can be bookmarked.
- **Dream detail** — favorite, edit, delete (with confirmation). Tags link to a filtered list.
- **New / edit dream** — date defaults to today (change freely), entry type (dream/note), lucidity, induction method (DILD, MILD, WBTB, WILD, DEILD, EILD, SSILD, FILD or custom) with notes, tag picker that creates tags inline, auto-saving draft.
- **Stats** — lucidity ring, induction-method ring, dreams-over-time (month/year, toggle series), recall by weekday, top tags, streaks, per-week rate; range 30d / 3m / 6m / 1y / all.
- **Tags** — rename, delete, see usage counts.
- **Settings** — accent color (presets or custom), dark/light/system theme, density, page size, default sort, card previews, auto-lock; export everything as TXT / JSON / CSV.

## Data model

- `dreams` — `date`, `title`, `description`, `lucidity` (`non-lucid | semi-lucid | lucid`), `induction_method`, `induction_notes`, `entry_type` (`dream | note`), `favorite`, `source`, timestamps, generated `search_vector`.
- `tags` — `name` (unique, case-insensitive), optional `color`.
- `dream_tags` — many-to-many.

All tables have RLS enabled with policies for the `authenticated` role only.
