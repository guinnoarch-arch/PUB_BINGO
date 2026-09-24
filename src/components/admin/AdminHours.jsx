import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { WEEKDAYS } from "../../data/features.js";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

function toRows(hours) {
  return Object.fromEntries(ORDER.map(d => {
    const range = hours?.[String(d)]?.[0];
    return [d, range ? { open: range[0], close: range[1], closed: false } : { open: "12:00", close: "23:00", closed: Boolean(hours) }];
  }));
}

// One opening range per day. A closing time before the opening time means after midnight.
export default function AdminHours({ pub, onSaved }) {
  const { api, toast, notifyChange } = useApp();
  const [rows, setRows] = useState(() => toRows(pub.opening_hours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (d, patch) => setRows(prev => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  async function save(clear = false) {
    setError("");
    setSaving(true);
    try {
      const hours = clear ? null : Object.fromEntries(ORDER.map(d => [String(d), rows[d].closed ? [] : [[rows[d].open, rows[d].close]]]));
      await api.admin.setOpeningHours(pub.id, hours);
      toast(clear ? "Opening hours cleared." : "Opening hours saved.", "success");
      if (clear) setRows(toRows(null));
      notifyChange();
      onSaved?.();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save opening hours."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hours-editor">
      <p className="muted small-text">{pub.opening_hours ? "Saved hours are shown on the pub page and used by the “Open now” filter." : "No hours saved yet: the pub won't show in “Open now” until they are."} Closing after midnight? Just enter e.g. 01:00.</p>
      <table className="sheet hours-sheet">
        <tbody>
          {ORDER.map(d => (
            <tr key={d}>
              <th scope="row">{WEEKDAYS[d]}</th>
              <td><label className="sr-only" htmlFor={`open-${d}`}>{WEEKDAYS[d]} opens</label><input id={`open-${d}`} type="time" value={rows[d].open} disabled={rows[d].closed} onChange={e => set(d, { open: e.target.value })} /></td>
              <td><label className="sr-only" htmlFor={`close-${d}`}>{WEEKDAYS[d]} closes</label><input id={`close-${d}`} type="time" value={rows[d].close} disabled={rows[d].closed} onChange={e => set(d, { close: e.target.value })} /></td>
              <td><label className="checkbox-label"><input type="checkbox" checked={rows[d].closed} onChange={e => set(d, { closed: e.target.checked })} /> Closed</label></td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="button" className="primary-button" onClick={() => save(false)} disabled={saving}>{saving ? "Saving…" : "Save hours"}</button>
        {pub.opening_hours && <button type="button" className="text-button danger" onClick={() => save(true)} disabled={saving}>Clear hours</button>}
      </div>
    </div>
  );
}
