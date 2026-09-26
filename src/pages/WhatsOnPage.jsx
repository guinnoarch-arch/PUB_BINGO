import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { EVENT_CATEGORIES, FEATURES } from "../data/features.js";
import { WHEN_OPTIONS, groupByDay, londonNow, pubsWithFeatures, upcoming } from "../lib/core/events.js";
import EventItem from "../components/events/EventItem.jsx";
import FavouriteButton from "../components/ui/FavouriteButton.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";

const listParam = value => (value ? value.split(",").filter(Boolean) : []);

export default function WhatsOnPage() {
  const { api, pubs, pubsById, pubsStatus, changeVersion } = useApp();
  const [params, setParams] = useSearchParams();
  const when = WHEN_OPTIONS.some(o => o.key === params.get("when")) ? params.get("when") : "week";
  const types = listParam(params.get("type")).filter(t => EVENT_CATEGORIES.some(c => c.key === t));
  const features = listParam(params.get("has")).filter(t => FEATURES.some(f => f.tag === t));
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const update = (key, values) => {
    const next = new URLSearchParams(params);
    const value = Array.isArray(values) ? values.join(",") : values;
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const toggle = (key, list, item) => update(key, list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  useEffect(() => {
    let active = true;
    api.listEvents()
      .then(rows => { if (active) { setEvents(rows); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load what's on.")));
    return () => { active = false; };
  }, [api, changeVersion, retry]);

  const now = londonNow();
  // Only events at pubs the public can see (hidden pubs aren't in the pubs list).
  const visibleEvents = useMemo(() => (events || []).filter(e => pubsById[e.pub_id]), [events, pubsById]);
  const featurePubIds = useMemo(() => (features.length ? new Set(pubsWithFeatures(pubs, features).map(p => p.id)) : null), [pubs, features]);
  const list = useMemo(
    () => upcoming(visibleEvents, { when, categories: types, pubIds: featurePubIds, now }),
    [visibleEvents, when, types.join(), featurePubIds, now.dateKey, Math.floor(now.minutes / 15)]
  );
  const groups = groupByDay(list, now.dateKey);
  const matchingPubs = pubsWithFeatures(pubs, features);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">London</p>
          <h2>What's on</h2>
        </div>
      </div>

      <section className="card" aria-labelledby="features-heading">
        <h2 id="features-heading" className="section-title">Find a pub with…</h2>
        <div className="chip-row scroll-row" role="group" aria-label="Pub features">
          {FEATURES.map(f => (
            <button key={f.tag} type="button" className={`chip ${features.includes(f.tag) ? "active" : ""}`} aria-pressed={features.includes(f.tag)} onClick={() => toggle("has", features, f.tag)}>
              <span aria-hidden="true">{f.icon}</span> {f.label}
            </button>
          ))}
        </div>
        {features.length > 0 && pubsStatus === "ready" && (
          matchingPubs.length ? (
            <ul className="feature-pubs">
              {matchingPubs.map(pub => (
                <li key={pub.id}>
                  <Link to={`/pubs/${pub.id}`} className="result-link"><strong>{pub.name}</strong> <span className="muted">· {pub.area}</span></Link>
                  <span className="feature-icons" aria-label="Features">
                    {FEATURES.filter(f => (pub.tags || []).includes(f.tag)).map(f => <span key={f.tag} title={f.label}>{f.icon}</span>)}
                  </span>
                  <FavouriteButton pub={pub} compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-message">No pubs match all of those yet. Try fewer features. Pub details are still being checked, so some may be missing.</p>
          )
        )}
        {features.length > 0 && <p className="muted small-text">The event list below only shows these pubs too. <button type="button" className="text-button" onClick={() => update("has", [])}>Clear features</button></p>}
      </section>

      <section className="card" aria-labelledby="events-heading">
        <div className="section-header">
          <h2 id="events-heading" className="section-title">Events</h2>
          <div className="segmented" role="group" aria-label="When">
            {WHEN_OPTIONS.map(o => (
              <button key={o.key} type="button" className={when === o.key ? "active" : ""} aria-pressed={when === o.key} onClick={() => update("when", o.key === "week" ? "" : o.key)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="chip-row scroll-row" role="group" aria-label="Event type">
          <button type="button" className={`chip ${!types.length ? "active" : ""}`} aria-pressed={!types.length} onClick={() => update("type", [])}>All</button>
          {EVENT_CATEGORIES.filter(c => c.key !== "other").map(c => (
            <button key={c.key} type="button" className={`chip ${types.includes(c.key) ? "active" : ""}`} aria-pressed={types.includes(c.key)} onClick={() => toggle("type", types, c.key)}>
              <span aria-hidden="true">{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

        {error && <ErrorState message={error} onRetry={() => setRetry(r => r + 1)} />}
        {!error && (events === null || pubsStatus === "loading") && <Loading label="Loading what's on…" />}
        {!error && events !== null && pubsStatus === "ready" && groups.length === 0 && (
          <EmptyState title="Nothing listed for then yet">
            {visibleEvents.length ? "Try another day or fewer filters." : "Events are being checked and added. Check back soon."}
          </EmptyState>
        )}
        {groups.map(group => (
          <div key={group.dateKey} className="event-day">
            <h3 className="event-day-label">{group.label}</h3>
            <ul className="event-list">
              {group.items.map(o => (
                <li key={`${o.event.id}-${o.dateKey}`}><EventItem event={o.event} pub={pubsById[o.event.pub_id]} dated /></li>
              ))}
            </ul>
          </div>
        ))}
        <p className="muted small-text">Times are London time. Events can change, so check with the pub before you go.</p>
      </section>
    </>
  );
}
