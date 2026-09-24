import { useMemo } from "react";
import { AREAS } from "../../data/seedPubs.js";
import { searchDrinks } from "../../lib/core/search.js";
import { formatPrice } from "../../lib/core/prices.js";

// Average confirmed pint price per area right now (bar length = price, labelled directly).
export default function AreaAverages({ pubs }) {
  const rows = useMemo(() => AREAS.map(area => {
    const prices = searchDrinks(pubs.filter(p => p.area === area), { realOnly: true, draughtOnly: true }).map(r => r.pintPrice).filter(Boolean);
    return { area, count: prices.length, average: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null };
  }).filter(r => r.count > 0), [pubs]);
  if (!rows.length) return <p className="muted">No confirmed prices yet.</p>;
  const max = Math.max(...rows.map(r => r.average));
  return (
    <>
      <ul className="area-bars" aria-label="Average confirmed pint price by area">
        {rows.map(r => (
          <li key={r.area}>
            <span className="area-name">{r.area}</span>
            <span className="area-bar-track"><span className="area-bar" style={{ width: `${Math.max(8, (r.average / max) * 100)}%` }} /></span>
            <span className="area-value"><strong>{formatPrice(r.average)}</strong> <span className="muted small-text">({r.count})</span></span>
          </li>
        ))}
      </ul>
      <p className="muted small-text">Average of confirmed draught prices, per pint. Number of prices in brackets.</p>
    </>
  );
}
