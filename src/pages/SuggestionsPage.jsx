import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { timeAgo } from "../lib/core/time.js";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import { MenuSubmitForm, MyMenus } from "../components/suggestions/MenuSubmit.jsx";

export const SUGGESTION_TYPES = [
  { key: "idea", label: "Idea", icon: "💡", placeholder: "What would make Pub Bingo better?" },
  { key: "pub", label: "Add a pub", icon: "🍺", placeholder: "Which pub, and where? Anything we should know (website, prices, events)?" },
  { key: "problem", label: "Something's wrong", icon: "⚠️", placeholder: "What went wrong, or which price/detail is out of date?" },
  { key: "other", label: "Other", icon: "💬", placeholder: "Anything else on your mind?" }
];
const STATUS = {
  new: { label: "New", tone: "new" },
  reviewed: { label: "Seen", tone: "seen" },
  planned: { label: "Planned", tone: "planned" },
  in_progress: { label: "In progress", tone: "planned" },
  done: { label: "Done", tone: "done" },
  rejected: { label: "Not doing", tone: "rejected" }
};
const FILTERS = [
  ["all", "All", () => true],
  ["open", "Open", s => ["new", "reviewed"].includes(s.status)],
  ["planned", "Planned", s => ["planned", "in_progress"].includes(s.status)],
  ["done", "Done", s => s.status === "done"],
  ["mine", "Mine", s => s.is_mine]
];
const MAX = 1000;

// Menus go privately to admins, so they're a separate form rather than a public suggestion.
const MENU_TYPE = { key: "menu", label: "Menu or price", icon: "📄" };

