// Every new feature has an on/off switch (Admin → Features). Off = hidden from the public; admins
// still see it, marked "Not launched", so it can be tried out first. The database keeps the switches.
// status "needs_setup": built as far as possible, but needs an outside service before it can launch.
export const FEATURES = [
  { key: "still_right", label: "“Still right?” button", where: "Pub pages", description: "One tap to confirm a price is still correct. Refreshes its date without re-typing it." },
  { key: "needs_checking", label: "Needs checking list", where: "Feed → Needs checking", description: "Prices that are estimates or over 60 days old, stalest first, so regulars know what to check next." },
  { key: "price_trends", label: "Price trend charts", where: "Drink history, Leaderboard", description: "A chart of each drink's price over time, and the average pint by area." },
  { key: "happy_hours", label: "Happy hours", where: "Search, map, leaderboard, pub pages", description: "Time-based deals (e.g. £5 pints 4–7pm). During a deal, search shows the deal price and when it ends. Admins add deals on each pub's admin page." },
  { key: "pub_filters", label: "Open now & more filters", where: "Find", description: "Filters for open now, sport on tonight and outside seating, plus opening hours on pub pages. Opening hours are added per pub in admin." },
  { key: "crawl_planner", label: "Pub crawl planner", where: "Find → Plan a crawl", description: "Pick pubs, or get the cheapest crawl from where you are, with the shortest walking order, total cost and a link to share." },
  { key: "round_calculator", label: "Round calculator", where: "Find → Price a round", description: "Pick the drinks for your group and see what the round costs at each pub, cheapest first." },
  { key: "trusted_reporters", label: "Trusted reporters & review", where: "Reports, admin", description: "People whose reports keep matching others get a ✓. Prices more than 40% off from someone not yet trusted wait for admin review." },
  { key: "receipts", label: "Receipt photos", where: "Report a price", description: "Attach a receipt photo to a price report (only admins see it); the price gets a 🧾 badge." },
  { key: "weekly_bingo", label: "Weekly bingo cards", where: "Bingo", description: "A new card every Monday with a streak counter. The classic card stays too." },
  { key: "badges", label: "Badges", where: "Your account", description: "Badges for reporting, checking prices, sending menus, visiting areas and more." },
  { key: "top_reporters", label: "Top reporters board", where: "Leaderboard", description: "This month's most helpful reporters." },
  { key: "check_ins", label: "Check-ins & pub passport", where: "Pub pages, your account", description: "Check in when you're at a pub (location checked). Builds your passport, and pubs show how many people checked in recently." },
  { key: "guinness_score", label: "Guinness score", where: "Pub pages, search", description: "Rate the Guinness pour 1–5; each pub shows its average." },
  { key: "price_watch", label: "Price watches", where: "Saved", description: "“Tell me when Guinness is under £6”: matches show on the Saved page and as a count on the menu." },
  { key: "push_alerts", label: "Phone notifications", where: "Price watches", description: "Send price-watch matches as phone notifications.", status: "needs_setup", setup: "Needs web-push keys and a small server job (Supabase Edge Function) to send them." },
  { key: "email_digest", label: "Weekly admin email", where: "Admin", description: "Email you a weekly summary (the Admin → This week page).", status: "needs_setup", setup: "Needs an email service (e.g. Resend) and a scheduled job." },
  { key: "chain_menus", label: "Automatic chain menus", where: "Admin", description: "Read Nicholson's, Greene King and Fuller's menu pages weekly and suggest price changes to approve.", status: "needs_setup", setup: "Needs a scheduled job with internet access, and a check of each site's terms." }
];

export const FEATURE_KEYS = FEATURES.map(f => f.key);
