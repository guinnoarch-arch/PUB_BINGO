import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { CATEGORIES } from "../data/seedPubs.js";
import { cheapestPerPub, cheapestPints, searchDrinks, unconfirmedPubs } from "../lib/core/search.js";
import PubMap from "../components/map/PubMap.jsx";
import { PriceTag } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import LiveFeed from "../components/LiveFeed.jsx";
import { filterPubs } from "../lib/core/pubFilters.js";
import { upcoming } from "../lib/core/events.js";
import { useGeolocation } from "../lib/hooks/useGeolocation.js";
import { useUrlParams } from "../lib/hooks/useUrlParam.js";
import Segmented from "../components/ui/Segmented.jsx";
import SearchCard from "../components/find/SearchCard.jsx";
import ResultRow from "../components/find/ResultRow.jsx";
import { usePageTitle } from "../lib/hooks/usePageTitle.js";

// How many results to list: the cheapest overall, or more once you've searched.
const RESULT_LIMIT = 30;
const FILTERED_RESULT_LIMIT = 100;
const CHEAPEST_NOW_LIMIT = 5;
const LATEST_REPORTS_LIMIT = 5;

const SUGGESTIONS = ["Guinness", "IPA", "Camden Hells", "London Pride", "Cider"];

export default function FindPage() {
  usePageTitle(null);
  const { livePubs, pubsStatus, pubsError, reloadPubs, feature, clock, api, extras } = useApp();
  const { locate, locating } = useGeolocation({ fallback: "Tap the map to pick a point instead." });
  const [filters, setFilters] = useState(() => new Set());
  const [sportPubIds, setSportPubIds] = useState(null);
  const filtersOn = feature("pub_filters");

  // "Sport on tonight" uses What's on events.
  useEffect(() => {
    if (!filtersOn || !filters.has("sport") || sportPubIds) return;
    api.listEvents().then(events => setSportPubIds(new Set(upcoming(events, { when: "tonight", categories: ["sports"], now: clock }).map(o => o.event.pub_id))))
      .catch(() => setSportPubIds(new Set()));
  }, [api, filtersOn, filters, sportPubIds, clock]);

  const pubs = useMemo(() => (filtersOn ? filterPubs(livePubs, filters, { now: clock, sportPubIds }) : livePubs), [livePubs, filtersOn, filters, clock, sportPubIds]);
  const toggleFilter = key => setFilters(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const navigate = useNavigate();
  const [params, updateParam] = useUrlParams();
  const query = params.get("q") || "";
  const category = CATEGORIES.includes(params.get("cat")) ? params.get("cat") : null;
  const [origin, setOrigin] = useState(null);
  const [sortBy, setSortBy] = useState("price");


  // Only confirmed prices (community, pub website, admin check) are listed; estimates stay on pub pages.
  const results = useMemo(
    () => searchDrinks(pubs, { query, category, origin, sortBy, realOnly: true }),
    [pubs, query, category, origin, sortBy]
  );
  const filtering = Boolean(query.trim() || category || (filtersOn && filters.size));
  const unconfirmed = useMemo(() => (filtering ? unconfirmedPubs(pubs, { query, category }) : []), [pubs, query, category, filtering]);
  const unconfirmedIds = useMemo(() => new Set(unconfirmed.map(u => u.pub.id)), [unconfirmed]);
  const pricesByPub = useMemo(() => (filtering ? cheapestPerPub(results) : null), [filtering, results]);
  const cheapestNow = useMemo(() => cheapestPints(livePubs, { limit: CHEAPEST_NOW_LIMIT, realOnly: true }), [livePubs]);

  function pickOrigin(point) {
    setOrigin(point);
    setSortBy("distance");
  }

  function locateMe() {
    // fromDevice: the map zooms to you and your nearest pubs, wherever you are.
    locate(point => pickOrigin({ ...point, fromDevice: true }));
  }

  return (
    <>
      <SearchCard query={query} category={category} updateParam={updateParam} filtersOn={filtersOn} filters={filters} toggleFilter={toggleFilter} />

      <div className="find-layout">
        <section className="card map-card" aria-labelledby="map-heading">
          <div className="section-header">
            <h2 id="map-heading" className="section-title">Map</h2>
            <button type="button" className="secondary-button small" onClick={locateMe} disabled={locating}>
              {locating ? "Finding you…" : "Use my location"}
            </button>
          </div>
          <p id="origin-help" className="muted small-text" aria-live="polite">
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
            <Segmented
              label="Sort results"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "price", label: "Cheapest" },
                { value: "distance", label: "Nearest", disabled: !origin, describedBy: origin ? undefined : "origin-help", title: origin ? "Sort by distance" : "Tap the map or use your location first" }
              ]}
            />
          </div>

          {pubsStatus === "loading" && <Loading label="Loading pubs and prices…" />}
          {pubsStatus === "error" && <ErrorState title="Couldn't load pubs and prices" message={pubsError} onRetry={() => reloadPubs()} />}
          {pubsStatus === "ready" && results.length === 0 && !filtering && (
            <EmptyState title="No confirmed prices yet">
              <p>Prices show here once someone reports what they paid. Open any pub and tap “Report a price”, or search for a drink to see where it's sold.</p>
            </EmptyState>
          )}
          {pubsStatus === "ready" && results.length === 0 && filtering && unconfirmed.length > 0 && (
            <p className="status-message">No confirmed prices for “{query || category || "these filters"}” yet. These pubs stock it: if you know the price, report it from the pub's page.</p>
          )}
          {pubsStatus === "ready" && results.length === 0 && filtering && unconfirmed.length === 0 && (
            <EmptyState title={`No pubs found for “${query || category || "these filters"}”`}>
              <p>Try one of these, or add the drink from a pub's page if you've seen it.</p>
              <div className="chip-row">
                {SUGGESTIONS.map(s => <button key={s} type="button" className="chip" onClick={() => { updateParam("q", s); }}>{s}</button>)}
              </div>
            </EmptyState>
          )}
          {pubsStatus === "ready" && results.length > 0 && (
            <ol className="result-list">
              {results.slice(0, filtering ? FILTERED_RESULT_LIMIT : RESULT_LIMIT).map(row => (
                <ResultRow key={row.drink.id} row={row} busy={extras.busy.get(row.pub.id) > 0} />
              ))}
            </ol>
          )}
          {!filtering && results.length > RESULT_LIMIT && <p className="muted small-text">Showing the {RESULT_LIMIT} cheapest. Search to narrow it down.</p>}
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
          {cheapestNow.length === 0 && <p className="muted">No confirmed prices yet. Open a pub and report what you paid.</p>}
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
          <LiveFeed limit={LATEST_REPORTS_LIMIT} compact />
        </section>
      </div>
    </>
  );
}
