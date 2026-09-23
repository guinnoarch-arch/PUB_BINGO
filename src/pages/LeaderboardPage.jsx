import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { CATEGORIES } from "../data/seedPubs.js";
import { cheapestPints } from "../lib/core/search.js";
import { PriceTag, SourceBadge, UpdatedAgo } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";

export default function LeaderboardPage() {
  const { pubs, pubsStatus, pubsError, reloadPubs, liveStatus } = useApp();
  const [category, setCategory] = useState(null);
  const [onePerPub, setOnePerPub] = useState(true);
  const rows = useMemo(() => cheapestPints(pubs, { limit: 20, category, onePerPub }), [pubs, category, onePerPub]);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Across all {pubs.length || ""} pubs</p>
          <h2>Cheapest pint right now</h2>
        </div>
        <span className={`live-pill ${liveStatus}`}>{liveStatus === "live" ? "● Live" : liveStatus === "offline" ? "Offline" : "Connecting…"}</span>
      </div>

      <section className="card">
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button type="button" className={`chip ${!category ? "active" : ""}`} aria-pressed={!category} onClick={() => setCategory(null)}>All</button>
          {CATEGORIES.filter(c => c !== "Other").map(c => (
            <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={onePerPub} onChange={e => setOnePerPub(e.target.checked)} />
          One drink per pub
        </label>
        <p className="muted small-text">Halves and other measures are ranked by their price per pint.</p>
      </section>

      <section className="card">
        {pubsStatus === "loading" && <Loading />}
        {pubsStatus === "error" && <ErrorState message={pubsError} onRetry={() => reloadPubs()} />}
        {pubsStatus === "ready" && rows.length === 0 && <EmptyState title="Nothing to rank yet" />}
        {rows.length > 0 && (
          <ol className="leaderboard">
            {rows.map((row, index) => (
              <li key={row.drink.id}>
                <span className={`rank ${index < 3 ? `top top-${index + 1}` : ""}`}>{index + 1}</span>
                <div className="result-main">
                  <Link to={`/pubs/${row.pub.id}`} className="result-link"><strong>{row.drink.name}</strong> <span className="muted">at {row.pub.name}</span></Link>
                  <span className="result-meta">
                    <span className="category-pill">{row.drink.category}</span>
                    <SourceBadge source={row.drink.source} url={row.drink.source_url} />
                    <UpdatedAgo value={row.drink.last_updated_at} />
                  </span>
                </div>
                <PriceTag price={row.price} measure={row.measure} pintPrice={row.pintPrice} large />
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
