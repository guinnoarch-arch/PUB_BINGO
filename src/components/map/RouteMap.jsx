import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_CENTRE } from "../../lib/core/geo.js";

// Numbered stops joined by a line (straight lines between pubs, not street routes).
export default function RouteMap({ stops, start, onPickStart }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pickRef = useRef(onPickStart);
  pickRef.current = onPickStart;

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([AREA_CENTRE.lat, AREA_CENTRE.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on("click", e => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const points = [];
    if (start) {
      points.push([start.lat, start.lng]);
      L.circleMarker([start.lat, start.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 })
        .bindTooltip("Start", { direction: "top" }).addTo(layer);
    }
    stops.forEach((pub, i) => {
      points.push([pub.lat, pub.lng]);
      const pin = document.createElement("div");
      pin.className = "pub-pin route-pin";
      pin.textContent = String(i + 1);
      L.marker([pub.lat, pub.lng], { icon: L.divIcon({ html: pin, className: "pub-pin-wrap", iconSize: null }), title: `${i + 1}. ${pub.name}`, alt: pub.name })
        .bindTooltip(`${i + 1}. ${pub.name}`, { direction: "top" }).addTo(layer);
    });
    if (points.length > 1) {
      L.polyline(points, { color: "#b7802a", weight: 3, dashArray: "6 6" }).addTo(layer);
      map.fitBounds(points, { padding: [40, 40], maxZoom: 17, animate: false });
    }
  }, [stops, start]);

  return <div className="map-wrap"><div ref={containerRef} className="pub-map" role="region" aria-label="Crawl route map. Tap the map to set a start point." /></div>;
}
