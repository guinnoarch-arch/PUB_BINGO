import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { formatPrice } from "../../lib/core/prices.js";
import { timeAgo } from "../../lib/core/time.js";
import NotLaunched from "../ui/NotLaunched.jsx";

export function ReceiptLink({ path }) {
  const { api } = useApp();
  const [url, setUrl] = useState("");
  async function open() {
    try {
      const link = url || await api.admin.receiptUrl(path);
      setUrl(link);
      window.open(link, "_blank", "noopener");
    } catch { /* shown as unavailable */ }
  }
  return <button type="button" className="text-button" onClick={open}>🧾 View receipt</button>;
}

// Prices that were far from the current one, from reporters who aren't trusted yet.
export default function HeldReports() {
  const { api, changeVersion, toast, notifyChange } = useApp();
  const [rows, setRows] = useState(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.admin.listHeldReports().then(r => active && setRows(r)).catch(() => active && setRows([]));
    return () => { active = false; };
  }, [api, changeVersion, key]);

  async function review(row, approve) {
    try {
      await api.admin.reviewHeldReport(row.id, approve);
      toast(approve ? "Approved: the price is live." : "Rejected: it stays hidden.", "success");
      notifyChange();
      setKey(k => k + 1);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  return (
    <section className="card" aria-labelledby="held-heading">
      <div className="section-header">
        <h2 id="held-heading" className="section-title">Waiting for review {rows?.length ? `(${rows.length})` : ""}</h2>
        <NotLaunched feature="trusted_reporters" />
      </div>
      <p className="muted small-text">When “Trusted reporters & review” is live, a price more than 40% away from the current one, from someone who isn't trusted yet, waits here instead of going live.</p>
      {rows === null ? null : rows.length === 0 ? <p className="muted">Nothing waiting.</p> : (
        <ul className="held-list">
          {rows.map(row => (
            <li key={row.id}>
              <span>
                <strong>{row.reporter_profile?.username ? `@${row.reporter_profile.username}` : "Someone"}</strong>
                {" says "}<strong>{formatPrice(row.price)}</strong>{" for "}{row.drink_name}{" at "}
                <Link to={`/pubs/${row.pub_id}`}>{row.pub?.name || "a pub"}</Link>
                <span className="muted small-text"> · now {row.drink?.current_price != null ? formatPrice(row.drink.current_price) : "–"} · {timeAgo(row.reported_at)}</span>
                {row.note && <span className="feed-note"> “{row.note}”</span>}
              </span>
              <span className="row-actions">
                {row.receipt_path && <ReceiptLink path={row.receipt_path} />}
                <button type="button" className="secondary-button small" onClick={() => review(row, true)}>Approve</button>
                <button type="button" className="text-button danger" onClick={() => review(row, false)}>Reject</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
