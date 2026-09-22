const EARTH_RADIUS_M = 6371000;

// Map framing for Soho, Covent Garden & Holborn.
export const AREA_CENTRE = { lat: 51.5132, lng: -0.1275 };
export const AREA_BOUNDS = { south: 51.495, west: -0.16, north: 51.53, east: -0.1 };

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

export function isInArea(point) {
  return isValidPoint(point) && point.lat >= AREA_BOUNDS.south && point.lat <= AREA_BOUNDS.north
    && point.lng >= AREA_BOUNDS.west && point.lng <= AREA_BOUNDS.east;
}
