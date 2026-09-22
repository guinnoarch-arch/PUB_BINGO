import { SEED_PUBS } from "../../src/data/seedPubs.js";

// Seed pubs shaped like the API returns them (drinks with current_price etc.).
export function seedPubsAsApi() {
  return SEED_PUBS.map(pub => ({
    ...pub,
    drinks: pub.drinks.map((d, i) => ({
      id: `${pub.id}-${i}`,
      pub_id: pub.id,
      name: d.name,
      category: d.category,
      measure: d.measure || "pint",
      current_price: d.price,
      source: "seed",
      last_updated_at: "2026-09-01T12:00:00Z"
    }))
  }));
}

export const pub = (id, lat, lng, drinks, extra = {}) => ({
  id, name: id, lat, lng, area: "Soho", ...extra,
  drinks: drinks.map((d, i) => ({ id: `${id}-${i}`, measure: "pint", category: "Lager", ...d }))
});
