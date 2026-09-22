import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_CENTRE } from "../../lib/core/geo.js";
import { formatPrice } from "../../lib/core/prices.js";

// Leaflet map of all pubs. Pins show the cheapest matching price. Clicking the map sets the
// "search from here" point. Built with plain Leaflet; pin/popup content is built with DOM
// text nodes, never HTML strings, so pub or drink names can't inject markup.
export default function PubMap({ pubs, pricesByPub, origin, onPickOrigin, onOpenPub, selectedPubId }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const originRef = useRef(null);
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
      const row = pricesByPub?.get(pub.id);
      const dimmed = pricesByPub && !row;
      const pin = document.createElement("div");
      pin.className = `pub-pin${dimmed ? " dimmed" : ""}${pub.id === selectedPubId ? " selected" : ""}`;
      pin.textContent = row ? formatPrice(row.pintPrice) : "🍺";
      const marker = L.marker([pub.lat, pub.lng], {
        icon: L.divIcon({ html: pin, className: "pub-pin-wrap", iconSize: null }),
        title: row ? `${pub.name}: ${row.drink.name} ${formatPrice(row.price)}` : pub.name,
        alt: pub.name,
        riseOnHover: true,
        zIndexOffset: row ? 1000 : 0
      });

      const popup = document.createElement("div");
      popup.className = "pub-popup";
      const title = document.createElement("strong");
      title.textContent = pub.name;
      const detail = document.createElement("span");
      detail.textContent = row ? `${row.drink.name} · ${formatPrice(row.price)}${row.measure !== "pint" ? ` / ${row.measure}` : ""}` : pub.area;
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
  }, [pubs, pricesByPub, selectedPubId]);

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
