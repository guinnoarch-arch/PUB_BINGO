import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import LiveFeed from "../components/LiveFeed.jsx";
import { needsChecking } from "../lib/core/checking.js";
import NotLaunched from "../components/ui/NotLaunched.jsx";

export default function FeedPage() {
  const { liveStatus, feature, pubs } = useApp();
  const toCheck = feature("needs_checking") ? needsChecking(pubs).filter(r => !r.estimate) : [];
  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Community</p>
          <h2>Latest price reports</h2>
        </div>
        <span className={`live-pill ${liveStatus}`} aria-live="polite">
          {liveStatus === "live" ? "● Live" : liveStatus === "offline" ? "Offline: refresh to update" : "Connecting…"}
        </span>
      </div>
      {feature("needs_checking") && (
        <section className="card check-teaser">
          <div className="section-header">
            <h2 className="section-title">🔎 Needs checking</h2>
            <NotLaunched feature="needs_checking" />
          </div>
          <p>{toCheck.length ? `${toCheck.length} price${toCheck.length === 1 ? " hasn't" : "s haven't"} been confirmed for over 60 days, plus the estimates.` : "Help replace the remaining estimates with real prices."} Out and about? Check a few.</p>
          <Link className="primary-button small" to="/needs-checking">See what needs checking</Link>
        </section>
      )}
      <section className="card">
        <LiveFeed limit={50} />
      </section>
    </>
  );
}
