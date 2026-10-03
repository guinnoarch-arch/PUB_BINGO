# Manual test checklist

Click through this before a release, or after a big change. Tick each box as it passes. If something fails, write down the page, what you did and what you saw.

**Before you start**

- Use the live site (real Supabase), not demo mode. Demo mode forgets everything when you reload, so the "refresh" checks below won't work there.
- Have two accounts: a normal one, and an admin (see the README for how to make yourself admin).
- Test on a phone (about 375px wide) **and** a laptop. Do one pass in light mode and one in dark mode (the moon/sun button in the header).
- Several features have switches in **Admin → Features**. Section 10 tests them; switch each one on before its checks, then back off afterwards if you're not launching it.

---

## 1. Every page

- [ ] The browser tab title names the page, e.g. "Leaderboard · Pub Bingo", or the pub's name on a pub page.
- [ ] Nothing scrolls sideways on a phone, and no text is cut off or overlapping.
- [ ] The phone menu shows Find · Events · Top · Feed · Bingo · Saved (· Admin for admins) on one line, and the current page is underlined.
- [ ] Moon/sun button: switches between light and dark mode, and the choice is kept after a reload.
- [ ] Lightbulb button: opens Suggestions.
- [ ] Person button: opens Account (sign in, or your account).
- [ ] QR button: opens "Open on phone". Escape, Close or tapping outside closes it.
- [ ] Turn off Wi-Fi: an "You're offline" banner appears. Turn it back on: the banner goes.
- [ ] Go to a made-up address (e.g. `/nope`): "Page not found" with a "Go to the home page" button.
- [ ] Keyboard only (laptop): Tab moves through the page in a sensible order with a clear green outline. The first Tab shows "Skip to content", and Enter on it jumps past the menu.
- [ ] Browser back and forward work between pages, and filters you'd set are still there.

## 2. Find (home)

- [ ] Type "Guinness": the results update as you type and the address bar shows `?q=guinness`. Refresh: the search is still there.
- [ ] Clear: empties the search.
- [ ] Category chips (Lager, IPA…): filter the results. Tap the same chip again (or All) to clear.
- [ ] A search with no confirmed prices (try "mild") shows "These pubs stock it…" with Report price links, or a "No pubs found" message with suggestions.
- [ ] Results: each row shows drink, pub, area, source label, how long ago, and the price on the right. Prices line up and none has more than two decimals.
- [ ] Heart: adds or removes a favourite. Signed out, it asks you to sign in.
- [ ] Map: priced pubs show their price, unpriced pubs show as small dots. Tap a pin: a popup with "View pub".
- [ ] Tap the map: "Searching from your chosen point", and Nearest becomes available. Clear point turns it off.
- [ ] Use my location: shows "Finding you…". Allow it: results sort by distance. Block it: a clear message says what to do.
- [ ] Before a point is chosen, Nearest is greyed out, with a note above the map saying why.
- [ ] "Cheapest pint right now" and "Latest reports" show at the bottom, with links to the full lists.

## 3. Pub page

- [ ] Open a pub from Find. Name, area, year, address (opens a map in a new tab), website and menu links (each with ↗), tags and description are shown.
- [ ] Add to favourites works.
- [ ] Report a price scrolls to the form.
- [ ] Send us the menu opens Suggestions with this pub already chosen.
- [ ] Drinks list: grouped by category, draught first, cheapest first. Each drink has a source label and an "Updated…" date. Old prices say "may be out of date".
- [ ] History (on a drink): opens the price history with low/high/average and every report.
- [ ] **Report a price (signed out):** shows "Sign in or create account", and after signing in you come back to this pub.
- [ ] **Report a price (signed in):**
  - [ ] Submit with nothing filled in: inline errors with icons, and a summary at the top when there's more than one.
  - [ ] Type "abc" as the price, then tap elsewhere: "Enter the price as a number…".
  - [ ] Enter a price far from the current one (e.g. 65): it asks "Is that what you paid?". Cancel keeps your input.
  - [ ] A normal price saves: "Guinness at The Harp is now £6.20." The drink's price updates.
  - [ ] Choose "A drink that isn't listed": name, category and measure appear and are required.
  - [ ] Report the same drink again straight away: a clear message that you can report it again after 10 minutes.