function SuggestionForm({ onSent, initialType = "idea", initialPubId = "" }) {
  const { api, toast } = useApp();
  const [type, setType] = useState(initialType);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const current = SUGGESTION_TYPES.find(t => t.key === type) || SUGGESTION_TYPES[0];

  async function send(event) {
    event.preventDefault();
    setError("");
    if (message.trim().length < 3) { setError("Write a bit more first."); return; }
    setSending(true);
    try {
      await api.submitSuggestion(type, message);
      setMessage("");
      toast("Thanks! Your suggestion has been sent.", "success");
      onSent();
    } catch (err) {
      setError(friendlyError(err, "Couldn't send your suggestion."));
    } finally {
      setSending(false);
    }
  }

  const chips = (
    <div className="chip-row" role="radiogroup" aria-label="Type of suggestion">
      {[...SUGGESTION_TYPES, MENU_TYPE].map(t => (
        <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className={`chip ${type === t.key ? "active" : ""}`} onClick={() => { setType(t.key); setError(""); }}>
          <span aria-hidden="true">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );

  if (type === MENU_TYPE.key) {
    return <div className="suggestion-form">{chips}<MenuSubmitForm initialPubId={initialPubId} onSent={onSent} /></div>;
  }

  return (
    <form className="suggestion-form" onSubmit={send} noValidate>
      {chips}
      <label htmlFor="suggestion-text" className="sr-only">Your suggestion</label>
      <textarea id="suggestion-text" rows={4} maxLength={MAX} value={message} onChange={e => setMessage(e.target.value)} placeholder={current.placeholder}
        aria-invalid={Boolean(error)} aria-describedby="suggestion-help" />
      <div className="suggestion-form-footer">
        <span id="suggestion-help" className="muted small-text">{message.length}/{MAX} · Everyone can see suggestions and vote on them.</span>
        <button type="submit" className="primary-button" disabled={sending}>{sending ? "Sending…" : "Send suggestion"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function AdminControls({ item, onChanged }) {
  const { api, toast } = useApp();
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.admin_note || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.admin.updateSuggestion(item.id, status, note);
      toast("Suggestion updated.", "success");
      onChanged();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this suggestion?")) return;
    try {
      await api.admin.deleteSuggestion(item.id);
      toast("Suggestion deleted.", "success");
      onChanged();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  return (
    <div className="suggestion-admin">
      <label className="sr-only" htmlFor={`status-${item.id}`}>Status</label>
      <select id={`status-${item.id}`} value={status} onChange={e => setStatus(e.target.value)}>
        {Object.entries(STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
      </select>
      <label className="sr-only" htmlFor={`note-${item.id}`}>Reply</label>
      <input id={`note-${item.id}`} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="Reply (shown to everyone)" />
      <button type="button" className="secondary-button small" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      <button type="button" className="text-button danger" onClick={remove}>Delete</button>
    </div>
  );
}

export default function SuggestionsPage() {
  const { api, userId, isAdmin, authReady, toast } = useApp();
  const location = useLocation();
  const [params] = useSearchParams();
  const menuPubId = params.get("menu");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  useEffect(() => {
    let active = true;
    api.listSuggestions()
      .then(rows => { if (active) { setItems(rows); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load suggestions.")));
    return () => { active = false; };
  }, [api, userId, reloadKey]);

  async function vote(item, value) {
    if (!userId) { toast("Sign in to vote."); return; }
    const next = item.my_vote === value ? 0 : value;
    // Show the vote straight away; the list reloads from the server afterwards.
    setItems(prev => prev.map(s => (s.id !== item.id ? s : {
      ...s,
      my_vote: next,
      up_votes: s.up_votes - (s.my_vote === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      down_votes: s.down_votes - (s.my_vote === -1 ? 1 : 0) + (next === -1 ? 1 : 0)
    })));
    try {
      await api.voteSuggestion(item.id, next);
    } catch (err) {
      toast(friendlyError(err, "Couldn't save your vote."), "error");
    }
    reload();
  }

  const shown = useMemo(() => {
    const test = (FILTERS.find(([key]) => key === filter) || FILTERS[0])[2];
    return (items || []).filter(test);
  }, [items, filter]);
  const newCount = (items || []).filter(s => s.status === "new").length;

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Help shape Pub Bingo</p>
          <h2>Suggestions</h2>
        </div>
        {isAdmin && newCount > 0 && <span className="pill warn">{newCount} new</span>}
      </div>

      <section className="card" aria-labelledby="suggest-heading">
        <h2 id="suggest-heading" className="section-title">Send a suggestion</h2>
        {!authReady ? <Loading /> : userId ? (
          <>
            <SuggestionForm onSent={reload} initialType={menuPubId !== null ? "menu" : "idea"} initialPubId={menuPubId || ""} />
            <MyMenus reloadKey={reloadKey} />
          </>
        ) : (
          <div className="sign-in-prompt">
            <p className="muted">Sign in to send suggestions, menus and price photos, and to vote. Ideas, pubs to add, or anything that's wrong: it all helps.</p>
            <Link className="primary-button" to={`/account?next=${encodeURIComponent(location.pathname + location.search)}`}>Sign in or create account</Link>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="suggestions-list-heading">
        <div className="section-header">
          <h2 id="suggestions-list-heading" className="section-title">What people are asking for</h2>
        </div>
        <div className="chip-row" role="group" aria-label="Filter suggestions">
          {FILTERS.filter(([key]) => key !== "mine" || userId).map(([key, label]) => (
            <button key={key} type="button" className={`chip ${filter === key ? "active" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>

        {error && <ErrorState message={error} onRetry={reload} />}
        {!error && items === null && <Loading label="Loading suggestions…" />}
        {!error && items !== null && shown.length === 0 && (
          <EmptyState title={items.length ? "Nothing here yet" : "No suggestions yet"}>
            {items.length ? "Try another filter." : "Be the first to suggest something!"}
          </EmptyState>
        )}
        <ul className="suggestion-list">
          {shown.map(item => {
            const type = SUGGESTION_TYPES.find(t => t.key === item.category) || SUGGESTION_TYPES[0];
            const status = STATUS[item.status] || STATUS.new;
            const score = item.up_votes - item.down_votes;
            return (
              <li key={item.id} className="suggestion">
                <div className="vote-box" role="group" aria-label={`Votes: ${score}`}>
                  <button type="button" className={`vote-button ${item.my_vote === 1 ? "active" : ""}`} aria-pressed={item.my_vote === 1} aria-label="Vote up" onClick={() => vote(item, 1)}>▲</button>
                  <strong>{score}</strong>
                  <button type="button" className={`vote-button ${item.my_vote === -1 ? "active down" : ""}`} aria-pressed={item.my_vote === -1} aria-label="Vote down" onClick={() => vote(item, -1)}>▼</button>
                </div>
                <div className="suggestion-body">
                  <div className="suggestion-meta">
                    <span className="category-pill"><span aria-hidden="true">{type.icon}</span> {type.label}</span>
                    <span className={`suggestion-status ${status.tone}`}>{status.label}</span>
                    {item.is_mine && <span className="muted small-text">Yours</span>}
                  </div>
                  <p className="suggestion-message">{item.message}</p>
                  <span className="muted small-text">{item.username ? `@${item.username}` : "Someone"} · {timeAgo(item.created_at)}</span>
                  {item.admin_note && (
                    <div className="suggestion-reply"><strong>Reply from Pub Bingo:</strong> {item.admin_note}</div>
                  )}
                  {isAdmin && <AdminControls key={`${item.id}-${item.status}-${item.admin_note}`} item={item} onChanged={reload} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
