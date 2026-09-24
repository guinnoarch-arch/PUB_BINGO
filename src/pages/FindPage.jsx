import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { CATEGORIES } from "../data/seedPubs.js";
import { cheapestPerPub, cheapestPints, searchDrinks, unconfirmedPubs } from "../lib/core/search.js";
import { formatDistance, isInArea } from "../lib/core/geo.js";
import PubMap from "../components/map/PubMap.jsx";
import FavouriteButton from "../components/ui/FavouriteButton.jsx";
import { PriceTag, SourceBadge, UpdatedAgo } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import LiveFeed from "../components/LiveFeed.jsx";

const SUGGESTIONS = ["Guinness", "IPA", "Camden Hells", "London Pride", "Cider"];

export default function FindPage() {
  const { pubs, pubsStatus, pubsError, reloadPubs, toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = CATEGORIES.includes(params.get("cat")) ? params.get("cat") : null;
  const [origin, setOrigin] = useState(null);
  const [sortBy, setSortBy] = useState("price");
  const [locating, setLocating] = useState(false);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  // Only confirmed prices (community, pub website, admin check) are listed; estimates stay on pub pages.
  const results = useMemo(
    () => searchDrinks(pubs, { query, category, origin, sortBy, realOnly: true }),
    [pubs, query, category, origin, sortBy]
  );
  const filtering = Boolean(query.trim() || category);
  const unconfirmed = useMemo(() => (filtering ? unconfirmedPubs(pubs, { query, category }) : []), [pubs, query, category, filtering]);
  const unconfirmedIds = useMemo(() => new Set(unconfirmed.map(u => u.pub.id)), [unconfirmed]);
  const pricesByPub = useMemo(() => (filtering ? cheapestPerPub(results) : null), [filtering, results]);
  const cheapestNow = useMemo(() => cheapestPints(pubs, { limit: 5, realOnly: true }), [pubs]);

  function pickOrigin(point) {
    setOrigin(point);
    setSortBy("distance");
  }

  function locateMe() {
    if (!navigator.geolocation) {
      toast("Your browser can't share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!isInArea(point)) toast("You look a long way from Soho. Distances will still work, but they'll be big.");
        pickOrigin(point);
      },
      () => {
        setLocating(false);
        toast("Couldn't get your location. Tap the map to pick a point instead.", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <>
      <section className="card search-card">
        <form role="search" onSubmit={event => event.preventDefault()}>
          <label htmlFor="pint-search" className="search-label">Find the cheapest pint of…</label>
          <div className="search-row">
            <input
              id="pint-search"
              type="search"
              value={query}
              onChange={event => updateParam("q", event.target.value)}
              placeholder="Guinness, IPA, Camden Hells…"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && <button type="button" className="secondary-button" onClick={() => updateParam("q", "")}>Clear</button>}
          </div>
        </form>
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button type="button" className={`chip ${!category ? "active" : ""}`} aria-pressed={!category} onClick={() => updateParam("cat", "")}>All</button>
          {CATEGORIES.filter(c => c !== "Other").map(c => (
            <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} aria-pressed={category === c} onClick={() => updateParam("cat", category === c ? "" : c)}>{c}</button>
          ))}
        </div>
      </section>

      <div className="find-layout">
        <section className="card map-card" aria-labelledby="map-heading">
          <div className="section-header">
            <h2 id="map-heading" className="section-title">Map</h2>
            <button type="button" className="secondary-button small" onClick={locateMe} disabled={locating}>
              {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
          <p className="muted small-text" aria-live="polite">
            {origin ? (
              <>Searching from your chosen point. <button type="button" className="text-button" onClick={() => { setOrigin(null); setSortBy("price"); }}>Clear point</button></>
            ) : "Tap anywhere on the map to search from there and sort by distance."}
          </p>
          <PubMap
            pubs={pubs}
            pricesByPub={pricesByPub}
            unconfirmedIds={unconfirmedIds}
            origin={origin}
            onPickOrigin={pickOrigin}
            onOpenPub={id => navigate(`/pubs/${id}`)}
          />
        </section>

        <section className="card results-card" aria-labelledby="results-heading">
          <div className="section-header">
            <h2 id="results-heading" className="section-title">
              {filtering ? `${results.length} confirmed price${results.length === 1 ? "" : "s"}` : "Confirmed prices"}
            </h2>
            <div className="segmented" role="group" aria-label="Sort results">
              <button type="button" className={sortBy === "price" ? "active" : ""} aria-pressed={sortBy === "price"} onClick={() => setSortBy("price")}>Cheapest</button>
              <button
                type="button"
                className={sortBy === "distance" ? "active" : ""}
                aria-pressed={sortBy === "distance"}
                disabled={!origin}
                title={origin ? "Sort by distance" : "Pick a point on the map first"}
                onClick={() => setSortBy("distance")}
              >
                Nearest
              </button>
            </div>
          </div>

          {pubsStatus === "loading" && <Loading label="Loading pubs and prices…" />}
          {pubsStatus === "error" && <ErrorState message={pubsError} onRetry={() => reloadPubs()} />}
          {pubsStatus === "ready" && results.length === 0 && !filtering && (
            <EmptyState title="No confirmed prices yet">
              <p>Prices show here once someone reports what they paid. Open any pub and tap “Report a price”, or search for a drink to see where it's sold.</p>
            </EmptyState>
          )}
          {pubsStatus === "ready" && results.length === 0 && filtering && unconfirmed.length > 0 && (
            <p className="status-message">No confirmed prices for “{query || category}” yet. These pubs stock it. Know the price? Report it!</p>
          )}
          {pubsStatus === "ready" && results.length === 0 && filtering && unconfirmed.length === 0 && (
            <EmptyState title={`No pubs found for “${query || category}”`}>
              <p>Try one of these, or add the drink from a pub's page if you've seen it.</p>
              <div className="chip-row">
                {SUGGESTIONS.map(s => <button key={s} type="button" className="chip" onClick={() => { updateParam("q", s); }}>{s}</button>)}
              </div>
            </EmptyState>
          )}
          {pubsStatus === "ready" && results.length > 0 && (
            <ol className="result-list">
              {results.slice(0, filtering ? 100 : 30).map(row => (
                <li key={row.drink.id} className="result-row">
                  <div className="result-main">
                    <Link to={`/pubs/${row.pub.id}`} className="result-link">
                      <strong>{row.drink.name}</strong>
                      <span className="muted"> {row.pub.name} · {row.pub.area}</span>
                    </Link>
                    <span className="result-meta">
                      <span className="category-pill">{row.drink.category}</span>
                      <SourceBadge source={row.drink.source} url={row.drink.source_url} />
                      <UpdatedAgo value={row.drink.last_updated_at} />
                    </span>
                    {row.distance != null && <span className="distance">{formatDistance(row.distance)}</span>}
                  </div>
                  <div className="result-side">
                    <PriceTag price={row.price} measure={row.measure} volumeMl={row.volumeMl} pintPrice={row.pintPrice} />
                    <FavouriteButton pub={row.pub} compact />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!filtering && results.length > 30 && <p className="muted small-text">Showing the 30 cheapest. Search to narrow it down.</p>}
          {pubsStatus === "ready" && unconfirmed.length > 0 && (
            <div className="unconfirmed-block">
              <h3 className="section-title">{results.length ? "Also stocked here (price not confirmed yet)" : "Stocked here (price not confirmed yet)"}</h3>
              <ul className="unconfirmed-list">
                {unconfirmed.map(({ pub, drinks }) => (
                  <li key={pub.id}>
                    <Link to={`/pubs/${pub.id}`} className="result-link"><strong>{pub.name}</strong> <span className="muted">· {pub.area} · {drinks.join(", ")}</span></Link>
                    <Link to={`/pubs/${pub.id}#report`} className="secondary-button small">Report price</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="two-column">
        <section className="card" aria-labelledby="cheapest-heading">
          <div className="section-header">
            <h2 id="cheapest-heading" className="section-title">Cheapest pint right now</h2>
            <Link to="/leaderboard" className="text-button">Full leaderboard</Link>
          </div>
          {cheapestNow.length === 0 && <p className="muted">No confirmed prices yet. Be the first to report one!</p>}
          <ol className="mini-list">
            {cheapestNow.map((row, index) => (
              <li key={row.drink.id}>
                <span className="rank">{index + 1}</span>
                <Link to={`/pubs/${row.pub.id}`}>{row.drink.name} <span className="muted">at {row.pub.name}</span></Link>
                <PriceTag price={row.price} measure={row.measure} volumeMl={row.volumeMl} pintPrice={row.pintPrice} />
              </li>
            ))}
          </ol>
        </section>
        <section className="card" aria-labelledby="feed-heading">
          <div className="section-header">
            <h2 id="feed-heading" className="section-title">Latest reports</h2>
            <Link to="/feed" className="text-button">See all</Link>
          </div>
          <LiveFeed limit={5} compact />
        </section>
      </div>
    </>
  );
}
