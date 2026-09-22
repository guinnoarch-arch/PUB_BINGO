# Pub Bingo

A bingo card for nights out. Tap a square when it happens; get a full row, column or diagonal and it's **BINGO!**

Built with the same stack and look as Guinness & Holley Budgeting: React 19 + Vite, installable as a phone app (PWA), and deployable for free on Vercel or Netlify.

## What's in this first version

- **Play** – a 3×3, 4×4 or 5×5 card built at random from your squares, with an optional free centre square. Detects lines and a full house, and highlights winning lines.
- **Squares** – a starter list of 30 pub squares. Add, edit, remove, or switch squares off.
- **History** – your last 50 cards are saved when you start a new one.
- **Settings** – your name, card size, free square, theme (light / dark / match device), install-on-phone help, backup download/restore, and reset.
- **Header** – dark mode toggle, phone-view toggle, and a QR code to open the app on your phone (like the budgeting app).

## Where data is saved

Everything is stored in the **browser on this device only** (`localStorage` key `pub-bingo-data-v1`). There is no account, server or cloud yet. Use Settings → Download backup to move data between devices.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Deploying

- **Vercel**: import the repo. It detects Vite automatically, and `vercel.json` handles page routing.
- **Netlify**: `netlify.toml` is already set up (build `npm run build`, publish `dist`).
- Optional: set `VITE_PUBLIC_APP_URL` to your live link so the "Open on phone" QR code always points there.

## Project layout

```
src/
  main.jsx                     app state, saving, theme, PWA install/update
  components/layout/           AppShell (header) and TopNav
  components/bingo/BingoCard   the grid
  components/common/           InlineQrCode (from the budgeting app)
  pages/                       Play, Squares, History, Settings
  services/storageService.js   localStorage load/save/backup
  utils/bingo.js               card creation, line/full-house detection
  data/defaultSquares.js       starter squares
public/                        manifest, service worker, icons
```
