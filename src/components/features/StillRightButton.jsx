import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { formatPrice } from "../../lib/core/prices.js";

// One tap to say "this price is still right" (refreshes its date).
export default function StillRightButton({ drink }) {
  const { api, userId, feature, toast, notifyChange } = useApp();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!feature("still_right")) return null;

  async function confirm() {
    if (!userId) { toast("Sign in to confirm prices."); return; }
    setBusy(true);
    try {
      await api.confirmPrice(drink.id);
      setDone(true);
      toast(`Thanks! ${drink.name} at ${formatPrice(drink.regular_price ?? drink.current_price)} confirmed.`, "success");
      notifyChange();
    } catch (err) {
      toast(friendlyError(err, "Couldn't confirm the price."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="secondary-button small still-right" onClick={confirm} disabled={busy || done}
      title={`Paid ${formatPrice(drink.current_price)}? Tap to confirm it's still right`}>
      {done ? "✓ Confirmed" : "👍 Still right?"}
    </button>
  );
}
