// Pub crawl planner: shortest walking order through a set of pubs (straight-line distances; real
// walking routes are a bit longer, so times are shown as "about").
import { distanceMetres } from "./geo.js";
import { cheapestPerPub, searchDrinks } from "./search.js";

const point = p => ({ lat: Number(p.lat), lng: Number(p.lng) });
const d = (a, b) => distanceMetres(point(a), point(b)) ?? 0;

export function routeDistance(stops, start = null) {
  let total = 0;
  let prev = start;
  for (const stop of stops) {
    if (prev) total += d(prev, stop);
    prev = stop;
  }
  return total;
}

// Nearest neighbour from the start (or the first stop), then 2-opt to remove crossings.
export function orderRoute(stops, start = null) {
  const remaining = [...stops];
  if (remaining.length < 2) return remaining;
  const route = [];
  let current = start;
  if (!current) {
    current = remaining.shift();
    route.push(current);
  }
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) if (d(current, remaining[i]) < d(current, remaining[best])) best = i;
    current = remaining.splice(best, 1)[0];
    route.push(current);
  }
  let improved = true;
  let guard = 0;
  while (improved && guard < 50) {
    improved = false;
    guard += 1;
    for (let i = 0; i < route.length - 1; i += 1) {
      for (let k = i + 1; k < route.length; k += 1) {
        const candidate = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        if (routeDistance(candidate, start) + 0.5 < routeDistance(route, start)) {
          route.splice(0, route.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return route;
}

// Street routes are longer than straight lines; 1.3× is a fair central-London average.
export const WALK_FACTOR = 1.3;
export function walkMinutes(metres) {
  return Math.max(1, Math.round((metres * WALK_FACTOR) / 80));
}

// The cheapest pint (matching the query) at each pub, confirmed prices only.
export function cheapestByPub(pubs, query = "") {
  return cheapestPerPub(searchDrinks(pubs, { query, realOnly: true, draughtOnly: true }));
}

// "Cheapest crawl from here": the N cheapest pubs within reach of the start, in walking order.
export function cheapestCrawl(pubs, { origin = null, count = 4, query = "", maxMetres = 1500 } = {}) {
  const best = cheapestByPub(pubs, query);
  const candidates = [...best.values()]
    .filter(row => !origin || (distanceMetres(origin, point(row.pub)) ?? Infinity) <= maxMetres)
    .sort((a, b) => a.pintPrice - b.pintPrice)
    .slice(0, count)
    .map(row => row.pub);
  return orderRoute(candidates, origin);
}
