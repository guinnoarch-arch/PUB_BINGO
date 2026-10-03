import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { CATEGORIES } from "../../data/seedPubs.js";
import { WEEKDAYS } from "../../data/features.js";
import { describeDeal, validateDeal } from "../../lib/core/deals.js";
import { ErrorSummary, FormError, Required, errorIdFor, fieldErrorBinding } from "../ui/FormErrors.jsx";
import { usePending } from "../../lib/hooks/usePending.js";

const EMPTY = { title: "", days: [1, 2, 3, 4, 5], start_time: "16:00", end_time: "19:00", drink_id: "", category: "", kind: "price", deal_price: "", discount_pct: "", source_url: "", is_published: false };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEAL_FIELD_IDS = { title: "deal-title", days: "deal-day-1", end_time: "deal-end", deal_price: "deal-price", discount_pct: "deal-pct", source_url: "deal-url" };

function DealForm({ pub, deal, onDone, onCancel }) {
  const { api, toast } = useApp();
  const [form, setForm] = useState(() => (deal ? { ...EMPTY, ...deal, drink_id: deal.drink_id || "", category: deal.category || "", kind: deal.deal_price != null ? "price" : "pct", deal_price: deal.deal_price ?? "", discount_pct: deal.discount_pct ?? "", source_url: deal.source_url || "" } : EMPTY));
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const { props: invalid, message: fieldError } = fieldErrorBinding(errors, DEAL_FIELD_IDS);
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleDay = d => setForm(prev => ({ ...prev, days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d] }));

  async function save(event) {
    event.preventDefault();
    setError("");
    const found = validateDeal(form);
    setErrors(found);
    setAttempt(a => a + 1);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await api.admin.saveDeal({
        id: deal?.id, pub_id: pub.id, title: form.title, days: form.days, start_time: form.start_time, end_time: form.end_time,
        drink_id: form.drink_id || null, category: form.drink_id ? null : form.category || null,
        deal_price: form.kind === "price" ? form.deal_price : null, discount_pct: form.kind === "pct" ? form.discount_pct : null,
        source: form.source_url ? "website" : "admin", source_url: form.source_url || null, is_published: form.is_published
      });
      toast(`“${form.title.trim()}” saved${form.is_published ? "" : " as a draft"}.`, "success");
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the deal."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="set-price-form" onSubmit={save} noValidate>
      <ErrorSummary errors={errors} fieldIds={DEAL_FIELD_IDS} attempt={attempt} />
      <div className="form-grid">
        <div className="field grow"><label htmlFor="deal-title">Title<Required /></label><input id="deal-title" value={form.title} onChange={set("title")} maxLength={80} placeholder="e.g. Happy hour: £5 pints" aria-required="true" {...invalid("title")} />{fieldError("title")}</div>
        <div className="field"><label htmlFor="deal-start">From<Required /></label><input id="deal-start" type="time" value={form.start_time} onChange={set("start_time")} aria-required="true" /></div>
        <div className="field"><label htmlFor="deal-end">Until<Required /></label><input id="deal-end" type="time" value={form.end_time} onChange={set("end_time")} aria-required="true" {...invalid("end_time")} />{fieldError("end_time")}</div>
      </div>
      <fieldset className="day-picker" aria-describedby={errors.days ? errorIdFor(DEAL_FIELD_IDS.days) : undefined}>
        <legend>Days<Required /></legend>
        {ORDER.map(d => (
          <label key={d} className={`chip ${form.days.includes(d) ? "active" : ""}`}>
            <input id={`deal-day-${d}`} type="checkbox" className="sr-only" checked={form.days.includes(d)} onChange={() => toggleDay(d)} />{WEEKDAYS[d]}
          </label>
        ))}
        {fieldError("days")}
      </fieldset>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="deal-drink">Applies to</label>
          <select id="deal-drink" value={form.drink_id} onChange={set("drink_id")}>
            <option value="">All draught drinks</option>
            {(pub.drinks || []).map(d => <option key={d.id} value={d.id}>Only {d.name}{d.measure !== "pint" ? ` (${d.measure})` : ""}</option>)}
          </select>
        </div>
        {!form.drink_id && (
          <div className="field">
            <label htmlFor="deal-cat">Category</label>
            <select id="deal-cat" value={form.category} onChange={set("category")}>
              <option value="">Any</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="deal-kind">Deal</label>
          <select id="deal-kind" value={form.kind} onChange={set("kind")}>
            <option value="price">Fixed price</option>
            <option value="pct">% off</option>
          </select>
        </div>
        {form.kind === "price" ? (
          <div className="field"><label htmlFor="deal-price">Price (per pint)<Required /></label><div className="price-input"><span aria-hidden="true">£</span><input id="deal-price" inputMode="decimal" value={form.deal_price} onChange={set("deal_price")} aria-required="true" {...invalid("deal_price")} /></div>{fieldError("deal_price")}</div>
        ) : (
          <div className="field"><label htmlFor="deal-pct">% off<Required /></label><input id="deal-pct" inputMode="numeric" value={form.discount_pct} onChange={set("discount_pct")} placeholder="20" aria-required="true" {...invalid("discount_pct")} />{fieldError("discount_pct")}</div>
        )}
      </div>
      <div className="form-grid">
        <div className="field grow"><label htmlFor="deal-url">Where it's from (link, optional)</label><input id="deal-url" type="url" value={form.source_url} onChange={set("source_url")} placeholder="https://" {...invalid("source_url")} />{fieldError("source_url")}</div>
        <label className="checkbox-label"><input type="checkbox" checked={form.is_published} onChange={set("is_published")} /> Published</label>
      </div>
      <p className="muted small-text">A fixed price counts as a confirmed price while the deal is on. A % off only applies to confirmed prices.</p>
      <FormError>{error}</FormError>
      <div className="row-actions">
        <button type="submit" className="secondary-button" disabled={saving}>{saving ? "Saving…" : "Save deal"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminDeals({ pub }) {
  const { api, toast, reloadFeatures } = useApp();
  const [deals, setDeals] = useState([]);
  const [editing, setEditing] = useState(null); // deal, "new" or null
  const [key, setKey] = useState(0);
  const { run, isPending } = usePending();

  useEffect(() => {
    let active = true;
    api.admin.listDeals(pub.id).then(d => active && setDeals(d)).catch(() => {});
    return () => { active = false; };
  }, [api, pub.id, key]);
  const done = () => { setEditing(null); setKey(k => k + 1); reloadFeatures(); };

  function remove(deal) {
    if (!window.confirm(`Delete “${deal.title}”?`)) return;
    run(deal.id, async () => {
      try { await api.admin.deleteDeal(deal.id); toast("Deal deleted.", "success"); done(); } catch (err) { toast(friendlyError(err, "Couldn't delete the deal. Try again."), "error"); }
    });
  }

  return (
    <>
      {deals.length > 0 && (
        <ul className="deal-list">
          {deals.map(d => {
            const { what, when } = describeDeal(d);
            return (
              <li key={d.id}>
                {editing?.id === d.id ? <DealForm pub={pub} deal={d} onDone={done} onCancel={() => setEditing(null)} /> : (
                  <div className="section-header">
                    <span><strong>{d.title}</strong> · {what} <span className="muted small-text">· {when}</span> <span className={`status-pill ${d.is_published ? "live" : "hidden"}`}>{d.is_published ? "Published" : "Draft"}</span></span>
                    <span className="row-actions">
                      <button type="button" className="text-button" onClick={() => setEditing(d)}>Edit</button>
                      <button type="button" className="text-button danger" disabled={isPending(d.id)} onClick={() => remove(d)}>{isPending(d.id) ? "Deleting…" : "Delete"}</button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing === "new" ? <DealForm pub={pub} onDone={done} onCancel={() => setEditing(null)} />
        : <button type="button" className="secondary-button" onClick={() => setEditing("new")}>+ Add a happy hour</button>}
    </>
  );
}
