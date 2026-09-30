const EARTH_RADIUS_M = 6371000;

// Where the map starts before the pubs load (central London).
export const AREA_CENTRE = { lat: 51.5132, lng: -0.1275 };

export function isValidPoint(point) {
  return Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

// Great-circle distance in metres.
export function distanceMetres(a, b) {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ~80 m per minute is a relaxed city walking pace.
export function formatDistance(metres) {
  if (metres == null) return "";
  const minutes = Math.max(1, Math.round(metres / 80));
  const dist = metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
  return `${dist} · ${minutes} min walk`;
}

// The `count` pubs closest to a point (pubs without a map position are skipped).
export function nearestPubs(pubs, point, count = 3) {
  if (!isValidPoint(point)) return [];
  return pubs
    .map(pub => ({ pub, metres: distanceMetres(point, pub) }))
    .filter(x => x.metres != null)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, count)
    .map(x => x.pub);
}
