// Research gathered 23 Sep 2026 via web search. Websites and operators are from search results;
// they were NOT opened directly (the build environment blocks those sites), so give each a quick check.
// Price "leads" come from third-party pages (pint-prices.com, reviews) with unknown dates. They are
// kept as admin notes only, never shown to the public as prices, until someone verifies them.
export const PUB_RESEARCH = {
  "the-french-house": {
    website: "https://www.frenchhousesoho.com/",
    drinks_menu_url: null,
    operator: "Independent",
    prices_online: "no",
    notes: "Beer is served in halves only (except 1 April). No drinks price list found online; wine list is published. Daily food menu on Instagram @frenchhousemenu. Phone 020 7437 2477. Seed drinks and prices are guesses: verify in person."
  },
  "the-dog-and-duck": {
    website: "https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon",
    drinks_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thedogandducksoholondon/drinks",
    operator: "Nicholson's (Mitchells & Butlers)",
    prices_online: "unknown",
    notes: "Nicholson's publishes a per-pub drinks menu page: check it for prices. House cask is Nicholson's Pale Ale (St Austell); add it if listed. Phone 020 7494 0697."
  },
  "the-coach-and-horses": {
    website: "https://www.coachandhorsessoho.pub/",
    drinks_menu_url: "https://www.coachandhorsessoho.pub/drink",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "Also listed at greeneking.co.uk/pubs/greater-london/coach-and-horses-soho. LEAD (unverified, date unknown): pint-prices.com lists Amstel at £5.70 (https://www.pint-prices.com/pub/29%20Greek%20St,%20London%20W1D%205DH/The%20Coach%20&%20Horses). Seed drink list is a guess: check the /drink page. Phone 020 7437 5920."
  },
  "the-blue-posts-berwick-street": {
    website: "https://www.theblueposts.net/",
    drinks_menu_url: null,
    operator: "Unknown (check)",
    prices_online: "unknown",
    notes: "Several London pubs are called The Blue Posts; theblueposts.net is the 22 Berwick Street one (general@theblueposts.net, 020 7437 5008). Hosts comedy (Mon/Wed) and music (Tue/Thu). Seed drinks and prices are guesses."
  },
  "the-toucan": {
    website: "https://www.thetoucansoho.co.uk/",
    drinks_menu_url: null,
    operator: "Independent",
    prices_online: "unknown",
    notes: "CHECK POSTCODE: search results give 19 Carlisle Street W1D 3BX (seed has W1D 3BY). Open since 1994; reportedly closed Sundays. LEADS (unverified, dates unknown): Guinness £6.50 (pint-prices.com search), £6.80 (Facebook Guinness community post). Phone 020 7437 4123."
  },
  "the-coal-hole": {
    website: "https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon",
    drinks_menu_url: "https://www.nicholsonspubs.co.uk/restaurants/london/thecoalholestrandlondon/drinks",
    operator: "Nicholson's (Mitchells & Butlers)",
    prices_online: "unknown",
    notes: "Nicholson's per-pub drinks menu page: check for prices. Also has a pint-prices.com page: https://www.pint-prices.com/pub/91-92%20Strand,%20London%20WC2R%200DW/The%20Coal%20Hole. Phone 020 7379 9883."
  },
  "the-craft-beer-co-holborn": {
    website: "https://www.thecraftbeerco.com/covent-garden",
    drinks_menu_url: "https://untappd.com/v/the-craft-beer-co/1608850/beers",
    operator: "The Craft Beer Co.",
    prices_online: "partial",
    notes: "Brands this site as 'Covent Garden' though it is on High Holborn. ~15 cask + 30 keg lines that rotate constantly, so fixed drink lists go stale fast; Untappd shows the live beer list (prices sometimes). LEAD (review, date unknown): ~£7.70 a pint, specials much more. coventgarden@thecraftbeerco.com, 020 7836 5485."
  },
  "the-cross-keys": {
    website: null,
    drinks_menu_url: null,
    operator: "Unknown (check)",
    prices_online: "no",
    notes: "No official website found (only directory listings, e.g. coventgarden.london/brand-directory/the-cross-keys). Built 1848-49, Grade II listed. Prices need an in-person check or community reports. Phone 020 7836 5185."
  },
  "the-ship-tavern": {
    website: "https://theshiptavern.co.uk/",
    drinks_menu_url: null,
    operator: "Independent (Evans family)",
    prices_online: "unknown",
    notes: "Run by the Evans family for ~23 years; real ales and home-cooked food. info@theshiptavern.co.uk, 020 7405 1992. Seed drinks and prices are guesses."
  },
  "the-harp": {
    website: "https://www.harpcoventgarden.com/",
    drinks_menu_url: "https://www.harpcoventgarden.com/drink",
    operator: "Fuller's",
    prices_online: "unknown",
    notes: "Owned by Fuller's since 2014; 10 hand pumps with rotating guest ales, plus ciders and perries. LEAD (reviews, dates unknown): cask pints around £5.80-£6.05. Harp.CoventGarden@fullers.co.uk, 020 7836 0291."
  },
  "lamb-and-flag": {
    website: "https://www.lambandflagcoventgarden.co.uk/",
    drinks_menu_url: null,
    operator: "Fuller's",
    prices_online: "unknown",
    notes: "Fuller's since 2011/2013. Check the site's drinks/menu page for prices. lambandflag@fullers.co.uk."
  },
  "the-porterhouse": {
    website: "https://porterhouse.london/",
    drinks_menu_url: null,
    operator: "Porterhouse Brewing Co.",
    prices_online: "unknown",
    notes: "30+ taps including Porterhouse's own beers. Also porterhousebrewco.com. Phone 020 7379 7917."
  },
  "the-punch-and-judy": {
    website: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy",
    drinks_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy/menu",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "Greene King per-pub menu page: check for drink prices. LEADS (pint-prices.com, unverified, dates unknown): Neck Oil £8.05, Peroni £7.85, Guinness £6.80. Seed has Neck Oil missing and Guinness at £7.30, so it needs checking."
  },
  "the-salisbury": {
    website: "https://www.greeneking.co.uk/pubs/greater-london/salisbury",
    drinks_menu_url: "https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu",
    operator: "Greene King",
    prices_online: "unknown",
    notes: "Greene King per-pub menu page: check for prices. A search summary claimed Guinness £6.45, but this looks mixed up with another pub, so don't trust it. Phone 020 7836 5863."
  }
};
