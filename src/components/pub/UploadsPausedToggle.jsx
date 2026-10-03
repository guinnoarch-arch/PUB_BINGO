import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";

// Admin switch to stop (or allow) photo uploads for one pub. Moves straight away and rolls back if
// saving fails. onChange(paused) runs once it's saved.
export default function UploadsPausedToggle({ pubId, paused, onChange, label = "Pause photo uploads for this pub" }) {
  const { api, toast } = useApp();
  const [pending, setPending] = useState(null);

  async function change(next) {
    setPending(next);
    try {
      await api.admin.setUploadsPaused(pubId, next);
      toast(next ? "Photo uploads paused for this pub." : "Photo uploads open again for this pub.", "success");
      onChange?.(next);
    } catch (err) {
      toast(friendlyError(err, "Couldn't change photo uploads."), "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <label className="admin-toggle">
      <input type="checkbox" checked={pending ?? Boolean(paused)} disabled={pending !== null} onChange={e => change(e.target.checked)} />
      {label}
    </label>
  );
}
