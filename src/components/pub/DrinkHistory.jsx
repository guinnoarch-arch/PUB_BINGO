import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { formatPrice } from "../../lib/core/prices.js";
import { priceHistoryStats } from "../../lib/core/search.js";
import { timeAgo } from "../../lib/core/time.js";
import { SourceBadge } from "../ui/Badges.jsx";
import { ErrorState, Loading } from "../ui/States.jsx";
import PriceChart from "../ui/PriceChart.jsx";
import ReporterName from "../ui/ReporterName.jsx";
import NotLaunched from "../ui/NotLaunched.jsx";
import { usePending } from "../../lib/usePending.js";

// Full price history for one drink: every report is kept so trends can be shown.
export default function DrinkHistory({ drink }) {
  const { api, changeVersion, isAdmin, feature, toast, notifyChange } = useApp();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const { run, isPending } = usePending();

  useEffect(() => {
    let active = true;
    api.getDrinkHistory(drink.id)
      .then(data => { if (active) { setRows(data); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load price history.")));
    return () => { active = false; };
  }, [api, drink.id, changeVersion, retry]);

  const toggleHidden = report => run(report.id, async () => {
    try {
      await api.admin.setReportHidden(report.id, !report.is_hidden);
      toast(report.is_hidden ? "Report restored." : "Report hidden. Current price recalculated.", "success");
      notifyChange();
    } catch (err) {
      toast(friendlyError(err, "Couldn't change the report. Try again."), "error");
    }
  });

  if (error) return <ErrorState title="Couldn't load the price history" message={error} onRetry={() => { setError(""); setRetry(r => r + 1); }} />;
  if (!rows) return <Loading label="Loading history…" />;
  const visible = rows.filter(r => !r.is_hidden);
  const stats = priceHistoryStats(visible);

  return (
    <div className="drink-history">
      {stats && (
        <p className="history-stats">
          {stats.count} report{stats.count === 1 ? "" : "s"} · low {formatPrice(stats.min)} · high {formatPrice(stats.max)} · average {formatPrice(stats.average)}
          {stats.count > 1 && stats.change !== 0 && (
            <span className={stats.change > 0 ? "trend up" : "trend down"}>
              {stats.change > 0 ? " ▲ " : " ▼ "}{formatPrice(Math.abs(stats.change))} since first report
            </span>
          )}
        </p>
      )}
      {feature("price_trends") && visible.length > 1 && (
        <div className="chart-block">
          <NotLaunched feature="price_trends" />
          <PriceChart points={visible.map(r => ({ at: r.reported_at, price: r.price }))} label={`${drink.name} price over time`} />
        </div>
      )}
      <ul>
        {rows.map(report => (
          <li key={report.id} className={report.is_hidden ? "hidden-report" : ""}>
            <strong>{formatPrice(report.price)}</strong>
            <SourceBadge source={report.source} url={report.source_url} />
            {report.kind === "confirm" && <span className="badge badge-confirm">Still right</span>}
            {report.receipt_path && feature("receipts") && <span className="badge badge-receipt" title="Backed by a receipt photo">🧾 Receipt</span>}
            {report.held && <span className="badge badge-held">Waiting for review</span>}
            <span className="muted">
              <ReporterName username={report.reporter_profile?.username} fallback={report.source === "seed" ? "starting estimate" : "someone"} /> · {timeAgo(report.reported_at)}
            </span>
            {report.note && report.kind !== "confirm" && <span className="feed-note">“{report.note}”</span>}
            {isAdmin && report.source === "community" && (
              <button type="button" className="text-button danger" disabled={isPending(report.id)} onClick={() => toggleHidden(report)}>{report.is_hidden ? "Unhide" : "Hide"}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
