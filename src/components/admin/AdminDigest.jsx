import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { needsChecking } from "../../lib/core/checking.js";
import { FEATURES } from "../../lib/featureList.js";

const WEEK = 7 * 86400000;

// What's happened in the last 7 days, and what's waiting for you. (The weekly email version needs
// an email service; see Features.)
export default function AdminDigest() {
  const { api, pubs, featureLive, changeVersion } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    const soft = promise => promise.catch(() => []);
    Promise.all([
      soft(api.listRecentReports(300)),
      soft(api.listSuggestions()),
      soft(api.admin.listMenuSubmissions()),
      soft(api.admin.listHeldReports())
    ]).then(([reports, suggestions, menus, held]) => {
      if (!active) return;
      const since = Date.now() - WEEK;
      const recent = reports.filter(r => Date.parse(r.reported_at) > since);
      setData({
        reports: recent.filter(r => r.kind !== "confirm").length,
        confirms: recent.filter(r => r.kind === "confirm").length,
        reporters: new Set(recent.map(r => r.reporter_profile?.username).filter(Boolean)).size,
        newSuggestions: suggestions.filter(s => s.status === "new").length,
        newMenus: menus.filter(m => m.status === "new").length,
        held: held.length
      });
    });
    return () => { active = false; };
  }, [api, changeVersion]);

  const stale = needsChecking(pubs);
  const staleReal = stale.filter(r => !r.estimate).length;
  const estimates = stale.length - staleReal;
  const notLaunched = FEATURES.filter(f => f.status !== "needs_setup" && !featureLive(f.key)).length;

  if (!data) return null;
  const todo = [
    [data.newMenus, "menus sent in to check", "/admin?tab=menus"],
    [data.held, "price reports waiting for review", "/admin?tab=reports"],
    [data.newSuggestions, "new suggestions", "/suggestions"],
    [staleReal, "real prices over 60 days old", "/needs-checking"],
    [notLaunched, "features not launched yet", "/admin?tab=features"]
  ].filter(([n]) => n > 0);

  return (
    <>
      <div className="stat-strip" aria-label="Last 7 days">
        <div><strong>{data.reports}</strong><span>price reports</span></div>
        <div><strong>{data.confirms}</strong><span>“still right” checks</span></div>
        <div><strong>{data.reporters}</strong><span>people reporting</span></div>
        <div><strong>{estimates}</strong><span>estimates left</span></div>
      </div>
      <h3 className="section-title">Waiting for you</h3>
      {todo.length === 0 ? <p className="muted">All caught up. 🍻</p> : (
        <ul className="digest-list">
          {todo.map(([n, label, to]) => <li key={label}><strong>{n}</strong> {label} <Link to={to}>Open →</Link></li>)}
        </ul>
      )}
      <p className="muted small-text">A weekly email of this page needs an email service to be set up (see Features → Weekly admin email).</p>
    </>
  );
}
