// The extra filters on Find ("pub_filters" feature): open now, sport on tonight, outside seating.
import { isOpenAt } from "./hours.js";

export const PUB_FILTERS = [
  { key: "open", label: "Open now" },
  { key: "sport", label: "Sport on tonight" },
  { key: "outside", label: "Outside seating" }
];

const OUTSIDE_TAGS = ["beer-garden", "outdoor-drinking"];

// filters: Set of keys. sportPubIds: Set of pubs showing sport tonight (from What's on).
export function filterPubs(pubs, filters, { now, sportPubIds = null } = {}) {
  if (!filters?.size) return pubs;
  return pubs.filter(pub =>
    (!filters.has("open") || isOpenAt(pub.opening_hours, now) === true)
    && (!filters.has("sport") || Boolean(sportPubIds?.has(pub.id)))
    && (!filters.has("outside") || (pub.tags || []).some(tag => OUTSIDE_TAGS.includes(tag))));
}
