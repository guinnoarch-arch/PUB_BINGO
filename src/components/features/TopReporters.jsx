import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { londonNow } from "../../lib/core/events.js";
import { EmptyState, ErrorState, Loading } from "../ui/States.jsx";
import ReporterName from "../ui/ReporterName.jsx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function TopReporters() {
  const { api, changeVersion } = useApp();
  const [range, setRange] = useState("month");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const now = londonNow();
  const monthStart = `${now.dateKey.slice(0, 7)}-01T00:00:00Z`;

  useEffect(() => {
    let active = true;
    api.communityStats(range === "month" ? monthStart : null)
      .then(r => { if (active) { setRows(r); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load the reporters.")));
    return () => { active = false; };
  }, [api, range, monthStart, changeVersion]);

  return (
    <>
      <div className="segmented" role="group" aria-label="Time range">
        <button type="button" className={range === "month" ? "active" : ""} aria-pressed={range === "month"} onClick={() => setRange("month")}>{MONTHS[Number(now.dateKey.slice(5, 7)) - 1]}</button>
        <button type="button" className={range === "all" ? "active" : ""} aria-pressed={range === "all"} onClick={() => setRange("all")}>All time</button>
      </div>
      {error && <ErrorState message={error} />}
      {!error && rows === null && <Loading />}
      {rows && rows.length === 0 && <EmptyState title="No reporters yet">Report a price to top the board.</EmptyState>}
      {rows && rows.length > 0 && (
        <ol className="leaderboard">
          {rows.slice(0, 20).map((r, i) => (
            <li key={r.username}>
              <span className={`rank ${i < 3 ? `top top-${i + 1}` : ""}`}>{i + 1}</span>
              <div className="result-main">
                <strong><ReporterName username={r.username} /></strong>
                <span className="muted small-text">
                  {r.reports} report{r.reports === 1 ? "" : "s"} · {r.confirms} check{r.confirms === 1 ? "" : "s"}
                  {r.menus_used ? ` · ${r.menus_used} menu${r.menus_used === 1 ? "" : "s"}` : ""}{r.receipts ? ` · ${r.receipts} 🧾` : ""}
                </span>
              </div>
              <span className="price-tag large"><strong>{r.reports + r.confirms + 3 * r.menus_used}</strong><small> pts</small></span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small-text">1 point per price report or “still right” check, 3 per menu that gets used.</p>
    </>
  );
}
