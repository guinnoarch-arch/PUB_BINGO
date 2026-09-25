// Seed dataset: 16 real pubs across Soho, Covent Garden, Holborn, King's Cross and West Dulwich.
// Names and addresses are real. Coordinates are approximate (street level).
// Prices are plausible central-London estimates, to be refined by community reports.
// Opening years and histories are best-effort and should be checked; null = not known yet.
// This file is the single source of truth: `npm run seed:sql` generates supabase/seed.sql from it.

const ROCKET_MENU = "https://www.therocketeustonroad.co.uk/drinks";
// Time of the screenshots (London, BST).
const ROCKET_MENU_DATE = "2026-09-24T07:10:00+01:00";
const ROCKET_ORDER_DATE = "2026-09-24T07:24:00+01:00";

// The Rosendale's "Spring 2026" drinks menu PDF (page 1), sent in 25 Sep 2026. Links to the pub's menus page.
const ROSENDALE_MENU = "https://www.therosendale.co.uk/menus/";
const ROSENDALE_MENU_DATE = "2026-09-25T16:45:00+01:00";

export const AREAS = ["Soho", "Covent Garden", "Holborn", "King's Cross", "West Dulwich"];

export const CATEGORIES = ["Lager", "IPA", "Pale Ale", "Real Ale", "Stout", "Cider", "Wheat Beer", "Other"];

export const TAGS = [
  "historic",
  "real-ale-specialist",
  "craft-beer",
  "beer-garden",
  "outdoor-drinking",
  "live-music",
  "sports-tv",
  "irish-pub",
  "food",
  "no-music-no-tv",
  "cellar-bar",
  "victorian-interior",
  "quiz-night",
  "comedy",
  "sing-along",
  "dog-friendly"
];

