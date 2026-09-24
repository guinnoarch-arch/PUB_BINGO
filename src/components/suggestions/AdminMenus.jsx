import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { timeAgo } from "../../lib/core/time.js";
import { EmptyState } from "../ui/States.jsx";
import { MENU_STATUS } from "./MenuSubmit.jsx";

export function formatSeenOn(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Private files: admins get a short-lived link. Photos show as a thumbnail.
export function SubmissionFile({ item, large = false }) {
  const { api } = useApp();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api.admin.menuSubmissionUrl(item.storage_path)
      .then(link => active && setUrl(link))
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [api, item.storage_path]);

  if (failed) return <span className="muted small-text">File not found</span>;
  if (!url) return <span className="muted small-text">Loading file…</span>;
  if (item.file_kind === "photo") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={`submission-thumb ${large ? "large" : ""}`}>
        <img src={url} alt={`Photo sent in for ${item.pub?.name || item.pub_name || "a pub"}`} />
      </a>
    );
  }
  return <a className="secondary-button small" href={url} target="_blank" rel="noreferrer">📄 Open PDF ↗</a>;
}

export function SubmissionDetails({ item }) {
  return (
    <div className="submission-details">
      <p>
        <strong>Seen on {formatSeenOn(item.seen_on)}</strong>
        <span className="muted small-text"> · sent by {item.sender?.username ? `@${item.sender.username}` : "someone"} {timeAgo(item.created_at)}</span>
      </p>
      {item.note && <p className="submission-note">“{item.note}”</p>}
    </div>
  );
}

export function SubmissionReview({ item, onChanged, compact = false }) {
  const { api, toast } = useApp();
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.admin_note || "");
  const [saving, setSaving] = useState(false);

  async function save(nextStatus = status) {
    setSaving(true);
    try {
      await api.admin.reviewMenuSubmission(item.id, { status: nextStatus, note });
      toast("Menu updated.", "success");
      onChanged();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this menu and its file?")) return;
    try {
      await api.admin.deleteMenuSubmission(item.id);
      toast("Menu deleted.", "success");
      onChanged();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  return (
    <div className="suggestion-admin">
      <label className="sr-only" htmlFor={`menu-status-${item.id}`}>Status</label>
      <select id={`menu-status-${item.id}`} value={status} onChange={e => setStatus(e.target.value)}>
        {Object.entries(MENU_STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
      </select>
      <label className="sr-only" htmlFor={`menu-reply-${item.id}`}>Reply to sender</label>
      <input id={`menu-reply-${item.id}`} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Reply (only the sender sees it)" />
      <button type="button" className="secondary-button small" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      {!compact && <button type="button" className="text-button danger" onClick={remove}>Delete</button>}
    </div>
  );
}

const FILTERS = [
  ["new", "New"],
  ["all", "All"]
];

export default function AdminMenus({ items, onChanged }) {
  const [filter, setFilter] = useState("new");
  const shown = items.filter(m => filter === "all" || m.status === "new");

  return (
    <>
      <p className="muted small-text">
        Menus and price photos sent in from Suggestions. Only admins can see them. Click <strong>Update prices</strong> to open the pub with the menu beside its drinks: prices you save there keep the date the menu was seen.
      </p>
      <div className="chip-row" role="group" aria-label="Filter menus">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={`chip ${filter === key ? "active" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={filter === "new" ? "Nothing new" : "No menus sent in yet"}>
          {filter === "new" && items.length ? "All menus have been dealt with." : "When someone sends a menu or price photo, it shows up here."}
        </EmptyState>
      ) : (
        <ul className="submission-list">
          {shown.map(item => {
            const status = MENU_STATUS[item.status] || MENU_STATUS.new;
            return (
              <li key={item.id} className="submission">
                <SubmissionFile item={item} />
                <div className="submission-body">
                  <div className="suggestion-meta">
                    <strong>{item.pub?.name || item.pub_name}</strong>
                    {!item.pub_id && <span className="status-pill hidden">Not listed</span>}
                    <span className={`suggestion-status ${status.tone}`}>{status.label}{item.prices_imported ? ` (${item.prices_imported} prices)` : ""}</span>
                  </div>
                  <SubmissionDetails item={item} />
                  <div className="row-actions wrap">
                    {item.pub_id
                      ? <Link className="primary-button small" to={`/admin/pubs/${item.pub_id}?submission=${item.id}`}>Update prices →</Link>
                      : <Link className="secondary-button small" to="/admin/pubs/new">+ Add this pub</Link>}
                  </div>
                  <SubmissionReview key={`${item.id}-${item.status}-${item.admin_note}`} item={item} onChanged={onChanged} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
