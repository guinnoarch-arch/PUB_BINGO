import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { cheapestByPub, cheapestCrawl, orderRoute, walkMinutes, WALK_FACTOR } from "../lib/core/crawl.js";
import { distanceMetres } from "../lib/core/geo.js";
import { formatPrice } from "../lib/core/prices.js";
import FeaturePage from "../components/features/FeaturePage.jsx";
import RouteMap from "../components/map/RouteMap.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import { Loading } from "../components/ui/States.jsx";

const d = (a, b) => distanceMetres({ lat: Number(a.lat), lng: Number(a.lng) }, { lat: Number(b.lat), lng: Number(b.lng) }) ?? 0;

function Crawl() {
  const { livePubs, pubsStatus, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const shared = (params.get("stops") || "").split(",").filter(Boolean);
  const [mode, setMode] = useState(shared.length ? "pick" : "cheapest");
  const [query, setQuery] = useState(params.get("q") || "");
  const [count, setCount] = useState(4);
  const [start, setStart] = useState(null);
  const [picked, setPicked] = useState(() => new Set(shared));
  const pubs = useMemo(() => livePubs.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [livePubs]);
  const best = useMemo(() => cheapestByPub(pubs, query), [pubs, query]);

  const route = useMemo(() => {
    if (mode === "cheapest") return cheapestCrawl(pubs, { origin: start, count, query });
    return orderRoute(pubs.filter(p => picked.has(p.id)), start);
  }, [mode, pubs, start, count, query, picked]);

  const legs = route.map((pub, i) => (i === 0 ? (start ? d(start, pub) : 0) : d(route[i - 1], pub)));
  const walk = legs.reduce((a, b) => a + b, 0);
  const total = route.reduce((sum, pub) => sum + (best.get(pub.id)?.pintPrice || 0), 0);
  const unpriced = route.filter(pub => !best.get(pub.id)).length;

  function locate() {
    if (!navigator.geolocation) { toast("Your browser can't share its location. Tap the map instead."); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast("Couldn't get your location. Tap the map to set a start.", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function share() {
    const next = new URLSearchParams();
    next.set("stops", route.map(p => p.id).join(","));
    if (query.trim()) next.set("q", query.trim());
    const url = `${window.location.origin}/crawl?${next}`;
    setParams(next, { replace: true });
    try {
      if (navigator.share) await navigator.share({ title: "Pub crawl", text: route.map((p, i) => `${i + 1}. ${p.name}`).join("\n"), url });
      else { await navigator.clipboard.writeText(url); toast("Link copied. Send it to your mates!", "success"); }
    } catch { /* share cancelled */ }
  }

  const toggle = id => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (pubsStatus === "loading") return <Loading />;
  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Plan a night out</p>
          <h2>Pub crawl planner</h2>
        </div>
        <NotLaunched feature="crawl_planner" />
      </div>

      <section className="card">
        <div className="segmented" role="group" aria-label="How to plan">
          <button type="button" className={mode === "cheapest" ? "active" : ""} aria-pressed={mode === "cheapest"} onClick={() => setMode("cheapest")}>Cheapest crawl</button>
          <button type="button" className={mode === "pick" ? "active" : ""} aria-pressed={mode === "pick"} onClick={() => setMode("pick")}>Pick my pubs</button>
        </div>
        <div className="form-grid crawl-options">
          <div className="field">
            <label htmlFor="crawl-drink">Drink (optional)</label>
            <input id="crawl-drink" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Guinness, lager" />
          </div>
          {mode === "cheapest" && (
            <div className="field">
              <label htmlFor="crawl-count">Stops</label>
              <select id="crawl-count" value={count} onChange={e => setCount(Number(e.target.value))}>
                {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n} pubs</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <span className="field-label">Start</span>
            <div className="row-actions wrap">
              <button type="button" className="secondary-button small" onClick={locate}>Use my location</button>
              {start && <button type="button" className="text-button" onClick={() => setStart(null)}>Clear start</button>}
            </div>
          </div>
        </div>
        <p className="muted small-text">
          {mode === "cheapest"
            ? `The ${count} pubs with the cheapest confirmed pint${query ? ` of “${query}”` : ""}${start ? ", within about 1.5 km of your start," : ""} in the shortest walking order. Tap the map to set a start point.`
            : "Tick the pubs you want; they're put in the shortest walking order. Tap the map to set a start point."}
        </p>
      </section>

      <div className="find-layout">
        <section className="card map-card" aria-label="Route map">
          <RouteMap stops={route} start={start} onPickStart={setStart} />
        </section>
        <section className="card" aria-labelledby="route-heading">
          <div className="section-header">
            <h2 id="route-heading" className="section-title">Your route</h2>
            {route.length > 1 && <button type="button" className="primary-button small" onClick={share}>Share crawl</button>}
          </div>
          {route.length === 0 ? (
            <p className="muted">{mode === "pick" ? "Tick some pubs below." : "No confirmed prices match yet. Try another drink, or clear the start point."}</p>
          ) : (
            <>
              <p className="crawl-total">
                <strong>{route.length} pubs</strong> · about {(walk * WALK_FACTOR / 1000).toFixed(1)} km, {walkMinutes(walk)} min walking
                {total > 0 && <> · <strong>{formatPrice(total)}</strong> for a pint in each{unpriced ? ` (${unpriced} without a confirmed price)` : ""}</>}
              </p>
              <ol className="crawl-list">
                {route.map((pub, i) => {
                  const row = best.get(pub.id);
                  return (
                    <li key={pub.id}>
                      <span className="rank">{i + 1}</span>
                      <div className="result-main">
                        <Link to={`/pubs/${pub.id}`} className="result-link"><strong>{pub.name}</strong> <span className="muted">{pub.area}</span></Link>
                        <span className="muted small-text">
                          {row ? `${row.drink.name} ${formatPrice(row.pintPrice)}` : "No confirmed price"}
                          {legs[i] > 0 && ` · ${walkMinutes(legs[i])} min walk${i === 0 ? " from start" : ""}`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="muted small-text">Walking times are estimates. Drink responsibly and drink water between pubs.</p>
            </>
          )}
        </section>
      </div>

      {mode === "pick" && (
        <section className="card" aria-labelledby="pick-heading">
          <h2 id="pick-heading" className="section-title">Pubs</h2>
          <ul className="pick-list">
            {[...pubs].sort((a, b) => a.name.localeCompare(b.name)).map(pub => {
              const row = best.get(pub.id);
              return (
                <li key={pub.id}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={picked.has(pub.id)} onChange={() => toggle(pub.id)} />
                    <strong>{pub.name}</strong> <span className="muted small-text">{pub.area}{row ? ` · from ${formatPrice(row.pintPrice)}` : ""}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

export default function CrawlPage() {
  return <FeaturePage feature="crawl_planner"><Crawl /></FeaturePage>;
}
