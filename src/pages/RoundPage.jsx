import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { priceRound } from "../lib/core/round.js";
import { formatDistance } from "../lib/core/geo.js";
import { formatPrice } from "../lib/core/prices.js";
import FeaturePage from "../components/features/FeaturePage.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import { Loading } from "../components/ui/States.jsx";

const QUICK = ["Guinness", "any lager", "IPA", "cider", "real ale"];

function Round() {
  const { livePubs, pubsStatus, toast } = useApp();
  const [items, setItems] = useState([{ query: "Guinness", qty: 2 }, { query: "any lager", qty: 2 }]);
  const [includeEstimates, setIncludeEstimates] = useState(false);
  const [origin, setOrigin] = useState(null);
  const rows = useMemo(() => priceRound(livePubs, items, { origin, includeEstimates }), [livePubs, items, origin, includeEstimates]);
  const people = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

  const update = (index, patch) => setItems(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  function locate() {
    navigator.geolocation?.getCurrentPosition(
      pos => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast("Couldn't get your location.", "error")
    );
  }

  if (pubsStatus === "loading") return <Loading />;
  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Your round</p>
          <h2>Round calculator</h2>
        </div>
        <NotLaunched feature="round_calculator" />
      </div>
      <section className="card">
        <p className="muted small-text">Add what everyone's drinking. Type a drink or a type (“any lager”). The cheapest match at each pub is used, per pint.</p>
        <ul className="round-items">
          {items.map((item, i) => (
            <li key={i}>
              <label className="sr-only" htmlFor={`round-qty-${i}`}>How many</label>
              <select id={`round-qty-${i}`} value={item.qty} onChange={e => update(i, { qty: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}×</option>)}
              </select>
              <label className="sr-only" htmlFor={`round-drink-${i}`}>Drink</label>
              <input id={`round-drink-${i}`} list="round-quick" value={item.query} onChange={e => update(i, { query: e.target.value })} placeholder="e.g. Guinness" />
              <button type="button" className="text-button danger" aria-label={`Remove ${item.query || "drink"}`} onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
        <datalist id="round-quick">{QUICK.map(q => <option key={q} value={q} />)}</datalist>
        <div className="row-actions wrap">
          <button type="button" className="secondary-button small" onClick={() => setItems(prev => [...prev, { query: "", qty: 1 }])} disabled={items.length >= 8}>+ Add drink</button>
          <button type="button" className="secondary-button small" onClick={locate}>{origin ? "✓ Near me" : "Sort by distance too"}</button>
          <label className="checkbox-label"><input type="checkbox" checked={includeEstimates} onChange={e => setIncludeEstimates(e.target.checked)} /> Include estimated prices</label>
        </div>
      </section>

      <section className="card" aria-labelledby="round-results">
        <h2 id="round-results" className="section-title">{people} drink{people === 1 ? "" : "s"}: cheapest first</h2>
        {rows.length === 0 ? <p className="muted">No pubs with confirmed prices for these yet.</p> : (
          <ol className="round-results">
            {rows.slice(0, 20).map((row, index) => (
              <li key={row.pub.id} className={row.complete ? "" : "incomplete"}>
                <span className={`rank ${index < 3 && row.complete ? `top top-${index + 1}` : ""}`}>{index + 1}</span>
                <div className="result-main">
                  <Link to={`/pubs/${row.pub.id}`} className="result-link"><strong>{row.pub.name}</strong> <span className="muted">{row.pub.area}</span></Link>
                  <span className="small-text muted">
                    {row.lines.map(l => `${l.item.qty}× ${l.drink.name} ${formatPrice(l.each)}${l.estimate ? " (est.)" : ""}`).join(" · ")}
                  </span>
                  {row.missing.length > 0 && <span className="small-text warn-text">No {row.missing.join(", ")} here</span>}
                  {row.distance != null && <span className="distance">{formatDistance(row.distance)}</span>}
                </div>
                <span className="price-tag large"><strong>{formatPrice(row.total)}</strong>{row.complete && people > 1 && <small> ({formatPrice(row.total / people)} each)</small>}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

export default function RoundPage() {
  return <FeaturePage feature="round_calculator"><Round /></FeaturePage>;
}
