import { useApp } from "../lib/AppContext.jsx";
import LiveFeed from "../components/LiveFeed.jsx";

export default function FeedPage() {
  const { liveStatus } = useApp();
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
      <section className="card">
        <LiveFeed limit={50} />
      </section>
    </>
  );
}
