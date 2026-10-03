import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUrlParams } from "../lib/hooks/useUrlParam.js";
import { useApp } from "../lib/AppContext.jsx";
import { CATEGORIES } from "../data/seedPubs.js";
import { cheapestPints } from "../lib/core/search.js";
import { PriceTag, SourceBadge, UpdatedAgo } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import DealNote from "../components/features/DealNote.jsx";
import TopReporters from "../components/features/TopReporters.jsx";
import AreaAverages from "../components/features/AreaAverages.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import Segmented from "../components/ui/Segmented.jsx";

const LEADERBOARD_SIZE = 20;

export default function LeaderboardPage() {
  const { livePubs: pubs, pubsStatus, pubsError, reloadPubs, liveStatus, feature } = useApp();
  // The tab and category live in the URL, so refresh and back keep them.
  const [params, updateParam] = useUrlParams();
  const tab = params.get("view") === "people" ? "people" : "pints";
  const category = CATEGORIES.includes(params.get("cat")) ? params.get("cat") : null;
  const setTab = value => updateParam("view", value === "people" ? "people" : "");
  const setCategory = value => updateParam("cat", value || "");
  const [onePerPub, setOnePerPub] = useState(true);
  // Confirmed prices only: starting estimates never appear on the leaderboard.
  const rows = useMemo(() => cheapestPints(pubs, { limit: LEADERBOARD_SIZE, category, onePerPub, realOnly: true }), [pubs, category, onePerPub]);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{pubs.length ? `Across all ${pubs.length} pubs` : "Across all pubs"}</p>
          <h2>{tab === "people" ? "Top reporters" : "Cheapest pint right now"}</h2>
        </div>
        <span className={`live-pill ${liveStatus}`}>{liveStatus === "live" ? "● Live" : liveStatus === "offline" ? "Offline" : "Connecting…"}</span>
      </div>
      {feature("top_reporters") && (
        <div className="tab-row">
          <Segmented label="Leaderboards" value={tab} onChange={setTab} options={[{ value: "pints", label: "Cheapest pints" }, { value: "people", label: "Top reporters" }]} />
          <NotLaunched feature="top_reporters" />
        </div>
      )}
      {tab === "people" && feature("top_reporters") ? <section className="card"><TopReporters /></section> : (<>

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
        <p className="muted small-text">Only confirmed prices count (reported by visitors, taken from a pub's website, or checked by us). Halves are ranked by their price per pint.{feature("happy_hours") ? " Happy-hour prices count while they're on." : ""}</p>
      </section>

      <section className="card">
        {pubsStatus === "loading" && <Loading />}
        {pubsStatus === "error" && <ErrorState title="Couldn't load pubs and prices" message={pubsError} onRetry={() => reloadPubs()} />}
        {pubsStatus === "ready" && rows.length === 0 && (
          <EmptyState title="No confirmed prices yet">
            {category ? `Nobody has confirmed a ${category} price yet. ` : ""}Open a pub and report what you paid to get on the board.
          </EmptyState>
        )}
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
                    <DealNote drink={row.drink} />
                  </span>
                </div>
                <PriceTag price={row.price} measure={row.measure} volumeMl={row.volumeMl} pintPrice={row.pintPrice} large />
              </li>
            ))}
          </ol>
        )}
      </section>
      {feature("price_trends") && (
        <section className="card" aria-labelledby="areas-heading">
          <div className="section-header">
            <h2 id="areas-heading" className="section-title">Average pint by area</h2>
            <NotLaunched feature="price_trends" />
          </div>
          <AreaAverages pubs={pubs} />
        </section>
      )}
      </>)}
    </>
  );
}
