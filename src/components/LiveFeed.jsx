import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { formatPrice } from "../lib/core/prices.js";
import { timeAgo } from "../lib/core/time.js";
import { EmptyState, ErrorState, Loading } from "./ui/States.jsx";

// The most recent community price reports. Refreshes when anyone reports a price.
export default function LiveFeed({ limit = 30, compact = false }) {
  const { api, changeVersion, isAdmin, toast, notifyChange } = useApp();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    api.listRecentReports(limit)
      .then(rows => { if (active) { setReports(rows); setStatus("ready"); } })
      .catch(err => { if (active) { setError(friendlyError(err, "Couldn't load the feed.")); setStatus(s => (s === "ready" ? "ready" : "error")); } });
    return () => { active = false; };
  }, [api, limit, changeVersion, retry]);

  async function hide(report) {
    try {
      await api.admin.setReportHidden(report.id, !report.is_hidden);
      toast(report.is_hidden ? "Report restored." : "Report hidden and price recalculated.", "success");
      notifyChange();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  if (status === "loading") return <Loading label="Loading reports…" />;
  if (status === "error") return <ErrorState message={error} onRetry={() => { setStatus("loading"); setRetry(r => r + 1); }} />;
  if (!reports.length) {
    return <EmptyState title="No community reports yet">Be the first: open a pub and report what you paid.</EmptyState>;
  }

  return (
    <ol className={`feed-list ${compact ? "compact" : ""}`}>
      {reports.map(report => (
        <li key={report.id} className={report.is_hidden ? "hidden-report" : ""}>
          <div className="feed-main">
            <span>
              <strong>{report.reporter_profile?.username ? `@${report.reporter_profile.username}` : "Someone"}</strong>
              {" paid "}
              <strong>{formatPrice(report.price)}</strong>
              {report.measure !== "pint" ? ` a ${report.measure}` : ""}
              {" for "}{report.drink_name}{" at "}
              <Link to={`/pubs/${report.pub_id}`}>{report.pub?.name || "a pub"}</Link>
            </span>
            {!compact && report.note && <span className="feed-note">“{report.note}”</span>}
          </div>
          <span className="feed-time">
            <time dateTime={report.reported_at}>{timeAgo(report.reported_at)}</time>
            {isAdmin && !compact && (
              <button type="button" className="text-button danger" onClick={() => hide(report)}>
                {report.is_hidden ? "Unhide" : "Hide"}
              </button>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
