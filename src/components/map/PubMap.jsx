import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_CENTRE, isInArea } from "../../lib/core/geo.js";
import { formatPrice, measureLabel } from "../../lib/core/prices.js";

// Leaflet map of all pubs. Pins show the cheapest matching price. Clicking the map sets the
// "search from here" point. Built with plain Leaflet; pin/popup content is built with DOM
// text nodes, never HTML strings, so pub or drink names can't inject markup.
// unconfirmedIds: pubs that stock the searched drink but have no confirmed price yet (shown as "£?").
export default function PubMap({ pubs, pricesByPub, unconfirmedIds, origin, onPickOrigin, onOpenPub, selectedPubId }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const originRef = useRef(null);
  const fittedRef = useRef(false);
  const handlersRef = useRef({ onPickOrigin, onOpenPub });
  handlersRef.current = { onPickOrigin, onOpenPub };

  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false, tap: true })
      .setView([AREA_CENTRE.lat, AREA_CENTRE.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on("click", event => handlersRef.current.onPickOrigin?.({ lat: event.latlng.lat, lng: event.latlng.lng }));
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Leaflet measures its container on creation; re-measure once layout settles.
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const pub of pubs) {
      if (!Number.isFinite(pub.lat) || !Number.isFinite(pub.lng)) continue;
      const row = pricesByPub?.get(pub.id);
      const unconfirmed = !row && Boolean(unconfirmedIds?.has(pub.id));
      const dimmed = pricesByPub && !row && !unconfirmed;
      const pin = document.createElement("div");
      pin.className = `pub-pin${dimmed ? " dimmed" : ""}${unconfirmed ? " unconfirmed" : ""}${pub.id === selectedPubId ? " selected" : ""}`;
      // Draught shows the price per pint; a pub with only bottles shows the bottle price, marked "btl".
      pin.textContent = row ? (row.draught ? formatPrice(row.pintPrice) : `${formatPrice(row.price)} btl`) : unconfirmed ? "£?" : "🍺";
      const marker = L.marker([pub.lat, pub.lng], {
        icon: L.divIcon({ html: pin, className: "pub-pin-wrap", iconSize: null }),
        title: row ? `${pub.name}: ${row.drink.name} ${formatPrice(row.price)}` : unconfirmed ? `${pub.name}: price not confirmed yet` : pub.name,
        alt: pub.name,
        riseOnHover: true,
        zIndexOffset: row ? 1000 : 0
      });

      const popup = document.createElement("div");
      popup.className = "pub-popup";
      const title = document.createElement("strong");
      title.textContent = pub.name;
      const detail = document.createElement("span");
      detail.textContent = row
        ? `${row.drink.name} · ${formatPrice(row.price)}${row.measure !== "pint" ? ` / ${measureLabel(row.measure, row.volumeMl)}` : ""}`
        : unconfirmed ? "Stocks it, but the price isn't confirmed yet" : pub.area;
      const link = document.createElement("button");
      link.type = "button";
      link.className = "popup-link";
      link.textContent = "View pub →";
      link.addEventListener("click", () => handlersRef.current.onOpenPub?.(pub.id));
      popup.append(title, detail, link);
      marker.bindPopup(popup);
      marker.on("click", () => marker.openPopup());
      layer.addLayer(marker);
    }
    // On first load, zoom to show every central pub (Soho up to King's Cross). Pubs further out, like
    // West Dulwich, are left out of the framing so the centre stays readable; they're still on the map.
    const located = pubs.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const central = located.filter(p => isInArea(p));
    const points = (central.length > 1 ? central : located).map(p => [p.lat, p.lng]);
    if (!fittedRef.current && points.length && mapRef.current) {
      // No animation: an animated zoom still running when the map is removed makes Leaflet throw.
      if (points.length > 1) mapRef.current.fitBounds(points, { padding: [30, 30], maxZoom: 16, animate: false });
      else mapRef.current.setView(points[0], 16, { animate: false });
      fittedRef.current = true;
    }
  }, [pubs, pricesByPub, unconfirmedIds, selectedPubId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    originRef.current?.remove();
    originRef.current = null;
    if (origin) {
      originRef.current = L.circleMarker([origin.lat, origin.lng], {
        radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1
      }).bindTooltip("Searching from here", { direction: "top" }).addTo(map);
    }
  }, [origin]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="pub-map" role="region" aria-label="Map of pubs. Click or tap the map to search from that point." />
    </div>
  );
}
