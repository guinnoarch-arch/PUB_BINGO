# Pub Bingo

Find the cheapest pint in Soho, Covent Garden & Holborn. Prices come from the community and are shared live with everyone.

Built with the same stack and look as Guinness & Holley Budgeting: **React + Vite** on **Vercel**, with **Supabase** for the shared Postgres database, accounts, photo storage and live updates. Both are free tiers.

## Features

| | |
|---|---|
| **Search** | Type a pint ("Guinness", "IPA", "Camden Hells") to see every pub that stocks it, cheapest first. Category chips filter by Lager, IPA, Stout and so on. |
| **Map** | Leaflet + OpenStreetMap. Pins show the cheapest matching price. Tap the map (or use your location) to search from that point and sort by real walking distance. |
| **Pub pages** | Address, history, tags, opening year, photos and the full drinks list. Each drink shows its price, category, a **Seed estimate** / **Community** badge and how long ago it was updated. |
| **Crowdsourced prices** | Signed-in users report a price for a listed drink or add a new one. Every report is kept (with time and reporter) so trends can be shown; the History button on each drink shows them. |
| **Leaderboard** | Cheapest pint right now across all pubs, with category filter. Halves are ranked by their price per pint. |
| **Bottles & cans** | Drinks can be pints, halves, two-thirds, schooners, bottles or cans (with size). Bottles show their size and price per pint of beer, and never count towards the cheapest-pint leaderboard. |
| **Live feed** | The latest community reports, updated live via Supabase Realtime. |
| **Favourites** | Saved to your account and synced across devices. |
| **Bingo card** | A 3×3 challenge card. 5 tiles complete automatically (first report, 5 reports, a cheap report, favourites in two areas, a photo); 4 are ticked by you. Progress is saved to your account. |
| **Photos** | Every pub has a generated illustration. Signed-in users can upload photos (resized, with location data stripped). **Admins can pause uploads per pub** and hide photos. |
| **Admin** | A spreadsheet of every pub (drinks, % real prices, last update, website, whether prices are online, operator, missing info), sortable and filterable, with **Download CSV**. Click a pub to edit its details, set prices from its website or an in-person check (with the source saved), keep private research notes, and pause photo uploads. Hide bad price reports (the price rolls back) and photos. |
| **What's on** | Search pubs by feature (beer garden, sport on TV, live music, quiz, comedy, dog friendly…) and see events for tonight, tomorrow, the weekend or the next 7 days, filtered by type. Weekly events (e.g. quiz every Wednesday) and one-off events (e.g. a match screening) are supported, always in London time. Each pub page shows "What's on here". Admins add, edit and publish events; events found by web research start as "Needs checking". |
| **PDF menu import** | Admin → pub → "Import prices from a PDF menu": upload the pub's menu, the app reads the prices, matches them to the pub's drinks (or suggests new ones), and you tick which to save. Saved prices get a "Pub website" badge linking to the stored PDF. Scanned or photo menus have no text to read, so enter those by hand (or send them to Claude). |
| **Hidden pubs** | Admins can add a pub with only a name and area. It stays hidden from the public (enforced in the database) until it has an address and map position and is set Live. |

## Where data lives

- **All real data (prices, reports, favourites, bingo progress, photos) is in Supabase**, shared by every visitor.
- The browser only stores your sign-in session and display preferences (dark mode, phone view).

## Setup (one-off, about 10 minutes)

1. **Create a Supabase project** (free) at supabase.com.
2. In **SQL Editor**, run the migrations in order (`supabase/migrations/0001_init.sql`, `0002_pub_admin.sql`, `0003_events.sql`, `0004_menu_uploads.sql`, `0005_bottles.sql`), then `supabase/seed.sql`.
   - **Already set up?** Run any migrations you haven't run yet, in order, then run `seed.sql` again. It only adds missing things (websites, notes, researched events) and never overwrites your prices or edits.
3. In **Authentication → Providers**, make sure Email is enabled. Leave "Confirm email" on (recommended).
4. In **Authentication → URL Configuration**, set the Site URL to your Vercel URL.
5. In **Vercel**, import this repo and add environment variables from **Project Settings → API** in Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the **anon / publishable** key, **never** the service-role key)
   - optional `VITE_PUBLIC_APP_URL` (your live link, for the "Open on phone" QR code)
