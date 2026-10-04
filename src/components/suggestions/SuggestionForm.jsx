import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { SUGGESTION_TYPES } from "../../data/suggestions.js";
import { MenuSubmitForm } from "./MenuSubmit.jsx";
import { FieldError, FormError } from "../ui/FormErrors.jsx";

const MAX_LENGTH = 1000;
const MIN_LENGTH = 3;

// Menus go privately to admins, so they're a separate form rather than a public suggestion.
const MENU_TYPE = { key: "menu", label: "Menu or price" };

export default function SuggestionForm({ onSent, initialType = "idea", initialPubId = "" }) {
  const { api, toast } = useApp();
  const [type, setType] = useState(initialType);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const current = SUGGESTION_TYPES.find(t => t.key === type) || SUGGESTION_TYPES[0];

  async function send(event) {
    event.preventDefault();
    setError("");
    setServerError("");
    if (message.trim().length < MIN_LENGTH) {
      setError(message.trim() ? "Write a little more so we know what you mean." : "Write your suggestion first.");
      document.getElementById("suggestion-text")?.focus();
      return;
    }
    setSending(true);
    try {
      await api.submitSuggestion(type, message);
      setMessage("");
      toast("Suggestion sent.", "success");
      onSent();
    } catch (err) {
      // The message stays in the box so it can be sent again.
      setServerError(friendlyError(err, "Couldn't send your suggestion."));
    } finally {
      setSending(false);
    }
  }

  const chips = (
    <div className="chip-row" role="radiogroup" aria-label="Type of suggestion">
      {[...SUGGESTION_TYPES, MENU_TYPE].map(t => (
        <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className={`chip ${type === t.key ? "active" : ""}`} onClick={() => { setType(t.key); setError(""); setServerError(""); }}>
          {t.label}
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
      <textarea id="suggestion-text" rows={4} maxLength={MAX_LENGTH} value={message} onChange={e => { setMessage(e.target.value); if (error && e.target.value.trim().length >= MIN_LENGTH) setError(""); }} placeholder={current.placeholder}
        aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? "suggestion-error suggestion-help" : "suggestion-help"} />
      <FieldError id="suggestion-error">{error}</FieldError>
      <div className="suggestion-form-footer">
        <span id="suggestion-help" className="muted small-text">{message.length}/{MAX_LENGTH} · Everyone can see suggestions and vote on them.</span>
        <button type="submit" className="primary-button" disabled={sending}>{sending ? "Sending…" : "Send suggestion"}</button>
      </div>
      <FormError>{serverError}</FormError>
    </form>
  );
}
