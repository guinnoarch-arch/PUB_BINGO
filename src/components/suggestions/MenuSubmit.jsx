import { useEffect, useRef, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { londonToday, validateMenuSubmissionFile, validateSeenOn } from "../../lib/api/menuFiles.js";
import { formatDate } from "../../lib/core/events.js";
import { timeAgo } from "../../lib/core/time.js";

const OTHER = "__other__";
export const MENU_STATUS = {
  new: { label: "Waiting for admin", tone: "new" },
  used: { label: "Used to update prices", tone: "done" },
  not_used: { label: "Not used", tone: "rejected" }
};

// Send a menu (PDF) or a photo of a menu, price board or single drink's price. Only admins see it.
export function MenuSubmitForm({ onSent, initialPubId = "" }) {
  const { api, userId, pubs, toast } = useApp();
  const fileRef = useRef(null);
  const today = londonToday();
  const [pubId, setPubId] = useState("");
  const [pubName, setPubName] = useState("");
  const [seenOn, setSeenOn] = useState(today);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const sortedPubs = [...(pubs || [])].sort((a, b) => a.name.localeCompare(b.name));

  // Coming from a pub page ("Send us the menu"): pick that pub once the list has loaded.
  useEffect(() => {
    if (initialPubId && (pubs || []).some(p => p.id === initialPubId)) setPubId(prev => prev || initialPubId);
  }, [initialPubId, pubs]);

  async function send(event) {
    event.preventDefault();
    setError("");
    const file = fileRef.current?.files?.[0];
    if (!pubId) { setError("Pick the pub."); return; }
    if (pubId === OTHER && pubName.trim().length < 2) { setError("Type the pub's name."); return; }
    const dateProblem = validateSeenOn(seenOn, today);
    if (dateProblem) { setError(dateProblem); return; }
    const fileProblem = validateMenuSubmissionFile(file);
    if (fileProblem) { setError(fileProblem); return; }
    setSending(true);
    try {
      await api.submitMenu(userId, {
        pubId: pubId === OTHER ? null : pubId,
        pubName: pubId === OTHER ? pubName.trim() : null,
        seenOn,
        note: note.trim(),
        file
      });
      toast("Thanks! Your menu has been sent to the Pub Bingo admins.", "success");
      setNote("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onSent();
    } catch (err) {
      setError(friendlyError(err, "Couldn't send the menu."));
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="suggestion-form menu-submit-form" onSubmit={send} noValidate>
      <p className="muted small-text">
        Send a PDF menu, or a photo of a menu, price board, or just one drink's price. <strong>Only Pub Bingo admins see it.</strong> They check it and update the prices, so they're real and dated.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="menu-pub">Which pub?</label>
          <select id="menu-pub" value={pubId} onChange={e => setPubId(e.target.value)}>
            <option value="">Choose a pub…</option>
            {sortedPubs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.area})</option>)}
            <option value={OTHER}>A pub that isn't listed…</option>
          </select>
        </div>
        {pubId === OTHER && (
          <div className="field">
            <label htmlFor="menu-pub-name">Pub name and area</label>
            <input id="menu-pub-name" value={pubName} maxLength={100} onChange={e => setPubName(e.target.value)} placeholder="e.g. The Lamb, Holborn" />
          </div>
        )}
        <div className="field">
          <label htmlFor="menu-seen-on">Date on the menu, or when you saw it</label>
          <input id="menu-seen-on" type="date" value={seenOn} max={today} onChange={e => setSeenOn(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="menu-file">Menu (PDF) or photo</label>
        <input id="menu-file" ref={fileRef} type="file" accept="application/pdf,.pdf,image/*" onChange={e => setFileName(e.target.files?.[0]?.name || "")} />
        {fileName && <span className="muted small-text">Selected: {fileName}</span>}
      </div>
      <div className="field">
        <label htmlFor="menu-note">Anything to add? (optional)</label>
        <input id="menu-note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Just the Guinness price on the board by the bar" />
      </div>
      <div className="suggestion-form-footer">
        <span className="muted small-text">PDF up to 10 MB, or any photo (resized, with location data removed).</span>
        <button type="submit" className="primary-button" disabled={sending}>{sending ? "Sending…" : "Send to admin"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export function MyMenus({ reloadKey }) {
  const { api, userId } = useApp();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    api.listMyMenus(userId).then(rows => active && setItems(rows)).catch(() => {});
    return () => { active = false; };
  }, [api, userId, reloadKey]);

  if (!items.length) return null;
  return (
    <div className="my-menus">
      <h3 className="section-title">Menus you've sent</h3>
      <ul className="my-menu-list">
        {items.map(m => {
          const status = MENU_STATUS[m.status] || MENU_STATUS.new;
          return (
            <li key={m.id}>
              <span aria-hidden="true">{m.file_kind === "pdf" ? "📄" : "📷"}</span>{" "}
              <strong>{m.pub?.name || m.pub_name || "A pub"}</strong>
              <span className="muted small-text"> · seen {formatDate(m.seen_on)} · sent {timeAgo(m.created_at)}</span>{" "}
              <span className={`suggestion-status ${status.tone}`}>{status.label}{m.status === "used" && m.prices_imported ? ` (${m.prices_imported})` : ""}</span>
              {m.admin_note && <div className="suggestion-reply"><strong>Reply from Pub Bingo:</strong> {m.admin_note}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
