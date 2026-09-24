import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { CHECK_AFTER_DAYS, groupByPub, needsChecking } from "../lib/core/checking.js";
import { formatPrice, measureLabel } from "../lib/core/prices.js";
import { timeAgo } from "../lib/core/time.js";
import { AREAS } from "../data/seedPubs.js";
import FeaturePage from "../components/features/FeaturePage.jsx";
import StillRightButton from "../components/features/StillRightButton.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import { EmptyState, Loading } from "../components/ui/States.jsx";

function NeedsChecking() {
  const { pubs, pubsStatus } = useApp();
  const [area, setArea] = useState("");
  const [showEstimates, setShowEstimates] = useState(true);
  const rows = useMemo(() => needsChecking(pubs).filter(r => (!area || r.pub.area === area) && (showEstimates || !r.estimate)), [pubs, area, showEstimates]);
  const groups = groupByPub(rows);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Help keep prices real</p>
          <h2>Needs checking</h2>
        </div>
        <NotLaunched feature="needs_checking" />
      </div>
      <section className="card">
        <p className="muted">Prices that are only estimates, or haven't been confirmed for over {CHECK_AFTER_DAYS} days. At one of these pubs? Tap <strong>Still right?</strong> if the price matches, or <strong>Update</strong> if it's changed.</p>
        <div className="chip-row" role="group" aria-label="Filter by area">
          <button type="button" className={`chip ${!area ? "active" : ""}`} aria-pressed={!area} onClick={() => setArea("")}>All areas</button>
          {AREAS.map(a => <button key={a} type="button" className={`chip ${area === a ? "active" : ""}`} aria-pressed={area === a} onClick={() => setArea(a)}>{a}</button>)}
        </div>
        <label className="checkbox-label"><input type="checkbox" checked={showEstimates} onChange={e => setShowEstimates(e.target.checked)} /> Include estimates</label>
      </section>
      {pubsStatus === "loading" ? <Loading /> : groups.length === 0 ? (
        <section className="card"><EmptyState title="All checked!">Every price here has been confirmed recently. 🍻</EmptyState></section>
      ) : groups.map(({ pub, rows: items }) => (
        <section key={pub.id} className="card check-group">
          <div className="section-header">
            <h3 className="section-title"><Link to={`/pubs/${pub.id}`}>{pub.name}</Link> <span className="muted small-text">{pub.area}</span></h3>
            <span className="muted small-text">{items.length} to check</span>
          </div>
          <ul className="check-list">
            {items.map(({ drink, estimate }) => (
              <li key={drink.id}>
                <span>
                  <strong>{drink.name}</strong>{drink.measure !== "pint" ? <span className="muted"> ({measureLabel(drink.measure, drink.volume_ml)})</span> : null}
                  {" "}{formatPrice(drink.current_price)}{" "}
                  {estimate ? <span className="badge badge-seed">Estimate</span> : <span className="updated stale">last confirmed {timeAgo(drink.last_updated_at)}</span>}
                </span>
                <span className="row-actions">
                  <StillRightButton drink={drink} />
                  <Link className="secondary-button small" to={`/pubs/${pub.id}#report`}>Update</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function NeedsCheckingPage() {
  return <FeaturePage feature="needs_checking"><NeedsChecking /></FeaturePage>;
}
