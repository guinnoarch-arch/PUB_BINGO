# Getting real pint prices into Pub Bingo

_Research done 23 September 2026._

## Where we are

All 70 starting prices are **estimates**. They're shown with an "Estimate" badge, and the admin table shows **0% real prices**. The goal is to replace every estimate with a price that has a source and a date.

Every price now records where it came from:

| Badge | Source | How it gets there |
|---|---|---|
| Estimate | `seed` | Starting guess. Replace it. |
| Community | `community` | A signed-in visitor reported what they paid |
| Pub website | `website` | An admin copied it from the pub's own menu. The link is saved and shown publicly |
| Verified | `admin` | An admin checked it in person or by phone |

Every price change is kept in the drink's history, so trends and mistakes can always be traced.

## What the research found

| Pub | Website | Operator | Drinks menu online? | Leads |
|---|---|---|---|---|
| The French House | frenchhousesoho.com | Independent | No (halves only; wine list online) | none |
| The Dog and Duck | Nicholson's page | Nicholson's (M&B) | Per-pub drinks page exists | none |
| The Coach and Horses | coachandhorsessoho.pub (/drink page) | Greene King | Drink page exists | pint-prices.com: Amstel £5.70 |
| The Blue Posts | theblueposts.net | Unknown | Not found | none |
| The Toucan | thetoucansoho.co.uk | Independent | Not found | Guinness £6.50 / £6.80 (two sources) |
| The Coal Hole | Nicholson's page | Nicholson's (M&B) | Per-pub drinks page exists | pint-prices.com has a page |
| The Craft Beer Co. | thecraftbeerco.com/covent-garden | Craft Beer Co. | Beer list on Untappd; rotates daily | ~£7.70 a pint (review) |
| The Cross Keys | **none found** | Unknown | No | none |
| The Ship Tavern | theshiptavern.co.uk | Independent (Evans family) | Not found | none |
| The Harp | harpcoventgarden.com (/drink page) | Fuller's | Drink page exists | cask ~£5.80–£6.05 (reviews) |
| Lamb and Flag | lambandflagcoventgarden.co.uk | Fuller's | Check | none |
| The Porterhouse | porterhouse.london | Porterhouse Brewing Co. | Check | none |
| The Punch and Judy | Greene King page (/menu) | Greene King | Per-pub menu page exists | pint-prices.com: Neck Oil £8.05, Peroni £7.85, Guinness £6.80 |
| The Salisbury | Greene King page (/menu) | Greene King | Per-pub menu page exists | one search result looked mixed up with another pub, so ignore it |
| The Rocket (King's Cross, added Sep 2026) | therocketeustonroad.co.uk (/drinks page) | Mitchells & Butlers | **Yes**: 15 bottled beers/ciders entered from screenshots (24 Sep 2026); draught not yet | none |

**Important caveats**
- The environment I built this in blocks these websites, so I found them through web search but couldn't open the pages. The website links are very likely right, but give each a quick click. Whether the menus actually show prices still needs checking.
- The "leads" come from third-party pages with **unknown dates**. They're stored as admin notes only and are **not** shown to the public as prices.
- Two data issues to check: the Toucan's postcode (search says W1D 3BX, we have W1D 3BY), and the **drinks lists themselves** for most pubs, which were also guesses.
- All of this is in each pub's **Price research** notes in the admin page (Admin → click the pub).

## Recommended plan

**1. Chain pubs first (quick wins, about 30 minutes).** Nicholson's, Greene King and Fuller's publish a menu page for each pub. Open it from the admin page ("Open drinks menu"), then use **Set price → The pub's website** for each drink. That covers 7 of the 14 pubs.

**2. The other seven.** Phone them, or visit. Use **Set price → I checked it in person**. The Cross Keys, Blue Posts, Ship Tavern, Toucan and French House are the ones most likely to need this.

**3. Community reports keep prices fresh.** This is already built. Ideas to strengthen it:
- **"Still right?" button:** one tap to confirm a price is still correct. This refreshes its date without re-typing it, and is much easier than a full report.
- **Receipt photo (optional):** attach a photo of the receipt to a report, which earns a "Receipt" badge.
- **Outlier check:** reports more than 30–50% away from recent ones get held for admin review instead of going live straight away. The form already warns about this.
- **Trust levels:** users whose reports keep matching others get a "trusted reporter" badge, and their reports count for more.

**4. Stop showing guesses (your call).** There are three options:
- **(a)** Keep showing estimates with the badge everywhere.
- **(b)** Show "Price not confirmed yet: report it", with no number, until a real price exists.
- **(c)** Leave estimates out of search results and the leaderboard, but keep them on the pub page.

**Chosen: (c).** Estimates are left out of search results, map prices and the leaderboard; pub pages still show them, marked "Estimate". Search lists pubs that stock a drink without a confirmed price under "price not confirmed yet", with a Report price button.

**5. Automate chain menus later (optional).** A scheduled job could read the Nicholson's, Greene King and Fuller's menu pages each week and flag prices that have changed, for an admin to approve. Check each site's terms before scraping. It would also need these sites added to the build environment's network allowlist.

**6. Partnerships (optional).** pint-prices.com and Guinndex already crowdsource UK pint prices. Ask them about sharing data or an API rather than copying their pages.

## Adding pubs that aren't ready yet

In **Admin → + Add pub**, only a name and area are needed. The pub is saved as **Hidden**, so only admins see it: it's not in search, the map, the leaderboard or the feed, and the database enforces this. You can add drinks and prices while it's hidden. Once it has an address and map position, tick **Live** to publish it.
