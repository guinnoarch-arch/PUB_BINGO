import { useState } from "react";
import { useApp } from "../../../lib/AppContext.jsx";
import { friendlyError } from "../../../lib/api/errors.js";
import { PRICES_ONLINE_LABELS, one } from "../../../lib/core/adminPubs.js";
import { formatDay, timeAgo } from "../../../lib/core/time.js";
import { FormError } from "../../ui/FormErrors.jsx";

// Matches the limit in the database (pub_admin.notes).
const NOTES_MAX_LENGTH = 8000;

export default function ResearchNotes({ pub, onSaved }) {
  const { api, toast } = useApp();
  const admin = one(pub.pub_admin) || {};
  const [pricesOnline, setPricesOnline] = useState(admin.prices_online || "unknown");
  const [notes, setNotes] = useState(admin.notes || "");
  const [markChecked, setMarkChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await api.admin.savePubAdmin(pub.id, { pricesOnline, notes, markChecked });
      setPricesOnline(saved?.prices_online || pricesOnline);
      setNotes(saved?.notes ?? notes);
      toast("Notes saved.", "success");
      setMarkChecked(false);
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the notes. Your text is still here, so try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="row-actions wrap">
        {pub.website && <a className="secondary-button small" href={pub.website} target="_blank" rel="noreferrer">Open website ↗</a>}
        {pub.drinks_menu_url && <a className="secondary-button small" href={pub.drinks_menu_url} target="_blank" rel="noreferrer">Open drinks menu ↗</a>}
        {pub.food_menu_url && <a className="secondary-button small" href={pub.food_menu_url} target="_blank" rel="noreferrer">Open food menu ↗</a>}
        <a className="secondary-button small" href={`https://www.google.com/search?q=${encodeURIComponent(`${pub.name} ${pub.address || "London"} drinks menu prices`)}`} target="_blank" rel="noreferrer">Search the web ↗</a>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="prices-online">Are prices published online?</label>
          <select id="prices-online" value={pricesOnline} onChange={e => setPricesOnline(e.target.value)}>
            {Object.entries(PRICES_ONLINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">Prices last checked</span>
          <span>{admin.prices_checked_at ? `${timeAgo(admin.prices_checked_at)} (${formatDay(admin.prices_checked_at)})` : "Never"}</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="admin-notes">Research notes (admins only)</label>
        <textarea id="admin-notes" rows={6} value={notes} onChange={e => setNotes(e.target.value)} maxLength={NOTES_MAX_LENGTH} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={markChecked} onChange={e => setMarkChecked(e.target.checked)} />
        I've checked this pub's prices today
      </label>
      <FormError>{error}</FormError>
      <div><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save notes"}</button></div>
    </form>
  );
}
