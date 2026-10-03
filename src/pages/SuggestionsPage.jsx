import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { timeAgo } from "../lib/core/time.js";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import { MyMenus } from "../components/suggestions/MenuSubmit.jsx";
import SignInPrompt from "../components/SignInPrompt.jsx";
import SuggestionForm from "../components/suggestions/SuggestionForm.jsx";
import SuggestionAdminControls from "../components/suggestions/SuggestionAdminControls.jsx";
import { SUGGESTION_STATUS, SUGGESTION_TYPES } from "../data/suggestions.js";
import { ChevronDown, ChevronUp } from "lucide-react";

const FILTERS = [
  ["all", "All", () => true],
  ["open", "Open", s => ["new", "reviewed"].includes(s.status)],
  ["planned", "Planned", s => ["planned", "in_progress"].includes(s.status)],
  ["done", "Done", s => s.status === "done"],
  ["mine", "Mine", s => s.is_mine]
];

export default function SuggestionsPage() {
  const { api, userId, isAdmin, authReady, toast } = useApp();
  const [params] = useSearchParams();
  const menuPubId = params.get("menu");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);
  const [voting, setVoting] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    api.listSuggestions()
      .then(rows => { if (active) { setItems(rows); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load suggestions.")));
    return () => { active = false; };
  }, [api, userId, reloadKey]);

  async function vote(item, value) {
    if (!userId) { toast("Sign in to vote."); return; }
    if (voting.has(item.id)) return;
    setVoting(prev => new Set(prev).add(item.id));
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
      toast(friendlyError(err, "Couldn't save your vote. Try again."), "error");
    } finally {
      setVoting(prev => { const next = new Set(prev); next.delete(item.id); return next; });
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
          <h1>Suggestions</h1>
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
          <SignInPrompt inline>Sign in to send suggestions, menus and price photos, and to vote. Ideas, pubs to add, or anything that's wrong: it all helps.</SignInPrompt>
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

        {error && <ErrorState title="Couldn't load suggestions" message={error} onRetry={reload} />}
        {!error && items === null && <Loading label="Loading suggestions…" />}
        {!error && items !== null && shown.length === 0 && (
          <EmptyState title={items.length ? "Nothing matches this filter" : "No suggestions yet"}>
            {items.length ? "Choose another filter above." : "Ideas, pubs to add, or anything that's wrong: send one with the form above."}
          </EmptyState>
        )}
        <ul className="suggestion-list">
          {shown.map(item => {
            const type = SUGGESTION_TYPES.find(t => t.key === item.category) || SUGGESTION_TYPES[0];
            const status = SUGGESTION_STATUS[item.status] || SUGGESTION_STATUS.new;
            const score = item.up_votes - item.down_votes;
            return (
              <li key={item.id} className="suggestion">
                <div className="vote-box" role="group" aria-label={`Votes: ${score}`}>
                  <button type="button" className={`vote-button ${item.my_vote === 1 ? "active" : ""}`} aria-pressed={item.my_vote === 1} aria-label="Vote up" disabled={voting.has(item.id)} onClick={() => vote(item, 1)}><ChevronUp aria-hidden="true" /></button>
                  <strong>{score}</strong>
                  <button type="button" className={`vote-button ${item.my_vote === -1 ? "active" : ""}`} aria-pressed={item.my_vote === -1} aria-label="Vote down" disabled={voting.has(item.id)} onClick={() => vote(item, -1)}><ChevronDown aria-hidden="true" /></button>
                </div>
                <div className="suggestion-body">
                  <div className="suggestion-meta">
                    <span className="category-pill">{type.label}</span>
                    <span className={`suggestion-status ${status.tone}`}>{status.label}</span>
                    {item.is_mine && <span className="muted small-text">Yours</span>}
                  </div>
                  <p className="suggestion-message">{item.message}</p>
                  <span className="muted small-text">{item.username ? `@${item.username}` : "Someone"} · {timeAgo(item.created_at)}</span>
                  {item.admin_note && (
                    <div className="suggestion-reply"><strong>Reply from Pub Bingo:</strong> {item.admin_note}</div>
                  )}
                  {isAdmin && <SuggestionAdminControls key={`${item.id}-${item.status}-${item.admin_note}`} item={item} onChanged={reload} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
