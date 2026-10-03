import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { londonNow } from "../../lib/core/events.js";
import { EmptyState, ErrorState, Loading } from "../ui/States.jsx";
import ReporterName from "../ui/ReporterName.jsx";
import { MENU_USED_POINTS, reporterPoints } from "../../lib/core/badges.js";
import Segmented from "../ui/Segmented.jsx";

const TOP_REPORTERS_SHOWN = 20;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function TopReporters() {
  const { api, changeVersion } = useApp();
  const [range, setRange] = useState("month");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const now = londonNow();
  const monthStart = `${now.dateKey.slice(0, 7)}-01T00:00:00Z`;

  useEffect(() => {
    let active = true;
    api.communityStats(range === "month" ? monthStart : null)
      .then(r => { if (active) { setRows(r); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load the reporters.")));
    return () => { active = false; };
  }, [api, range, monthStart, changeVersion, retry]);

  return (
    <>
      <Segmented label="Time range" value={range} onChange={setRange} options={[{ value: "month", label: MONTHS[Number(now.dateKey.slice(5, 7)) - 1] }, { value: "all", label: "All time" }]} />
      {error && <ErrorState title="Couldn't load the top reporters" message={error} onRetry={() => { setError(""); setRows(null); setRetry(r => r + 1); }} />}
      {!error && rows === null && <Loading />}
      {rows && rows.length === 0 && <EmptyState title="No reporters yet">Report a price to top the board.</EmptyState>}
      {rows && rows.length > 0 && (
        <ol className="leaderboard">
          {rows.slice(0, TOP_REPORTERS_SHOWN).map((r, i) => (
            <li key={r.username}>
              <span className={`rank ${i < 3 ? `top top-${i + 1}` : ""}`}>{i + 1}</span>
              <div className="result-main">
                <strong><ReporterName username={r.username} /></strong>
                <span className="muted small-text">
                  {r.reports} report{r.reports === 1 ? "" : "s"} · {r.confirms} check{r.confirms === 1 ? "" : "s"}
                  {r.menus_used ? ` · ${r.menus_used} menu${r.menus_used === 1 ? "" : "s"}` : ""}{r.receipts ? ` · ${r.receipts} 🧾` : ""}
                </span>
              </div>
              <span className="price-tag large"><strong>{reporterPoints(r)}</strong><small> pts</small></span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small-text">1 point per price report or “still right” check, {MENU_USED_POINTS} per menu that gets used.</p>
    </>
  );
}
