// Research gathered 23 Sep 2026 via web search. Websites and operators are from search results;
// they were NOT opened directly (the build environment blocks those sites), so give each a quick check.
// Price "leads" come from third-party pages (pint-prices.com, reviews) with unknown dates. They are
// kept as admin notes only, never shown to the public as prices, until someone verifies them.
// A later research pass is kept separate in `update`, starting with RESEARCH_UPDATE_MARKER, so the
// seed can append it to notes an admin has already edited (only once: it checks for the marker).
export const RESEARCH_UPDATE_MARKER = "[25 Sep 2026 research]";

export const PUB_RESEARCH = {
  "the-french-house": {
    website: "https://www.frenchhousesoho.com/",
    drinks_menu_url: null,
    food_menu_url: "https://www.instagram.com/frenchhousemenu/",
    operator: "Independent",
    prices_online: "no",
    notes: "Beer is served in halves only (except 1 April). No drinks price list found online; wine list is published. Daily food menu on Instagram @frenchhousemenu. Phone 020 7437 2477. Seed drinks and prices are guesses: verify in person.",
    update: "[25 Sep 2026 research] Upstairs dining room (7 tables): lunch 12-3pm, dinner 6-9:30pm, Mon-Sat. Bookings open 60 days ahead (Dish Cult). Menu changes daily and is handwritten (posted on Instagram @frenchhousemenu); regulars include rillettes, goat's curd on toast, madeleines. No regular events: no music, TV or phones by house rule."
  },
  "the-dog-and-duck": {
    website: "https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon",
    drinks_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon/drinks",
    food_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon/foodmenu",
    operator: "Nicholson's (Mitchells & Butlers)",
    prices_online: "unknown",
    notes: "Nicholson's publishes a per-pub drinks menu page: check it for prices. House cask is Nicholson's Pale Ale (St Austell); add it if listed. Phone 020 7494 0697.",
    update: "[25 Sep 2026 research] Food menu: Nicholson's main menu (pies, pulled duck croquettes, garlic mushrooms on sourdough); Sunday roast page: https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon/sundaymenu. CHECK: a search snippet (undated) said the kitchen is closed for maintenance and the pub is drinks-only; confirm before adding the 'food' tag. No regular events found."
  },
  "the-coach-and-horses": {
    website: "https://www.coachandhorsessoho.pub/",
    drinks_menu_url: "https://www.coachandhorsessoho.pub/drink",
    food_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/coach-and-horses-soho/menu",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "[Sep 2026 research] OWNER UNCLEAR: some sources say Greene King, another says Fuller's; check. Piano sing-along Wed & Sat (since 1988). Also listed at greeneking.co.uk/pubs/greater-london/coach-and-horses-soho. LEAD (unverified, date unknown): pint-prices.com lists Amstel at £5.70 (https://www.pint-prices.com/pub/29%20Greek%20St,%20London%20W1D%205DH/The%20Coach%20&%20Horses). Seed drink list is a guess: check the /drink page. Phone 020 7437 5920.",
    update: "[25 Sep 2026 research] Food menu is on the Greene King page (small plates, pub classics, lunch deals). Events: piano sing-along Wed & Sat confirmed again; Greene King 'what's on' page: https://www.greeneking.co.uk/pubs/greater-london/coach-and-horses-soho/whats-on. Hours: Mon-Tue 11-23, Wed-Sat 11-23:30, Sun 11-22:30. OWNER still unclear: Wikipedia says Fuller's, but the pub has live menu and events pages on greeneking.co.uk, so Greene King looks current. Former landlord Norman Balon died in 2026."
  },
  "the-blue-posts-berwick-street": {
    website: "https://www.theblueposts.net/",
    drinks_menu_url: null,
    food_menu_url: null,
    operator: "Unknown (check)",
    prices_online: "unknown",
    notes: "Several London pubs are called The Blue Posts; theblueposts.net is the 22 Berwick Street one (general@theblueposts.net, 020 7437 5008). Hosts comedy (Mon/Wed) and music (Tue/Thu). Seed drinks and prices are guesses.",
    update: "[25 Sep 2026 research] Weekly line-up confirmed: Mon & Wed Soho Comedy Factory 7:30pm (doors 7pm, tickets on Fever: https://feverup.com/en/london/venue/the-blue-posts); Tue open mic, blues and jazz 7pm; Thu The Black Diamonds (blues and jazz) 7pm. Hours: Mon-Sat 11:30-23, Sun 11:30-22:30. Instagram @thebluepostssoho. No food menu found online."
  },
  "the-toucan": {
    website: "https://www.thetoucansoho.co.uk/",
    drinks_menu_url: null,
    food_menu_url: null,
    operator: "Independent",
    prices_online: "unknown",
    notes: "CHECK POSTCODE: search results give 19 Carlisle Street W1D 3BX (seed has W1D 3BY). Open since 1994; reportedly closed Sundays. LEADS (unverified, dates unknown): Guinness £6.50 (pint-prices.com search), £6.80 (Facebook Guinness community post). Phone 020 7437 4123.",
    update: "[25 Sep 2026 research] EVENT: Irish trad session (seisiún) in the basement bar every Tuesday, about 7:30-10pm (Shortlist and listings; one source says from 7pm). Food: lunchtime Irish stew with soda bread, Rossmore oysters (SquareMeal); no menu link found. Hours: Mon-Tue 16-23, Wed-Sat 13-23, Sun closed. No bookings. Shows football, rugby and cricket."
  },
  "the-coal-hole": {
    website: "https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon",
    drinks_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon/drinks",
    food_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon/foodmenu",
    operator: "Nicholson's (Mitchells & Butlers)",
    prices_online: "unknown",
    notes: "Nicholson's per-pub drinks menu page: check for prices. Also has a pint-prices.com page: https://www.pint-prices.com/pub/91-92%20Strand,%20London%20WC2R%200DW/The%20Coal%20Hole. Phone 020 7379 9883.",
    update: "[25 Sep 2026 research] Food menu: Nicholson's main menu, pies a speciality; dining room page: https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon/diningrooms. No regular public events found (private hire only)."
  },
  "the-craft-beer-co-holborn": {
    website: "https://www.thecraftbeerco.com/covent-garden",
    drinks_menu_url: "https://untappd.com/v/the-craft-beer-co/1608850/beers",
    food_menu_url: null,
    operator: "The Craft Beer Co.",
    prices_online: "partial",
    notes: "Events page: http://www.thecraftbeerco.com/events (weekly quiz Wed 8pm, open mic Fri 7:30pm, tap takeovers). Brands this site as 'Covent Garden' though it is on High Holborn. ~15 cask + 30 keg lines that rotate constantly, so fixed drink lists go stale fast; Untappd shows the live beer list (prices sometimes). LEAD (review, date unknown): ~£7.70 a pint, specials much more. coventgarden@thecraftbeerco.com, 020 7836 5485.",
    update: "[25 Sep 2026 research] Quiz Wed 8pm and open mic Fri 7:30pm confirmed again. Food is snacks only (Scotch eggs, pies from independent producers); no menu link. Hours: Mon-Wed 12-00, Thu-Sat 12-01, Sun 12-00."
  },
  "the-cross-keys": {
    website: null,
    drinks_menu_url: null,
    food_menu_url: null,
    operator: "Unknown (check)",
    prices_online: "no",
    notes: "No official website found (only directory listings, e.g. coventgarden.london/brand-directory/the-cross-keys). Built 1848-49, Grade II listed. Prices need an in-person check or community reports. Phone 020 7836 5185.",
    update: "[25 Sep 2026 research] Food: pub classics, burgers, pies, sandwiches; reviews praise the fish and chips. Listings say it 'regularly hosts quiz nights' but no day was found: ask at the bar. Children allowed until 8pm. CHECK POSTCODE: one listing gives WC2H 9BA (seed has WC2H 9EB). WARNING: crosskeyscoventgarden.com now shows an unrelated blog, so do NOT use it as the pub website."
  },
  "the-ship-tavern": {
    website: "https://theshiptavern.co.uk/",
    drinks_menu_url: null,
    food_menu_url: "https://theshiptavern.co.uk/menus/",
    operator: "Independent (Evans family)",
    prices_online: "unknown",
    notes: "Run by the Evans family for ~23 years; real ales and home-cooked food. info@theshiptavern.co.uk, 020 7405 1992. Seed drinks and prices are guesses.",
    update: "[25 Sep 2026 research] Menus: https://theshiptavern.co.uk/menus/ (Tavern menu, Sunday menu at /menus/sunday-menu/, daily specials board). Sunday roast is famous: book 1-2 weeks ahead. EVENT: Gin & Jazz in the Oak Room on Sunday afternoons (start time not found). Hours: Mon-Wed 11-23, Thu-Sat 11-00, Sun 11-23."
  },
  "the-harp": {
    website: "https://www.harpcoventgarden.com/",
    drinks_menu_url: "https://www.harpcoventgarden.com/drink",
    food_menu_url: null,
    operator: "Fuller's",
    prices_online: "unknown",
    notes: "Owned by Fuller's since 2014; 10 hand pumps with rotating guest ales, plus ciders and perries. LEAD (reviews, dates unknown): cask pints around £5.80-£6.05. Harp.CoventGarden@fullers.co.uk, 020 7836 0291.",
    update: "[25 Sep 2026 research] No kitchen: sausages cooked on a hotplate behind the bar, served in a baguette. What's on page: https://www.harpcoventgarden.com/whats-on (loads dynamically; one listed event is Fuller's 'Prize Old Ale Tour'). Live beer list on Untappd: https://untappd.com/v/the-harp/43889. CAMRA National Pub of the Year 2010."
  },
  "lamb-and-flag": {
    website: "https://www.lambandflagcoventgarden.co.uk/",
    drinks_menu_url: null,
    food_menu_url: null,
    operator: "Fuller's",
    prices_online: "unknown",
    notes: "Fuller's since 2011/2013. Check the site's drinks/menu page for prices. lambandflag@fullers.co.uk.",
    update: "[25 Sep 2026 research] EVENT: live jazz on the last Sunday of every month (7-9pm per Visit London; another source says 7:30-10:30pm), seeded as one-off dates for Sep-Nov 2026. Upstairs comedy night mentioned, day not found. What's on page: https://www.lambandflagcoventgarden.co.uk/whats-on. Food: pub classics (fish and chips, steak and ale pie, Scotch egg) and Sunday roast; no direct menu link found, so check the website's food page and add it."
  },
  "the-porterhouse": {
    website: "https://porterhouse.london/",
    drinks_menu_url: "https://porterhouse.london/wp-content/uploads/2026/04/QR-Code-Drinks-Menu-Spring-2026-Version-2.pdf",
    food_menu_url: null,
    operator: "Porterhouse Brewing Co.",
    prices_online: "yes",
    notes: "[Sep 2026 research] Publishes PDF drinks menus WITH PRICES. Current menu: 'QR Code Drinks Menu Spring 2026 Version 2' (https://porterhouse.london/wp-content/uploads/2026/04/QR-Code-Drinks-Menu-Spring-2026-Version-2.pdf), found by Archie; its prices still need entering. Older menus for comparison: Oct 2024 Temple Lager £6.60, Yippy IPA £6.80, Oyster Stout £6.80, Budvar £6.90 a pint; halves £3.10-£3.65. Our seed drinks (Plain Porter, Hop Head, Stonewell Cider) may not be on the current menu. Events page: https://porterhouse.london/events/ (live music Thu-Sat, Irish session Sun afternoons). 18 screens for sport, especially rugby; listed on Fanzo: https://www.fanzo.com/en/bar/248658/the-porterhouse. 30+ taps. Phone 020 7379 7917.",
    update: "[25 Sep 2026 research] Food: burgers, pizza, pies, steak, sandwiches, weekly pie special; Sunday roasts. No food menu link found. Live music Thu-Sat (house bands, 60s to now covers) confirmed. Irish trad session on Sunday afternoons is listed on thesession.org (https://thesession.org/sessions/32) with old times of 3:30-7pm or 5:30-8:30pm, but the pub's own events page doesn't mention it: check before publishing."
  },
  "the-punch-and-judy": {
    website: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy",
    drinks_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy/menu",
    food_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy/menu",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "Greene King per-pub menu page: check for drink prices. LEADS (pint-prices.com, unverified, dates unknown): Neck Oil £8.05, Peroni £7.85, Guinness £6.80. Seed has Neck Oil missing and Guinness at £7.30, so it needs checking.",
    update: "[25 Sep 2026 research] Food menu on Greene King page (pies, fish and chips, burgers, Sunday roast; vegan and gluten-free options). What's on: https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy/whats-on (seasonal: St Patrick's Day, Mother's Day, Easter; football on TV). No regular weekly event found."
  },
  "the-salisbury": {
    website: "https://www.greeneking.co.uk/pubs/greater-london/salisbury",
    drinks_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu",
    food_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "Greene King per-pub menu page: check for prices. A search summary claimed Guinness £6.45, but this looks mixed up with another pub, so don't trust it. Phone 020 7836 5863.",
    update: "[25 Sep 2026 research] Food menu on Greene King page (fish, sausages, pie and mash, Sunday roast; vegan and gluten-free options). Hours: Mon-Wed 11-23, Thu 11-23:30, Fri 11-00, Sat 12-00, Sun 12-22:30. Only seasonal events found (Christmas quiz, karaoke)."
  },
  "the-rocket": {
    website: "https://www.therocketeustonroad.co.uk/",
    drinks_menu_url: "https://www.therocketeustonroad.co.uk/drinks",
    food_menu_url: "https://www.therocketeustonroad.co.uk/main-menu",
    operator: "Mitchells & Butlers",
    prices_online: "yes",
    notes: "[Sep 2026 research] Added at Archie's request. Drinks page lists Peroni, BrewDog Punk IPA, Guinness, Magners, Bulmers, Rekorderlig, plus 3 regular cask ales (names not found), but NO PRICES in search results. UPDATE 24 Sep 2026: Archie sent screenshots of the Beer & Cider tab: 15 BOTTLED beers/ciders now have real prices (source: website). UPDATE 2 (24 Sep, 07:24 screenshots of the order-at-table menu): 14 DRAUGHT pints added (e.g. Guinness £6.65, Landlord £6.45, Coors £6.25, Neck Oil £7.90). Bottle sizes taken from it (Newcastle 550ml, Magners 568ml, Thatchers Haze 500ml, Rekorderlig 500ml). PRICE MISMATCH: the order menu lists bottles 15-20p cheaper than the drinks page (Peroni/Corona/Budweiser/Daura £5.85, Modelo £5.90, Desperados £6.10, Schöfferhofer £6.10, Newcastle £5.75, Magners £6.10, Thatchers Haze £6.60, Rekorderlig £6.50). Drinks-page prices kept; check at the bar which is current. Not added: Breezer/WKD/Smirnoff Ice (alcopops), wine. Alpacalypse category unknown (set to Other). Deals: meal + drink from £9.50 Mon-Fri 12-6pm (+£1 for alcohol). Monday quiz night (CAMRA). Sky Sports, food, child and dog friendly, regular live entertainment; inapub mentions a garden: check. CHECK MAP PIN: coordinates are approximate (south side of Euston Road). Formerly The Rising Sun / Friar and Firkin; owners per Wikipedia: Mitchells & Butlers.",
    update: "[25 Sep 2026 research] Food menu: https://www.therocketeustonroad.co.uk/main-menu (burgers incl. Guinness burger, loaded fries, wings, sharing plates; breakfast daily until 12). What's on: https://www.therocketeustonroad.co.uk/whatson (weekly live music and late DJs, days not found). 8 HD TVs. Monday quiz confirmed again."
  },
  "the-rosendale": {
    website: "https://www.therosendale.co.uk/",
    drinks_menu_url: "https://www.therosendale.co.uk/menus/",
    food_menu_url: "https://www.therosendale.co.uk/menus/",
    operator: "Three Cheers Pub Co.",
    prices_online: "yes",
    notes: "[25 Sep 2026] Added on request, with the Spring 2026 drinks menu PDF (page 1, sent in by the user). 13 draught/cask prices entered as pints (the menu doesn't say pint or half: check at the bar). Menu spells it 'Gypsy Hill Hepcat Session IPA'; the brewery is Gipsy Hill, so entered as 'Gipsy Hill Hepcat'. Lucky Saint is 0.5% alcohol-free. Also on the menu but not added (not beer): summer spritzers £10.50 (Aperol, Limoncello, Hugo, Campari), classic cocktails £11.50 (Sriracha Bloody Mary £10), 'Garden Greats' cocktails £11.50, mocktails £6. Page 1 only: there may be more pages (bottles, wine). Pub: 65 Rosendale Road SE21 8EZ, 020 8761 9008, Instagram @therosendalepub. Grade II listed, mid-19th-century front, former Victorian coaching inn; opening year unknown. Three gardens (play area, table tennis, boules), two private rooms (East and West Rooms), dog friendly. Hours (listing): Mon-Thu 11-23, Fri-Sat 11-01, Sun 11-22:30. Events: Monday pub quiz (teams up to 6, £2.50 each per a 2023 listing: check it still runs and the start time); pilates and seasonal events mentioned. What's on: https://www.therosendale.co.uk/whats-on/ . Menus: https://www.therosendale.co.uk/menus/ ; offers: https://www.therosendale.co.uk/offers/ ; CAMRA: https://camra.org.uk/pubs/rosendale-dulwich-158685 . CHECK MAP PIN: coordinates are the postcode centre, not the building."
  }
};
