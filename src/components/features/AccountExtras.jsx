import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { computeBadges } from "../../lib/core/badges.js";
import NotLaunched from "../ui/NotLaunched.jsx";

// Badges and the pub passport, on your account page.
export default function AccountExtras() {
  const { api, userId, feature, pubs, pubsById, changeVersion } = useApp();
  const [activity, setActivity] = useState(null);
  const showBadges = feature("badges");
  const showPassport = feature("check_ins");

  useEffect(() => {
    if (!userId || (!showBadges && !showPassport)) return undefined;
    let active = true;
    api.getMyActivity(userId).then(a => active && setActivity(a)).catch(() => {});
    return () => { active = false; };
  }, [api, userId, showBadges, showPassport, changeVersion]);

  const badges = useMemo(() => (activity ? computeBadges(activity, pubsById) : []), [activity, pubsById]);
  const visited = useMemo(() => new Set((activity?.checkins || []).map(c => c.pub_id)), [activity]);
  if (!activity) return null;
  const earned = badges.filter(b => b.earned);

  return (
    <>
      {showBadges && (
        <section className="card" aria-labelledby="badges-heading">
          <div className="section-header">
            <h2 id="badges-heading" className="section-title">Badges ({earned.length}/{badges.length})</h2>
            <NotLaunched feature="badges" />
          </div>
          <ul className="badge-grid">
            {badges.map(b => (
              <li key={b.id} className={`badge-tile ${b.earned ? "earned" : ""}`} title={b.detail}>
                <span className="badge-icon" aria-hidden="true">{b.icon}</span>
                <strong>{b.title}</strong>
                <span className="small-text muted">{b.detail}</span>
                {!b.earned && b.goal > 1 && <span className="badge-progress" role="progressbar" aria-label={`${b.title} progress`} aria-valuemin={0} aria-valuemax={b.goal} aria-valuenow={b.value}><span style={{ width: `${(b.value / b.goal) * 100}%` }} /></span>}
                {b.earned && <span className="sr-only">Earned</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {showPassport && (
        <section className="card" aria-labelledby="passport-heading">
          <div className="section-header">
            <h2 id="passport-heading" className="section-title">📍 Pub passport ({visited.size}/{pubs.length})</h2>
            <NotLaunched feature="check_ins" />
          </div>
          <p className="muted small-text">Check in on a pub's page when you're there to stamp your passport.</p>
          <ul className="passport-grid">
            {[...pubs].sort((a, b) => Number(visited.has(b.id)) - Number(visited.has(a.id)) || a.name.localeCompare(b.name)).map(pub => (
              <li key={pub.id} className={visited.has(pub.id) ? "stamped" : ""}>
                <Link to={`/pubs/${pub.id}`}>{visited.has(pub.id) ? "✅" : "⬜"} {pub.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
