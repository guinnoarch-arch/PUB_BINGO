import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { SUGGESTION_STATUS } from "../../data/suggestions.js";
import { FormError } from "../ui/FormErrors.jsx";

// Admin: set a suggestion's status, reply publicly, or delete it.
export default function SuggestionAdminControls({ item, onChanged }) {
  const { api, toast } = useApp();
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.admin_note || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.admin.updateSuggestion(item.id, status, note);
      toast(`Marked “${SUGGESTION_STATUS[status]?.label || status}”${note.trim() ? " and reply saved" : ""}.`, "success");
      onChanged();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the status and reply. Your reply is still here, so try again."));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this suggestion?")) return;
    setDeleting(true);
    try {
      await api.admin.deleteSuggestion(item.id);
      toast("Suggestion deleted.", "success");
      onChanged();
    } catch (err) {
      toast(friendlyError(err, "Couldn't delete the suggestion. Try again."), "error");
      setDeleting(false);
    }
  }

  return (
    <div className="suggestion-admin">
      <label className="sr-only" htmlFor={`status-${item.id}`}>Status</label>
      <select id={`status-${item.id}`} value={status} onChange={e => setStatus(e.target.value)}>
        {Object.entries(SUGGESTION_STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
      </select>
      <label className="sr-only" htmlFor={`note-${item.id}`}>Reply</label>
      <input id={`note-${item.id}`} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="Reply (shown to everyone)" />
      <button type="button" className="secondary-button small" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      <button type="button" className="text-button danger" onClick={remove} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
      <FormError>{error}</FormError>
    </div>
  );
}
