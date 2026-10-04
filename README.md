# Pub Bingo

Find the cheapest pint in London. Prices are reported by drinkers and checked against pubs' own menus, then shared live with everyone. It covers central and inner London (Mayfair to Aldgate, Kentish Town to Borough) and Dulwich so far.

It also has a pub bingo card: a 3×3 challenge card you complete by trying pubs and reporting prices.

## What it does

| Area | What you can do |
|---|---|
| **Find** | Search for a drink ("Guinness", "IPA") or pick a category, and see every pub that sells it, cheapest first. The map shows prices; tap it, or use your location, to sort by walking distance. |
| **Pub pages** | Address, opening hours, history, photos, what's on, and the full drinks list. Each price says where it came from (estimate, a drinker, the pub's website, or checked by an admin) and how old it is, with its history. |
| **Report a price** | Signed-in users report what they paid, or add a drink that isn't listed. Every report is kept. A big jump asks "Is that what you paid?" first. |
| **Leaderboard** | The cheapest confirmed pints right now, by category. Halves are compared per pint. Bottles and cans never count as a pint. |
| **What's on** | Pubs with a beer garden, sport, live music, quiz and so on, plus events for tonight, tomorrow, the weekend or the next 7 days (London time). |
| **Feed** | The latest price reports, updating live. |
| **Favourites** | Pubs you've saved, synced to your account. Price watches ("Guinness under £6 in Soho") show matches here. |
| **Bingo** | A 3×3 challenge card. Some tiles tick themselves from what you do in the app; you tick the others. Unticking offers Undo. A weekly card with a streak can be switched on. |
| **Suggestions** | Send ideas, pubs to add or problems, and vote on them. Send a menu or price photo privately to the admins. |
| **Admin** | A spreadsheet of every pub (with CSV download), editing pub details and prices, PDF menu import, events, happy hours, opening hours, held reports, menus sent in, a weekly digest, and feature switches. |

Newer features (happy hours, crawl planner, round calculator, badges, check-ins, price watches and more) each have a switch in **Admin → Features**. They start off; admins can try them first (marked "Not launched") and switch them on for everyone when ready.

## Run it on your computer

You need Node.js 22.

```bash
npm install
cp .env.example .env.local      # add your Supabase URL and anon key
npm run dev                     # http://localhost:5173
```

**No database?** Run `VITE_DEMO_MODE=true npm run dev`. Demo mode uses the seed pubs in memory and resets on reload. The demo admin is `admin` / `password123`. Never turn demo mode on in production.

## Checks

```bash
npm run lint      # ESLint, then knip (unused files, exports and dependencies)
npm test          # unit tests: search, prices, bingo wins, validation, dates, errors…
npm run test:db   # runs every migration and the seed on a real Postgres and checks the security rules
npm run build     # production build into dist/
```

`test:db` needs Postgres (`DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/postgres`). GitHub Actions runs lint, both test suites and the build on every push, and checks that `supabase/seed.sql` matches the seed data.

## Deploy

The app is a static site (Vercel or Netlify) backed by Supabase (database, sign-in, photo storage and live updates). Both free tiers are enough.

1. **Create a Supabase project** at supabase.com.
2. **Create the database.** Either:
   - let GitHub do it (recommended, see [Automatic database updates](#automatic-database-updates)), or
   - paste each file in `supabase/migrations/` into the Supabase SQL editor in order (`0001` to `0010`), then `supabase/seed.sql`. Every file is safe to run again, and the seed never overwrites your prices or edits.
3. In Supabase **Authentication → Providers**, turn on Email (leave "Confirm email" on).
4. In **Authentication → URL Configuration**, set the Site URL to your live address.
5. **Import the repo into Vercel** (or Netlify; `netlify.toml` is included) and add these environment variables from Supabase **Project Settings → API**:
   - `VITE_SUPABASE_URL`: just `https://xxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: the **anon / publishable** key, **never** the service-role key
   - `VITE_PUBLIC_APP_URL` (optional): your live address, for the "Open on phone" QR code
6. Deploy, sign up in the app, then make yourself an admin in the Supabase SQL editor:
   ```sql
   update public.profiles set is_admin = true where username_normalized = 'your_username';
   ```

Without the Supabase variables the app shows a "not connected yet" page rather than quietly using local storage.

### Automatic database updates

After the checks pass on a push to the default branch, the `database` job in `.github/workflows/ci.yml` runs every migration in order and then the seed. One-off setup:

1. In Supabase, click **Connect** and copy the **Session pooler** connection string (the direct one doesn't work from GitHub). Put your database password in place of `[YOUR-PASSWORD]`.
2. In GitHub, add it as a repository secret named `SUPABASE_DB_URL` (**Settings → Secrets and variables → Actions**).
3. To run it straight away: **Actions → CI → Run workflow**.

Without the secret the job just says so and passes. The connection string can change anything in the database, so keep it only in that secret.

## How it's built

- **React 19 + Vite**, React Router, Leaflet with OpenStreetMap, Lucide icons, Supabase.
- **Design system:** every colour, size, space, radius and timing is a token at the top of `src/styles/global.css`, with light and dark themes. Cream and near-black neutrals, one green accent, separate success/warning/error colours, and muted gold only for the bingo win. Text contrast is at least 4.5:1, tap targets are at least 44px, and motion respects "reduce motion".
- **Money** is shown with `Intl.NumberFormat("en-GB", GBP)`, rounded to pence. **Dates** are UK style in London time ("3 Oct 2026").
- **Errors** are written in one place (`src/lib/api/errors.js`): each says what went wrong and what to do, and raw database errors never reach the screen. Requests time out after 20 seconds with a retry.

### Project layout

```
src/
  pages/              one file per screen
  components/         ui/ (shared pieces), find/, pub/, admin/, events/, features/, suggestions/, map/
  lib/core/           pure logic with unit tests: search, prices, bingo, crawl, dates, validation…
  lib/api/            Supabase and in-memory demo APIs, error messages, photo and menu file handling
  lib/hooks/          shared React hooks (page title, URL state, location, busy state, validation)
  data/               seed pubs (single source), research, events, feature and suggestion lists
  styles/global.css   design tokens and all styles
supabase/migrations/  schema, security rules and database functions, run in order
supabase/seed.sql     generated from src/data (npm run seed:sql)
tests/unit, tests/db  Vitest suites
docs/                 price research, and the manual test checklist (docs/TESTING.md)
```

## Data and safety

- All real data (prices, reports, favourites, bingo progress, photos) lives in Supabase and is shared by everyone. The browser keeps only your sign-in and your dark mode choice.
- Prices can only be written through database functions, which check you're signed in, keep prices between £1 and £25, and rate-limit reports. Row Level Security is on every table, and admin-only actions are checked in the database, not just the app.
- Photo uploads are checked in the database too (your own folder only, not on paused pubs, 10 a day, 5 MB, JPEG/PNG/WebP), and photos are resized with location data removed before upload.
- `src/data/seedPubs.js` holds 60 real pubs and 730 drinks, most with real menu prices (Sep 2026). Coordinates, opening years and histories are best-effort. Estimates are labelled "Estimate" until someone confirms a price. See [docs/price-accuracy.md](docs/price-accuracy.md) for the research.

## Known trade-offs

- Signing in with a username looks up that user's email, so anyone who knows a username can find its email. Switch to email-only sign-in, or an Edge Function, if that matters.
- Search runs in the browser over all pubs. That's fine for dozens of pubs; move it into Postgres for hundreds.
- Phone notifications, the weekly admin email and automatic chain-menu reading are listed in Admin → Features but need an outside service before they can launch.
