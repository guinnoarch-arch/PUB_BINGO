import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { FEATURES } from "../../data/features.js";
import EventItem from "./EventItem.jsx";

// "What's on here" on a pub page: its features plus its published events.
export default function PubWhatsOn({ pub }) {
  const { api, changeVersion } = useApp();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let active = true;
    api.listEvents({ pubId: pub.id }).then(rows => active && setEvents(rows)).catch(() => active && setEvents([]));
    return () => { active = false; };
  }, [api, pub.id, changeVersion]);

  const features = FEATURES.filter(f => (pub.tags || []).includes(f.tag));
  if (!events.length && !features.length) return null;

  return (
    <section className="card" aria-labelledby="pub-whats-on-heading">
      <div className="section-header">
        <h2 id="pub-whats-on-heading" className="section-title">What's on here</h2>
        <Link to="/whats-on" className="text-button">All events</Link>
      </div>
      {features.length > 0 && (
        <ul className="tag-list" aria-label="Features">
          {features.map(f => (
            <li key={f.tag}><Link className="chip" to={`/whats-on?has=${f.tag}`}><span aria-hidden="true">{f.icon}</span> {f.label}</Link></li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <ul className="event-list">
          {events.map(event => <li key={event.id}><EventItem event={event} showPub={false} /></li>)}
        </ul>
      )}
      <p className="muted small-text">Check with the pub before you go, as events can change.</p>
    </section>
  );
}
