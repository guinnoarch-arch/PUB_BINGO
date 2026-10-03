// Leaflet draws markers and lines with plain colour strings, so read them from the design tokens.
const token = (name, fallback) => {
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

// "You are here" / start point: accent dot with a light ring.
export const pointMarkerStyle = () => ({ radius: 9, weight: 3, color: token("--surface", "#fffdf8"), fillColor: token("--accent", "#1f5a3a"), fillOpacity: 1 });

// The walking route between crawl stops.
export const routeLineStyle = () => ({ color: token("--text", "#1a1714"), weight: 3, dashArray: "6 6" });
