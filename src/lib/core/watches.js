// Price watches: "Guinness under £6 (in Soho)". Matches use confirmed draught prices, per pint.
import { searchDrinks } from "./search.js";

export function watchMatches(pubs, watch) {
  return searchDrinks(pubs, { query: watch.query, realOnly: true, draughtOnly: true })
    .filter(row => row.pintPrice != null && row.pintPrice <= Number(watch.max_price) && (!watch.area || row.pub.area === watch.area));
}

export function allWatchMatches(pubs, watches) {
  return (watches || []).map(watch => ({ watch, matches: watchMatches(pubs, watch) }));
}
