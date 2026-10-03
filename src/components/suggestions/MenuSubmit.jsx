import { useEffect, useRef, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { londonToday, validateMenuSubmissionFile, validateSeenOn } from "../../lib/api/menuFiles.js";
import { formatDay, timeAgo } from "../../lib/core/time.js";
import { ErrorSummary, FieldError, FormError, Required, RequiredHint } from "../ui/FormErrors.jsx";

const OTHER = "__other__";
const FIELD_IDS = { pub: "menu-pub", pubName: "menu-pub-name", seenOn: "menu-seen-on", file: "menu-file" };
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
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const sortedPubs = [...(pubs || [])].sort((a, b) => a.name.localeCompare(b.name));

  // Coming from a pub page ("Send us the menu"): pick that pub once the list has loaded.
  useEffect(() => {
    if (initialPubId && (pubs || []).some(p => p.id === initialPubId)) setPubId(prev => prev || initialPubId);
  }, [initialPubId, pubs]);

  async function send(event) {
    event.preventDefault();
    setServerError("");
    const file = fileRef.current?.files?.[0];
    const found = {};
    if (!pubId) found.pub = "Choose the pub, or “A pub that isn't listed”.";
    if (pubId === OTHER && pubName.trim().length < 2) found.pubName = "Type the pub's name and area.";
    const dateProblem = validateSeenOn(seenOn, today);
    if (dateProblem) found.seenOn = dateProblem;
    const fileProblem = validateMenuSubmissionFile(file);
    if (fileProblem) found.file = fileProblem;
    setErrors(found);
    setAttempt(a => a + 1);
    if (Object.keys(found).length) {
      if (Object.keys(found).length === 1) document.getElementById(FIELD_IDS[Object.keys(found)[0]])?.focus();
      return;
    }
    setSending(true);
    try {
      await api.submitMenu(userId, {
        pubId: pubId === OTHER ? null : pubId,
        pubName: pubId === OTHER ? pubName.trim() : null,
        seenOn,
        note: note.trim(),
        file
      });
      toast("Menu sent to the admins.", "success");
      setNote("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onSent();
    } catch (err) {
      // The pub, date and note stay filled in so it can be sent again.
      setServerError(friendlyError(err, "Couldn't send the menu."));
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="suggestion-form menu-submit-form" onSubmit={send} noValidate>
      <p className="muted small-text">
        Send a PDF menu, or a photo of a menu, price board, or just one drink's price. <strong>Only Pub Bingo admins see it.</strong> They check it and update the prices, so they're real and dated.
      </p>
      <ErrorSummary errors={errors} fieldIds={FIELD_IDS} attempt={attempt} />
      <RequiredHint />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="menu-pub">Which pub?<Required /></label>
          <select id="menu-pub" value={pubId} onChange={e => { setPubId(e.target.value); setErrors(prev => ({ ...prev, pub: undefined })); }} aria-required="true" aria-invalid={Boolean(errors.pub)} aria-describedby={errors.pub ? "menu-pub-error" : undefined}>
            <option value="">Choose a pub…</option>
            {sortedPubs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.area})</option>)}
            <option value={OTHER}>A pub that isn't listed…</option>
          </select>
          <FieldError id="menu-pub-error">{errors.pub}</FieldError>
        </div>
        {pubId === OTHER && (
          <div className="field">
            <label htmlFor="menu-pub-name">Pub name and area<Required /></label>
            <input id="menu-pub-name" value={pubName} maxLength={100} onChange={e => setPubName(e.target.value)} placeholder="e.g. The Lamb, Holborn" aria-required="true" aria-invalid={Boolean(errors.pubName)} aria-describedby={errors.pubName ? "menu-pub-name-error" : undefined} />
            <FieldError id="menu-pub-name-error">{errors.pubName}</FieldError>
          </div>
        )}
        <div className="field">
          <label htmlFor="menu-seen-on">Date on the menu, or when you saw it<Required /></label>
          <input id="menu-seen-on" type="date" value={seenOn} max={today} onChange={e => setSeenOn(e.target.value)} aria-required="true" aria-invalid={Boolean(errors.seenOn)} aria-describedby={errors.seenOn ? "menu-seen-on-error" : undefined} />
          <FieldError id="menu-seen-on-error">{errors.seenOn}</FieldError>
        </div>
      </div>
      <div className="field">
        <label htmlFor="menu-file">Menu (PDF) or photo<Required /></label>
        <input id="menu-file" ref={fileRef} type="file" accept="application/pdf,.pdf,image/*" onChange={e => { setFileName(e.target.files?.[0]?.name || ""); setErrors(prev => ({ ...prev, file: undefined })); }} aria-required="true" aria-invalid={Boolean(errors.file)} aria-describedby={errors.file ? "menu-file-error" : undefined} />
        {fileName && <span className="muted small-text">Selected: {fileName}</span>}
        <FieldError id="menu-file-error">{errors.file}</FieldError>
      </div>
      <div className="field">
        <label htmlFor="menu-note">Anything to add? (optional)</label>
        <input id="menu-note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Just the Guinness price on the board by the bar" />
      </div>
      <div className="suggestion-form-footer">
        <span className="muted small-text">PDF up to 10 MB, or any photo (resized, with location data removed).</span>
        <button type="submit" className="primary-button" disabled={sending}>{sending ? "Sending…" : "Send to admin"}</button>
      </div>
      <FormError>{serverError}</FormError>
    </form>
  );
}

export function MyMenus({ reloadKey }) {
  const { api, userId } = useApp();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.listMyMenus(userId).then(rows => { if (active) { setItems(rows); setError(""); } }).catch(err => active && setError(friendlyError(err, "Couldn't load the menus you've sent.")));
    return () => { active = false; };
  }, [api, userId, reloadKey]);

  if (error) return <p className="muted small-text">{error}</p>;
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
              <span className="muted small-text"> · seen {formatDay(m.seen_on)} · sent {timeAgo(m.created_at)}</span>{" "}
              <span className={`suggestion-status ${status.tone}`}>{status.label}{m.status === "used" && m.prices_imported ? ` (${m.prices_imported})` : ""}</span>
              {m.admin_note && <div className="suggestion-reply"><strong>Reply from Pub Bingo:</strong> {m.admin_note}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
