import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { describeDeal, dealIsActive } from "../../lib/core/deals.js";
import { openStatus, todayHoursText } from "../../lib/core/hours.js";
import { WEEKDAYS } from "../../data/features.js";
import { formatTime } from "../../lib/core/events.js";
import NotLaunched from "../ui/NotLaunched.jsx";

export function hasGuinness(pub) {
  return (pub.drinks || []).some(d => /guinness/i.test(d.name));
}

// Opening hours line: "Open now · until 11pm", with the week's hours on tap.
export function PubHours({ pub }) {
  const { feature, clock } = useApp();
  if (!feature("pub_filters") || !pub.opening_hours) return null;
  const status = openStatus(pub.opening_hours, clock);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <details className="pub-hours">
      <summary>
        <span className={`open-pill ${status?.open ? "open" : "closed"}`}>{status?.text}</span>
        <span className="muted small-text"> Today: {todayHoursText(pub.opening_hours, clock)}</span> <NotLaunched feature="pub_filters" />
      </summary>
      <ul>
        {order.map(d => {
          const ranges = pub.opening_hours[String(d)] || [];
          return <li key={d}><strong>{WEEKDAYS[d]}</strong> {ranges.length ? ranges.map(([o, c]) => `${formatTime(o)}–${formatTime(c)}`).join(", ") : "Closed"}</li>;
        })}
      </ul>
    </details>
  );
}

export function CheckIn({ pub }) {
  const { api, userId, feature, extras, toast, notifyChange } = useApp();
  const [busy, setBusy] = useState(false);
  if (!feature("check_ins")) return null;
  const people = extras.busy.get(pub.id) || 0;

  function checkIn() {
    if (!userId) { toast("Sign in to check in."); return; }
    if (!navigator.geolocation) { toast("Your browser can't share its location.", "error"); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          await api.checkIn(pub.id, pos.coords.latitude, pos.coords.longitude);
          toast(`Checked in at ${pub.name}. Cheers! 🍻`, "success");
          notifyChange();
        } catch (err) {
          toast(friendlyError(err, "Couldn't check you in."), "error");
        } finally {
          setBusy(false);
        }
      },
      () => { setBusy(false); toast("Couldn't get your location. Allow location to check in.", "error"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <span className="check-in">
      <button type="button" className="secondary-button" onClick={checkIn} disabled={busy}>{busy ? "Checking…" : "📍 Check in"}</button>
      {people > 0 && <span className="busy-note">🔥 {people} {people === 1 ? "person" : "people"} checked in recently</span>}
      <NotLaunched feature="check_ins" />
    </span>
  );
}

export function PourScore({ pub, compact = false }) {
  const { api, userId, feature, extras, toast, notifyChange } = useApp();
  const [mine, setMine] = useState(null);
  if (!feature("guinness_score") || !hasGuinness(pub)) return null;
  const score = extras.pour.get(pub.id);
  if (compact) return score ? <span className="pour-score" title={`Guinness pour: ${score.score}/5 from ${score.ratings} ratings`}>☘️ {score.score.toFixed(1)}</span> : null;

  async function rate(value) {
    if (!userId) { toast("Sign in to rate the pour."); return; }
    setMine(value);
    try {
      await api.ratePour(pub.id, value);
      toast("Thanks for rating the pour!", "success");
      notifyChange();
    } catch (err) {
      setMine(null);
      toast(friendlyError(err, "Couldn't save your rating."), "error");
    }
  }

  return (
    <section className="card pour-card" aria-labelledby="pour-heading">
      <div className="section-header">
        <h2 id="pour-heading" className="section-title">☘️ Guinness score</h2>
        <NotLaunched feature="guinness_score" />
      </div>
      <p>{score ? <><strong className="big-number">{score.score.toFixed(1)}</strong> / 5 from {score.ratings} rating{score.ratings === 1 ? "" : "s"} (last 6 months)</> : "No ratings yet. Had one here? Rate the pour."}</p>
      <div className="rating-row" role="group" aria-label="Rate the Guinness pour from 1 to 5">
        {[1, 2, 3, 4, 5].map(v => (
          <button key={v} type="button" className={`rating-button ${mine != null && v <= mine ? "active" : ""}`} aria-pressed={mine === v} aria-label={`${v} out of 5`} onClick={() => rate(v)}>
            {v}
          </button>
        ))}
      </div>
      <p className="muted small-text">Head, temperature, the settle, the glass. One rating per pub per day.</p>
    </section>
  );
}

export function PubDeals({ pub }) {
  const { feature, deals, clock, isAdmin, api } = useApp();
  const [adminDeals, setAdminDeals] = useState(null);
  const on = feature("happy_hours");
  // Admins also see deals that aren't published yet.
  useEffect(() => {
    if (!on || !isAdmin) return undefined;
    let active = true;
    api.admin.listDeals(pub.id).then(d => active && setAdminDeals(d)).catch(() => {});
    return () => { active = false; };
  }, [on, isAdmin, api, pub.id]);
  if (!on) return null;
  const list = adminDeals || deals.filter(d => d.pub_id === pub.id);
  if (!list.length) return null;
  return (
    <section className="card" aria-labelledby="deals-heading">
      <div className="section-header">
        <h2 id="deals-heading" className="section-title">🍻 Happy hours</h2>
        <NotLaunched feature="happy_hours" />
      </div>
      <ul className="deal-list">
        {list.map(d => {
          const { what, when } = describeDeal(d);
          const live = dealIsActive(d, clock);
          const drink = d.drink_id ? (pub.drinks || []).find(x => x.id === d.drink_id) : null;
          return (
            <li key={d.id} className={live ? "deal-live" : ""}>
              <strong>{d.title}</strong> · {what}{drink ? ` on ${drink.name}` : d.category ? ` on ${d.category}` : ""}
              <span className="muted small-text"> · {when}</span>
              {live && <span className="status-pill live">On now</span>}
              {!d.is_published && <span className="status-pill hidden">Not published</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
