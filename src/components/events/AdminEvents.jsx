import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { EVENT_CATEGORIES, WEEKDAYS } from "../../data/features.js";
import { formatSchedule, validateEvent } from "../../lib/core/events.js";
import { ErrorSummary, FieldError, FormError, Required } from "../ui/FormErrors.jsx";
import { categoryInfo } from "./EventItem.jsx";
import { usePending } from "../../lib/usePending.js";
import { ErrorState, Loading } from "../ui/States.jsx";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const SOURCE_LABELS = { research: "Web research", website: "Pub website", admin: "Added by admin" };
const hhmm = value => (value ? String(value).slice(0, 5) : "");

function EventForm({ pub, event, onDone, onCancel }) {
  const { api, toast, notifyChange } = useApp();
  const [form, setForm] = useState(() => ({
    title: event?.title || "",
    category: event?.category || "live-music",
    description: event?.description || "",
    schedule: event?.schedule || "weekly",
    weekdays: event?.weekdays || [],
    event_date: event?.event_date || "",
    start_time: hhmm(event?.start_time),
    end_time: hhmm(event?.end_time),
    source_url: event?.source_url || pub.website || "",
    is_published: event ? event.is_published : true
  }));
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleDay = day => setForm(prev => ({ ...prev, weekdays: prev.weekdays.includes(day) ? prev.weekdays.filter(d => d !== day) : [...prev.weekdays, day] }));
  const idPrefix = `ev-${event?.id || "new"}`;
  const fieldIds = { title: `${idPrefix}-title`, weekdays: `${idPrefix}-day-1`, event_date: `${idPrefix}-date`, end_time: `${idPrefix}-end`, description: `${idPrefix}-desc`, source_url: `${idPrefix}-url` };
  const invalid = key => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${fieldIds[key]}-error` : undefined });
  const fieldError = key => <FieldError id={`${fieldIds[key]}-error`}>{errors[key]}</FieldError>;

  async function save(e) {
    e.preventDefault();
    setError("");
    const found = validateEvent(form);
    setErrors(found);
    setAttempt(a => a + 1);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await api.admin.saveEvent({ ...form, id: event?.id || null, pub_id: pub.id, source: event ? undefined : "admin" });
      toast(`“${form.title}” saved${form.is_published ? "" : " (not published)"}.`, "success");
      notifyChange();
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the event."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="set-price-form" onSubmit={save} noValidate>
      <ErrorSummary errors={errors} fieldIds={fieldIds} attempt={attempt} />
      <div className="form-grid">
        <div className="field grow">
          <label htmlFor={`${idPrefix}-title`}>Title<Required /></label>
          <input id={`${idPrefix}-title`} value={form.title} onChange={set("title")} maxLength={100} placeholder="e.g. Quiz night, England v France" aria-required="true" {...invalid("title")} />
          {fieldError("title")}
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-cat`}>Type</label>
          <select id={`${idPrefix}-cat`} value={form.category} onChange={set("category")}>
            {EVENT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-schedule`}>Happens</label>
          <select id={`${idPrefix}-schedule`} value={form.schedule} onChange={set("schedule")}>
            <option value="weekly">Every week</option>
            <option value="one-off">One date (e.g. a match)</option>
          </select>
        </div>
      </div>

      {form.schedule === "weekly" ? (
        <fieldset className="tag-picker">
          <legend>Days<Required /></legend>
          {MONDAY_FIRST.map(day => (
            <label key={day} className={`chip ${form.weekdays.includes(day) ? "active" : ""}`}>
              <input id={`${idPrefix}-day-${day}`} type="checkbox" className="sr-only" checked={form.weekdays.includes(day)} onChange={() => toggleDay(day)} />
              {WEEKDAYS[day]}
            </label>
          ))}
          {fieldError("weekdays")}
        </fieldset>
      ) : (
        <div className="field">
          <label htmlFor={`${idPrefix}-date`}>Date<Required /></label>
          <input id={`${idPrefix}-date`} type="date" value={form.event_date} onChange={set("event_date")} aria-required="true" {...invalid("event_date")} />
          {fieldError("event_date")}
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-start`}>Starts (optional)</label>
          <input id={`${idPrefix}-start`} type="time" value={form.start_time} onChange={set("start_time")} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-end`}>Ends (optional)</label>
          <input id={`${idPrefix}-end`} type="time" value={form.end_time} onChange={set("end_time")} {...invalid("end_time")} />
          {fieldError("end_time")}
        </div>
        <div className="field grow">
          <label htmlFor={`${idPrefix}-url`}>Source link</label>
          <input id={`${idPrefix}-url`} type="url" value={form.source_url} onChange={set("source_url")} placeholder="https://" {...invalid("source_url")} />
          {fieldError("source_url")}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-desc`}>Description (optional)</label>
        <input id={`${idPrefix}-desc`} value={form.description} onChange={set("description")} maxLength={500} {...invalid("description")} />
        {fieldError("description")}
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={form.is_published} onChange={set("is_published")} />
        Published: show on What's on (I've checked it)
      </label>
      <FormError>{error}</FormError>
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : event ? "Save event" : "Add event"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminEvents({ pub }) {
  const { api, toast, notifyChange, changeVersion } = useApp();
  const [events, setEvents] = useState(null);
  const [open, setOpen] = useState(null); // event id, "new" or null
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const reload = () => { setLoadError(""); setReloadKey(k => k + 1); };
  const { run, isPending } = usePending();

  useEffect(() => {
    let active = true;
    api.admin.listEvents({ pubId: pub.id })
      .then(rows => active && setEvents(rows))
      .catch(err => active && setLoadError(friendlyError(err, "Couldn't load this pub's events.")));
    return () => { active = false; };
  }, [api, pub.id, changeVersion, reloadKey, toast]);

  const quick = (event, changes, message) => run(event.id, async () => {
    try {
      await api.admin.saveEvent({ ...event, ...changes });
      toast(message, "success");
      notifyChange();
      reload();
    } catch (err) {
      toast(friendlyError(err, "Couldn't save the event. Try again."), "error");
    }
  });

  function remove(event) {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    run(event.id, async () => {
      try {
        await api.admin.deleteEvent(event.id);
        toast("Event deleted.", "success");
        notifyChange();
        reload();
      } catch (err) {
        toast(friendlyError(err, "Couldn't delete the event. Try again."), "error");
      }
    });
  }

  const done = () => { setOpen(null); reload(); };
  if (loadError) return <ErrorState title="Couldn't load events" message={loadError} onRetry={reload} />;
  if (!events) return <Loading label="Loading events…" />;

  return (
    <>
      {events.length === 0 && <p className="muted">No events yet.</p>}
      <ul className="admin-event-list">
        {events.map(event => (
          <li key={event.id} className={event.is_published ? "" : "unpublished"}>
            <div className="admin-event-row">
              <span className="event-icon" aria-hidden="true">{categoryInfo(event.category).icon}</span>
              <div className="event-main">
                <strong>{event.title}</strong>
                <span className="small-text">{formatSchedule(event)}</span>
                <span className="event-meta">
                  <span className={`status-pill ${event.is_published ? "live" : "hidden"}`}>{event.is_published ? "Live" : "Needs checking"}</span>
                  <span className="muted small-text">{SOURCE_LABELS[event.source] || event.source}</span>
                  {event.source_url && <a className="small-text" href={event.source_url} target="_blank" rel="noreferrer">Check source ↗</a>}
                </span>
              </div>
              <div className="row-actions">
                {event.is_published
                  ? <button type="button" className="secondary-button small" disabled={isPending(event.id)} onClick={() => quick(event, { is_published: false }, "Event unpublished.")}>Unpublish</button>
                  : <button type="button" className="primary-button small" disabled={isPending(event.id)} onClick={() => quick(event, { is_published: true }, "Event checked and published.")}>Checked: publish</button>}
                <button type="button" className="text-button" aria-expanded={open === event.id} onClick={() => setOpen(open === event.id ? null : event.id)}>Edit</button>
                <button type="button" className="text-button danger" disabled={isPending(event.id)} onClick={() => remove(event)}>Delete</button>
              </div>
            </div>
            {open === event.id && <EventForm pub={pub} event={event} onDone={done} onCancel={() => setOpen(null)} />}
          </li>
        ))}
      </ul>
      {open === "new" ? (
        <div className="inline-panel">
          <h3 className="section-title">Add an event</h3>
          <EventForm pub={pub} onDone={done} onCancel={() => setOpen(null)} />
        </div>
      ) : (
        <button type="button" className="secondary-button" onClick={() => setOpen("new")}>+ Add an event</button>
      )}
    </>
  );
}
