import { Link } from "react-router-dom";
import { EVENT_CATEGORIES } from "../../data/features.js";
import { formatSchedule, formatTimes } from "../../lib/core/events.js";

export const categoryInfo = key => EVENT_CATEGORIES.find(c => c.key === key) || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

// One event line. showPub: include the pub name (What's on page); dated: show the time for a dated occurrence.
export default function EventItem({ event, pub, showPub = true, dated = false }) {
  const cat = categoryInfo(event.category);
  const times = formatTimes(event);
  return (
    <div className="event-item">
      <span className="event-icon" aria-hidden="true">{cat.icon}</span>
      <div className="event-main">
        <strong>{event.title}</strong>
        <span className="muted small-text">
          {showPub && pub && <><Link to={`/pubs/${pub.id}`}>{pub.name}</Link> · {pub.area} · </>}
          {dated ? (times || "Time not confirmed") : formatSchedule(event)}
        </span>
        {event.description && <span className="small-text">{event.description}</span>}
        <span className="event-meta">
          <span className="category-pill">{cat.label}</span>
          {event.source_url && <a className="small-text" href={event.source_url} target="_blank" rel="noreferrer">Source ↗</a>}
        </span>
      </div>
    </div>
  );
}