- [ ] **Photos:** upload a JPEG: "Photo added to …". A non-image file gives an inline error. Delete your own photo: it asks first.
- [ ] Made-up pub address (`/pubs/nope`): "Pub not found" with a "Search all pubs" button.

## 4. What's on

- [ ] Feature chips (Beer garden, Sport on TV…): matching pubs are listed with their features in text. Several chips mean pubs with all of them. Clear features works.
- [ ] Tonight / Tomorrow / Weekend / 7 days all show on a phone, and each changes the list.
- [ ] Event type chips filter the list.
- [ ] The filters are in the address bar and survive a refresh.
- [ ] A choice with nothing on shows a helpful empty message.

## 5. Leaderboard, Feed, Favourites

- [ ] Leaderboard: cheapest confirmed pints with ranks and right-aligned prices. Category chips and "One drink per pub" change the list. The category survives a refresh.
- [ ] Feed: the latest reports, with "Live" shown. Report a price in another tab and it appears without reloading.
- [ ] Favourites (signed out): asks you to sign in. Signed in with none saved: "No favourites yet" with a Find a pub button. With some: a card for each, with its cheapest pint.

## 6. Bingo

- [ ] Signed out: asks you to sign in.
- [ ] Classic card (or This week, if weekly bingo is on): 9 different tiles, with no repeats.
- [ ] Dashed "Ticks itself" tiles can't be tapped.
- [ ] Tap a "Tap when done" tile: it turns dark with a ✓ and says Done.
- [ ] Tap it again: it unticks, and a toast offers **Undo** for about 8 seconds. Undo re-ticks it.
- [ ] Complete a row, a column and a diagonal (one at a time): each shows **Bingo**, a gold border, and "In a line" on those tiles. An L shape or the four corners does *not* give Bingo.
- [ ] All 9 done: "Full house".
- [ ] Refresh: your ticks are still there.
- [ ] Report your first price, then come back: "Report your first price" has ticked itself. A "Still right?" tap does not tick it.
- [ ] The tile text is readable in a dim room and nothing is cut off on a phone.

## 7. Account