6. Deploy. Sign up in the app, then make yourself admin in the Supabase SQL editor:
   ```sql
   update public.profiles set is_admin = true where username_normalized = 'your_username';
   ```

Without the Supabase variables, the app shows a "not connected yet" screen instead of silently using local storage.

## Running locally

```bash
npm install
cp .env.example .env.local      # fill in your Supabase URL + anon key
npm run dev
```

To try the UI **without** a database: `VITE_DEMO_MODE=true npm run dev`. Demo mode uses in-memory seed data that resets on reload, and shows a banner saying so. The demo admin login is `admin` / `password123`. Never enable demo mode in production.

## Tests

```bash
npm test          # search, sorting, price parsing/validation, leaderboard, distance, bingo, time
npm run test:db   # runs the real migration + seed on Postgres and checks security rules and the price-report function
```

`test:db` needs a Postgres server (`DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/postgres`). GitHub Actions (`.github/workflows/ci.yml`) runs both on every push, and checks that `supabase/seed.sql` matches the seed data.

## How robustness is handled

- **Prices can only be written through `submit_price_report()`** in the database. It checks you're signed in, keeps the price between £1 and £25 (rounded to pence), validates names, categories and measures, blocks re-reporting the same drink within 10 minutes, and limits each user to 20 reports an hour. Browsers have no direct write access to drinks or reports.
- **Row Level Security** on every table: favourites and bingo progress are private to each user, and only admins can pause uploads or hide content (checked in the database, not just the UI).
- **Photo uploads** are checked in the database too: only into your own folder, only for pubs that aren't paused, a maximum of 10 a day, 5 MB, JPEG/PNG/WebP only.
- The form validates everything before sending, and asks for confirmation when a price is more than 50% away from the current one (probably a typo).
- Loading, empty, error and offline states are shown on every page, and an error boundary stops one broken page taking down the app.

## Seed data

`src/data/seedPubs.js` is the single source: 15 real pubs and 99 drinks (The Rocket's 29 are real prices from its website). `src/data/pubResearch.js` holds websites, operators and admin research notes. Run `npm run seed:sql` after editing it to regenerate `supabase/seed.sql`.
- Names and addresses are real. **Coordinates are approximate, and opening years and histories are best-effort and should be checked.** Where the year wasn't known it's left blank.
- Prices are plausible estimates marked **Seed estimate** until someone reports a real price.
- The French House traditionally serves halves only, so its drinks are listed per half and ranked by their pint equivalent.

## Getting real prices

See **[docs/price-accuracy.md](docs/price-accuracy.md)** for the research on each pub (websites, operators, whether menus are online, price leads) and the plan for replacing estimates with real, sourced prices.

## Known trade-offs / next steps

- **Username sign-in** looks up the email for a username (same approach as the budgeting app), so anyone who knows a username can find its email. Switch to email-only sign-in or an Edge Function if that matters.
- Search happens in the browser over all pubs, which is fine for dozens of pubs. Move it into Postgres if this grows to hundreds.
- Price trends: the full history is stored and summarised (low/high/average/change). A chart is an easy next step.
- More pubs and areas, pub-owner accounts, and report up/down-voting.

## Project layout

```
src/
  data/seedPubs.js            seed data (single source)
  lib/core/                   pure logic: search, prices, geo, bingo, time (unit tested)
  lib/api/                    supabaseApi (real), demoApi (in-memory), error mapping, photo prep
  lib/AppContext.jsx          session, pubs, favourites, live updates
  components/                 shell, map, pub illustration, forms, feed
  pages/                      Find, Pub, Leaderboard, Feed, Favourites, Bingo, Account, Admin
supabase/migrations/          0001 schema, RLS, functions, storage; 0002 hidden pubs, websites, admin tools; 0003 events; 0004 PDF menu uploads; 0005 bottles/cans
docs/price-accuracy.md        price research and plan
supabase/seed.sql             generated seed
tests/unit, tests/db          Vitest suites
```