export const SEED_PUBS = [
  {
    id: "the-french-house",
    name: "The French House",
    address: "49 Dean Street, Soho, London W1D 5BG",
    area: "Soho",
    lat: 51.51323,
    lng: -0.13178,
    opened_year: 1891,
    tags: ["historic", "no-music-no-tv", "food"],
    description:
      "A tiny Soho institution with a Free French wartime connection. It traditionally pours beer in halves only, and has no music, TVs or phones.",
    drinks: [
      { name: "Guinness", category: "Stout", price: 3.9, measure: "half" },
      { name: "Meteor Lager", category: "Lager", price: 3.8, measure: "half" },
      { name: "Kronenbourg 1664", category: "Lager", price: 3.7, measure: "half" },
      { name: "Aspall Suffolk Cyder", category: "Cider", price: 3.6, measure: "half" }
    ]
  },
  {
    id: "the-dog-and-duck",
    name: "The Dog and Duck",
    address: "18 Bateman Street, Soho, London W1D 3AJ",
    area: "Soho",
    lat: 51.51398,
    lng: -0.13149,
    opened_year: 1734,
    tags: ["historic", "real-ale-specialist", "victorian-interior"],
    description:
      "A small corner pub with a pub on the site since the 1700s. It's known for its ornate late-Victorian tiles and mirrors, and a good rotating cask range.",
    drinks: [
      { name: "Timothy Taylor Landlord", category: "Real Ale", price: 6.4 },
      { name: "Camden Hells", category: "Lager", price: 7.1 },
      { name: "Guinness", category: "Stout", price: 6.9 },
      { name: "Beavertown Neck Oil", category: "Pale Ale", price: 7.2 },
      { name: "Thatchers Gold", category: "Cider", price: 6.8 }
    ]
  },
  {
    id: "the-coach-and-horses",
    name: "The Coach and Horses",
    address: "29 Greek Street, Soho, London W1D 5DH",
    area: "Soho",
    lat: 51.51286,
    lng: -0.13108,
    opened_year: 1847,
    tags: ["historic", "real-ale-specialist", "sing-along", "food"],
    description:
      "A classic Soho boozer long linked with writers, artists and Private Eye lunches, once famous for its notoriously blunt landlord.",
    drinks: [
      { name: "Fuller's London Pride", category: "Real Ale", price: 6.2 },
      { name: "Guinness", category: "Stout", price: 6.7 },
      { name: "Peroni", category: "Lager", price: 7.0 },
      { name: "Sambrook's Wandle", category: "Real Ale", price: 6.3 },
      { name: "Aspall Suffolk Cyder", category: "Cider", price: 6.6 }
    ]
  },
  {
    id: "the-blue-posts-berwick-street",
    name: "The Blue Posts",
    address: "22 Berwick Street, Soho, London W1F 0QA",
    area: "Soho",
    lat: 51.51331,
    lng: -0.13521,
    opened_year: null,
    tags: ["historic", "food", "live-music", "comedy"],
    description:
      "A traditional Soho corner pub by the Berwick Street market. One of several Blue Posts pubs in the area, supposedly named after the posts that marked the old royal hunting grounds.",
    drinks: [
      { name: "Camden Hells", category: "Lager", price: 6.9 },
      { name: "Guinness", category: "Stout", price: 6.8 },
      { name: "Doom Bar", category: "Real Ale", price: 6.1 },
      { name: "BrewDog Punk IPA", category: "IPA", price: 7.1 },
      { name: "Cornish Orchards Gold", category: "Cider", price: 6.7 }
    ]
  },
  {
    id: "the-toucan",
    name: "The Toucan",
    address: "19 Carlisle Street, Soho, London W1D 3BY",
    area: "Soho",
    lat: 51.51527,
    lng: -0.13248,
    opened_year: null,
    tags: ["irish-pub", "sports-tv", "live-music"],
    description:
      "A small, lively Irish bar off Soho Square with a big reputation for Guinness and Irish whiskey. It spills onto the pavement on busy nights.",
    drinks: [
      { name: "Guinness", category: "Stout", price: 6.3 },
      { name: "Harp Lager", category: "Lager", price: 6.2 },
      { name: "Smithwick's Red Ale", category: "Real Ale", price: 6.4 },
      { name: "Bulmers Original", category: "Cider", price: 6.2 }
    ]
  },
  {
    id: "the-coal-hole",
    name: "The Coal Hole",
    address: "91-92 Strand, London WC2R 0DW",
    area: "Covent Garden",
    lat: 51.51027,
    lng: -0.12093,
    opened_year: 1904,
    tags: ["historic", "real-ale-specialist", "cellar-bar", "victorian-interior", "food"],
    description:
      "An Edwardian pub in the Savoy buildings on the Strand, with an Arts and Crafts interior and a cellar bar. Its name comes from the coal cellars once used by the Savoy.",
    drinks: [
      { name: "Fuller's London Pride", category: "Real Ale", price: 6.6 },
      { name: "Madri Excepcional", category: "Lager", price: 7.3 },
      { name: "Guinness", category: "Stout", price: 7.0 },
      { name: "Camden Pale Ale", category: "Pale Ale", price: 7.1 },
      { name: "Aspall Suffolk Cyder", category: "Cider", price: 6.9 },
      { name: "Blue Moon", category: "Wheat Beer", price: 7.4 }
    ]
  },
  {
    id: "the-craft-beer-co-holborn",
    name: "The Craft Beer Co.",
    address: "168 High Holborn, London WC1V 7AA",
    area: "Holborn",
    lat: 51.51676,
    lng: -0.12549,
    opened_year: null,
    tags: ["craft-beer", "real-ale-specialist", "quiz-night"],
    description:
      "A craft beer bar with a long wall of rotating keg and cask lines, from local London breweries to rare imports.",
    drinks: [
      { name: "Kernel Table Beer", category: "Pale Ale", price: 6.8 },
      { name: "Cloudwater IPA", category: "IPA", price: 8.0 },
      { name: "Titanic Plum Porter", category: "Stout", price: 6.9 },
      { name: "Lost & Grounded Keller Pils", category: "Lager", price: 7.4 },
      { name: "Oliver's Cider", category: "Cider", price: 7.2 },
      { name: "Schneider Weisse", category: "Wheat Beer", price: 7.8 }
    ]
  },
  {
    id: "the-cross-keys",
    name: "The Cross Keys",
    address: "31 Endell Street, London WC2H 9EB",
    area: "Covent Garden",
    lat: 51.51452,
    lng: -0.12507,
    opened_year: 1848,
    tags: ["historic", "outdoor-drinking", "food"],
    description:
      "An ivy-clad Victorian pub packed with curios, brass and memorabilia. The outside is covered in hanging baskets in summer.",
    drinks: [
      { name: "Brodie's Citra", category: "Pale Ale", price: 6.4 },
      { name: "Guinness", category: "Stout", price: 6.6 },
      { name: "Camden Hells", category: "Lager", price: 6.9 },
      { name: "Harveys Sussex Best", category: "Real Ale", price: 5.9 },
      { name: "Thatchers Gold", category: "Cider", price: 6.5 }
    ]
  },
  {
    id: "the-ship-tavern",
    name: "The Ship Tavern",
    address: "12 Gate Street, Holborn, London WC2A 3HP",
    area: "Holborn",
    lat: 51.51712,
    lng: -0.11846,
    opened_year: 1549,
    tags: ["historic", "food", "victorian-interior", "live-music"],
    description:
      "A tavern said to date back to 1549, rebuilt in 1923. It's known for its wood-panelled rooms and stories of secret Catholic masses held here in Tudor times.",
    drinks: [
      { name: "Fuller's London Pride", category: "Real Ale", price: 6.5 },
      { name: "Guinness", category: "Stout", price: 6.9 },
      { name: "Asahi Super Dry", category: "Lager", price: 7.4 },
      { name: "Sierra Nevada Pale Ale", category: "Pale Ale", price: 7.3 },
      { name: "Aspall Suffolk Cyder", category: "Cider", price: 6.8 }
    ]
  },
  {
    id: "the-harp",
    name: "The Harp",
    address: "47 Chandos Place, London WC2N 4HS",
    area: "Covent Garden",
    lat: 51.50965,
    lng: -0.12594,
    opened_year: null,
    tags: ["real-ale-specialist", "historic"],
    description:
      "A narrow, much-loved real ale pub near Charing Cross with stained glass, portraits on the walls and an award-winning cask range.",
    drinks: [
      { name: "Harveys Sussex Best", category: "Real Ale", price: 5.6 },
      { name: "Dark Star Hophead", category: "Pale Ale", price: 5.9 },
      { name: "Guinness", category: "Stout", price: 6.4 },
      { name: "Fuller's Frontier", category: "Lager", price: 6.7 },
      { name: "Westons Old Rosie", category: "Cider", price: 6.2 }
    ]
  },
  {
    id: "lamb-and-flag",
    name: "Lamb and Flag",
    address: "33 Rose Street, Covent Garden, London WC2E 9EB",
    area: "Covent Garden",
    lat: 51.51155,
    lng: -0.12609,
    opened_year: 1772,
    tags: ["historic", "outdoor-drinking", "food", "live-music"],
    description:
      "One of Covent Garden's oldest pubs, tucked down an alley off Garrick Street. It was once nicknamed the Bucket of Blood for the bare-knuckle fights held here.",
    drinks: [
      { name: "Fuller's London Pride", category: "Real Ale", price: 6.3 },
      { name: "Fuller's ESB", category: "Real Ale", price: 6.6 },
      { name: "Guinness", category: "Stout", price: 6.8 },
      { name: "Fuller's Frontier", category: "Lager", price: 6.9 },
      { name: "Cornish Orchards Gold", category: "Cider", price: 6.6 }
    ]
  },
  {
    id: "the-porterhouse",
    name: "The Porterhouse",
    address: "21-22 Maiden Lane, Covent Garden, London WC2E 7NA",
    area: "Covent Garden",
    lat: 51.51077,
    lng: -0.1231,
    opened_year: null,
    tags: ["craft-beer", "irish-pub", "live-music", "sports-tv", "food"],
    description:
      "A sprawling multi-level Irish brewpub full of brass and copper pipework, pouring Porterhouse's own stouts and ales alongside a long bottle list.",
    drinks: [
      { name: "Porterhouse Oyster Stout", category: "Stout", price: 7.2 },
      { name: "Porterhouse Plain Porter", category: "Stout", price: 7.0 },
      { name: "Porterhouse Temple Bräu", category: "Lager", price: 7.1 },
      { name: "Porterhouse Hop Head", category: "IPA", price: 7.4 },
      { name: "Stonewell Cider", category: "Cider", price: 7.1 }
    ]
  },
  {
    id: "the-punch-and-judy",
    name: "The Punch and Judy",
    address: "40 The Market, Covent Garden Piazza, London WC2E 8RF",
    area: "Covent Garden",
    lat: 51.51187,
    lng: -0.12319,
    opened_year: null,
    tags: ["outdoor-drinking", "food", "sports-tv"],
    description:
      "A pub inside the old Covent Garden market building. Its balcony looks straight down on the Piazza's street performers.",
    drinks: [
      { name: "Samuel Adams Boston Lager", category: "Lager", price: 7.6 },
      { name: "Guinness", category: "Stout", price: 7.3 },
      { name: "Greene King IPA", category: "Real Ale", price: 6.4 },
      { name: "Camden Pale Ale", category: "Pale Ale", price: 7.5 },
      { name: "Strongbow Dark Fruit", category: "Cider", price: 7.2 }
    ]
  },
  {
    id: "the-salisbury",
    name: "The Salisbury",
    address: "90 St Martin's Lane, London WC2N 4AP",
    area: "Covent Garden",
    lat: 51.51099,
    lng: -0.12736,
    opened_year: 1892,
    tags: ["historic", "victorian-interior", "food"],
    description:
      "A theatreland pub with one of London's most spectacular late-Victorian interiors: etched glass, mahogany and bronze nymph lamps.",
    drinks: [
      { name: "Timothy Taylor Landlord", category: "Real Ale", price: 6.8 },
      { name: "Guinness", category: "Stout", price: 7.1 },
      { name: "Madri Excepcional", category: "Lager", price: 7.4 },
      { name: "Beavertown Neck Oil", category: "Pale Ale", price: 7.5 },
      { name: "Aspall Suffolk Cyder", category: "Cider", price: 7.0 }
    ]
  },
  {
    id: "the-rocket",
    name: "The Rocket",
    address: "120 Euston Road, London NW1 2AL",
    area: "King's Cross",
    lat: 51.52808,
    lng: -0.13052,
    opened_year: 1899,
    tags: ["historic", "victorian-interior", "sports-tv", "food", "quiz-night", "live-music", "dog-friendly"],
    description:
      "A Grade II listed Victorian corner pub on Euston Road, rebuilt in 1899 for the Cannon Brewery and once called The Rising Sun. Its arched windows wrap around the corner, and it's handy for Euston, King's Cross and St Pancras.",
    drinks: [
      // Draught (pints) from The Rocket's order-at-table menu on its website, Archie's screenshots 24 Sep 2026 07:24.
      // Shown there as "out of stock" only because online ordering was switched off.
      { name: "Timothy Taylor Landlord", category: "Real Ale", price: 6.45, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Alpacalypse", category: "Other", price: 7.40, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Beavertown Neck Oil", category: "Pale Ale", price: 7.90, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Jubel Peach", category: "Lager", price: 7.95, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Camden Hells", category: "Lager", price: 7.70, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Asahi Super Dry", category: "Lager", price: 7.75, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Heineken", category: "Lager", price: 7.05, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Peroni Nastro Azzurro", category: "Lager", price: 7.60, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Madri", category: "Lager", price: 7.15, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Mahou", category: "Lager", price: 7.30, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Coors", category: "Lager", price: 6.25, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Guinness", category: "Stout", price: 6.65, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Strongbow Dark Fruit", category: "Cider", price: 6.40, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      { name: "Inch's Cider", category: "Cider", price: 6.15, source: "website", source_url: ROCKET_MENU, updated: ROCKET_ORDER_DATE },
      // Real prices from The Rocket's own drinks page (Beer & Cider tab), from Archie's screenshots of 24 Sep 2026.
      // All packaged (bottles), not draught; sizes are as printed (none printed for some).
      { name: "Modelo", category: "Lager", price: 6.10, measure: "bottle", volume_ml: 355, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Peroni", category: "Lager", price: 6.05, measure: "bottle", volume_ml: 330, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Corona", category: "Lager", price: 6.05, measure: "bottle", volume_ml: 330, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Budweiser", category: "Lager", price: 6.05, measure: "bottle", volume_ml: 330, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Desperados", category: "Lager", price: 6.30, measure: "bottle", volume_ml: 330, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Daura Damm (gluten free)", category: "Lager", price: 6.05, measure: "bottle", volume_ml: 330, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Schöfferhofer Grapefruit Wheat Beer", category: "Wheat Beer", price: 6.30, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Newcastle Brown Ale", category: "Other", price: 5.90, measure: "bottle", volume_ml: 550, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Sharp's Atlantic Pale Ale", category: "Pale Ale", price: 6.20, measure: "bottle", source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Sharp's Doom Bar", category: "Other", price: 6.20, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Magners Original", category: "Cider", price: 6.25, measure: "bottle", volume_ml: 568, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Thatchers Haze", category: "Cider", price: 6.75, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Rekorderlig Peach Raspberry", category: "Cider", price: 6.70, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Rekorderlig Strawberry Lime", category: "Cider", price: 6.70, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE },
      { name: "Rekorderlig Wild Berries", category: "Cider", price: 6.70, measure: "bottle", volume_ml: 500, source: "website", source_url: ROCKET_MENU, updated: ROCKET_MENU_DATE }
    ]
  },
  {
    id: "the-rosendale",
    name: "The Rosendale",
    address: "65 Rosendale Road, West Dulwich, London SE21 8EZ",
    area: "West Dulwich",
    lat: 51.4368,
    lng: -0.0946,
    opened_year: null,
    tags: ["historic", "food", "beer-garden", "dog-friendly", "quiz-night"],
    description:
      "A Grade II listed former Victorian coaching inn with a pillared portico and original Royal Doulton tiles. It has three gardens with a children's play area, table tennis and boules, and a dining room serving seasonal food.",
    drinks: [
      // Draught beer & cider and cask ale from the Spring 2026 drinks menu. The menu doesn't say pint, but
      // these are draught prices, so they're recorded as pints: check at the bar.
      { name: "Amstel", category: "Lager", price: 6.40, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Birra Moretti", category: "Lager", price: 7.50, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Brixton Coldharbour Lager", category: "Lager", price: 7.40, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Cruzcampo", category: "Lager", price: 6.90, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Beavertown Neck Oil", category: "Pale Ale", price: 7.60, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Brixton Reliance Pale Ale", category: "Pale Ale", price: 7.40, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Gipsy Hill Hepcat", category: "IPA", price: 7.60, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Henry Weston's Vintage Cider", category: "Cider", price: 6.60, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Jubel Peach", category: "Lager", price: 7.80, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Guinness", category: "Stout", price: 7.30, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Lucky Saint (0.5%)", category: "Lager", price: 6.00, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Timothy Taylor Golden Best", category: "Real Ale", price: 6.40, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE },
      { name: "Harvey's Sussex Best", category: "Real Ale", price: 6.40, source: "website", source_url: ROSENDALE_MENU, updated: ROSENDALE_MENU_DATE }
    ]
  }
];