- [ ] Sign in with a wrong password: a clear message, and your username stays filled in.
- [ ] Create account with everything empty: 4 inline errors plus a summary. Tapping a summary item jumps to that field.
- [ ] Type a bad email and tap elsewhere: an error appears. Fix it: the error goes as you type.
- [ ] Create a real account: a confirmation email notice (or you're signed in, if confirmation is off).
- [ ] Forgot password: sends a reset link and says to check your inbox.
- [ ] Signed in: shows your username, and Sign out works ("Signing out…", then "Signed out.").

## 8. Suggestions

- [ ] Signed out: the list is readable, but sending and voting ask you to sign in.
- [ ] Send an empty suggestion: an inline error, and focus goes to the box. Send a real one: "Suggestion sent." and it appears in the list.
- [ ] Vote up and down: the score changes once per tap, even if you double-tap.
- [ ] The filters (Open, Planned, Done, Mine) work, with a helpful message when one is empty.
- [ ] **Menu or price:**
  - [ ] Send it with nothing filled in: errors for pub, date and file.
  - [ ] Send a PDF or photo: "Menu sent to the admins." It shows under "Menus you've sent" as Waiting for admin.

## 9. Admin (admin account)

- [ ] As a normal user, `/admin` shows "Admins only".
- [ ] **Pubs tab:** the summary numbers show. Search and the filter dropdown narrow the table. Column headers sort it (an arrow shows the direction). Download CSV opens in Excel. Clicking a row opens the pub.
- [ ] **Add pub:**
  - [ ] Save with no name: an inline error.
  - [ ] Paste "51.5134, -0.1318" into Latitude: it fills both latitude and longitude.
  - [ ] A website without https:// gives an error.
  - [ ] You can't make it Live until it has an address and map position.
- [ ] **Edit a pub:**
  - [ ] Save details.
  - [ ] Set price: "abc" gives an error; a website source needs a link; a future date gives an error.
  - [ ] Edit a drink.
  - [ ] Delete a drink: it asks first.
  - [ ] History, Hide and Unhide a report: the price rolls back.
  - [ ] Research notes save.
  - [ ] Pause photo uploads: the pub page says uploads are paused.
- [ ] **PDF menu import:** upload a menu PDF. The table of found prices appears, with the changes from the current price. Untick some and save: "N prices imported". Change a price to "abc" and save: that row is listed with how to fix it.
- [ ] **Events:** add one with no title or no days: inline errors. Add a real one, publish or unpublish it, edit it, and delete it (it asks first).
- [ ] **Happy hours and opening hours:** add a deal (a matching start and end time is refused) and save opening hours. The hours table fits on a phone.
- [ ] **Menus tab:** a "new" count shows on the tab. Update prices opens the pub with the menu beside it. Set it to "Used to update prices" with a reply: the sender sees it.
- [ ] **Reports tab:** recent reports with Hide.
- [ ] **Week tab:** the digest numbers and "Waiting for you" links.
- [ ] **Features tab:** each switch turns its feature on for everyone, and off again.

## 10. Switchable features

Switch each on in Admin → Features, check it, then decide whether to leave it on.

- [ ] **"Still right?":** tap it on a drink: "Confirmed: … is still £…". Tapping again the same day gives a clear message.
- [ ] **Needs checking:** the Feed shows a teaser. The page lists stale prices by pub, the area chips and "Include estimates" work, and "Nothing to check" appears when everything is fresh.
- [ ] **Price trends:** a chart appears in drink history, and "Average pint by area" on the Leaderboard.
- [ ] **Happy hours:** during a deal, search, the map, the leaderboard and the pub page show the deal price and when it ends.
- [ ] **Open now & filters:** the Open now, Sport on tonight and Outside seating chips work, and pub pages show their opening hours.
- [ ] **Crawl planner:**
  - [ ] Cheapest crawl and Pick my pubs both work.
  - [ ] Use my location shows "Finding you…".
  - [ ] The route shows walk times and a total cost.
  - [ ] Share crawl copies or shares a link, and opening that link shows the same crawl.
- [ ] **Round calculator:** add drinks and quantities. Pubs are listed cheapest first with the cost each. "Sort by distance too" asks for your location.
- [ ] **Trusted reporters:** a big price change from a new user waits in Admin → Reports for approval. Approve or Reject it, and trusted users show a tick.
- [ ] **Receipts:** attach a receipt photo when reporting. A "Receipt" label shows, and admins can open it.
- [ ] **Weekly bingo:** This week / Classic card toggle, the week's dates, and a streak. A new card appears on Monday.
- [ ] **Badges:** your account shows badges, with progress bars for ones you haven't earned.
- [ ] **Top reporters:** the Leaderboard → Top reporters tab, with this month and all time.
- [ ] **Check-ins:** Check in works when you're at the pub and refuses when you're far away. The passport on your account ticks visited pubs.
- [ ] **Guinness score:** rate 1–5 on a pub that serves Guinness: "Rated N out of 5." The average shows in search results.
- [ ] **Price watches:** add "Guinness under 6.00". Matches show on Favourites and as a count on the Saved tab. Remove offers Undo.

## 11. Accessibility spot checks

- [ ] Phone screen reader (VoiceOver or TalkBack): each page starts with one main heading, and buttons have sensible names (e.g. "Add The Harp to favourites").
- [ ] Turn on "Reduce motion": Report a price jumps to the form instead of scrolling smoothly.
- [ ] Zoom the browser to 200%: everything still fits and works.
- [ ] Every tap target is comfortable for a thumb on a phone.
