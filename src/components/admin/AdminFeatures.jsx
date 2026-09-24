import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { FEATURES } from "../../lib/featureList.js";

// Launch switches. Off = only admins can see and use the feature (marked "Not launched").
export default function AdminFeatures() {
  const { api, featureLive, reloadFeatures, toast } = useApp();
  const [busy, setBusy] = useState(null);

  async function toggle(feature, live) {
    setBusy(feature.key);
    try {
      await api.admin.setFeature(feature.key, live);
      await reloadFeatures();
      toast(live ? `${feature.label} is now live for everyone.` : `${feature.label} is hidden from the public again.`, "success");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const liveCount = FEATURES.filter(f => featureLive(f.key)).length;
  return (
    <>
      <p className="muted small-text">
        New features start switched off. While a feature is off, the public can't see it, but you can: it's marked <span className="not-launched">Not launched</span> so you can try it first. Switch it on when you're happy. You can switch it off again at any time; nothing is lost.
      </p>
      <p className="small-text"><strong>{liveCount}</strong> of {FEATURES.length} live.</p>
      <ul className="feature-list">
        {FEATURES.map(f => {
          const live = featureLive(f.key);
          const needsSetup = f.status === "needs_setup";
          return (
            <li key={f.key} className={`feature-row ${live ? "is-live" : ""}`}>
              <div className="feature-text">
                <div className="suggestion-meta">
                  <strong>{f.label}</strong>
                  {needsSetup ? <span className="status-pill hidden">Needs setup</span>
                    : live ? <span className="status-pill live">Live</span> : <span className="not-launched">Not launched</span>}
                </div>
                <span className="small-text">{f.description}</span>
                <span className="muted small-text">Where: {f.where}</span>
                {needsSetup && <span className="muted small-text">⚙️ {f.setup}</span>}
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={live}
                  disabled={needsSetup || busy === f.key}
                  aria-label={`${f.label}: ${live ? "live" : "off"}`}
                  onChange={e => toggle(f, e.target.checked)}
                />
                <span aria-hidden="true" />
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}
