import { useState } from "react";
import { useApp } from "../../../lib/AppContext.jsx";
import { friendlyError } from "../../../lib/api/errors.js";
import { CATEGORIES } from "../../../data/seedPubs.js";
import { MAX_PRICE, MEASURES, MIN_PRICE, formatPrice, measureLabel, parsePrice } from "../../../lib/core/prices.js";
import { londonToday, validateSeenOn } from "../../../lib/api/menuFiles.js";
import { useValidation } from "../../../lib/hooks/useValidation.js";
import { ErrorSummary, FormError, Required, fieldErrorBinding } from "../../ui/FormErrors.jsx";

// priceDefaults: set when working from a menu someone sent in (its date and a note saying so).
function validateSetPrice(v, { isNew, today }) {
  const e = {};
  if (isNew) {
    if (v.name.trim().length < 2) e.name = "Enter the drink's name, like London Pride.";
    if (!v.category) e.category = "Choose a category.";
  }
  const value = parsePrice(v.price);
  if (value == null) e.price = v.price.trim() ? "Enter the price as a number, like 6.20." : "Enter the price.";
  else if (value < MIN_PRICE || value > MAX_PRICE) e.price = `Enter a price between ${formatPrice(MIN_PRICE)} and ${formatPrice(MAX_PRICE)}.`;
  if (v.source === "website" && !/^https?:\/\/\S+/i.test(v.sourceUrl.trim())) e.sourceUrl = "Add the link to the page the price came from, starting with https://";
  else if (v.sourceUrl.trim() && !/^https?:\/\/\S+/i.test(v.sourceUrl.trim())) e.sourceUrl = "Enter a full link starting with https://, or leave it empty.";
  const dateProblem = validateSeenOn(v.seenOn, today);
  if (dateProblem) e.seenOn = v.seenOn ? dateProblem : "Enter the date you saw this price.";
  return e;
}

export default function SetPriceForm({ pub, drink, priceDefaults, onDone, onCancel }) {
  const { api, toast, notifyChange } = useApp();
  const isNew = !drink;
  const today = londonToday();
  const key = drink?.id || "new";
  const ids = { name: `new-drink-name`, category: `new-drink-category`, price: `price-${key}`, sourceUrl: `url-${key}`, seenOn: `seen-${key}` };
  const [values, setValues] = useState(() => ({
    name: "",
    category: "",
    measure: drink?.measure || "pint",
    price: drink ? String(drink.current_price) : "",
    source: priceDefaults ? "admin" : pub.drinks_menu_url || pub.website ? "website" : "admin",
    sourceUrl: priceDefaults ? "" : pub.drinks_menu_url || pub.website || "",
    note: priceDefaults?.note || "",
    seenOn: priceDefaults?.observedOn || today
  }));
  const { errors, checkField, validateAll, attempt } = useValidation(v => validateSetPrice(v, { isNew, today }), values);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = field => event => setValues(prev => ({ ...prev, [field]: event.target.value }));
  const { props: errorProps, message: fieldError } = fieldErrorBinding(errors, ids);
  const check = field => ({ id: ids[field], onBlur: () => checkField(field), ...errorProps(field) });

  async function save(event) {
    event.preventDefault();
    setError("");
    if (!validateAll()) return;
    const value = parsePrice(values.price);
    setSaving(true);
    try {
      const report = await api.admin.setDrinkPrice({
        pubId: pub.id,
        drinkId: drink?.id || null,
        drinkName: isNew ? values.name : null,
        category: isNew ? values.category : null,
        measure: isNew ? values.measure : null,
        price: value,
        source: values.source,
        sourceUrl: values.sourceUrl.trim() || null,
        note: values.note.trim() || null,
        observedOn: values.seenOn
      });
      const olderThanCurrent = drink && drink.source !== "seed" && drink.last_updated_at && report?.reported_at < drink.last_updated_at;
      toast(olderThanCurrent
        ? `${drink.name}: ${formatPrice(value)} added to the history. The current price is newer, so it stays.`
        : `${isNew ? values.name : drink.name}: ${formatPrice(value)} saved.`, "success");
      notifyChange();
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the price."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="set-price-form" onSubmit={save} noValidate>
      <ErrorSummary errors={errors} fieldIds={ids} attempt={attempt} />
      {isNew && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor={ids.name}>Drink name<Required /></label>
            <input {...check("name")} value={values.name} onChange={set("name")} maxLength={60} placeholder="e.g. London Pride" aria-required="true" />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor={ids.category}>Category<Required /></label>
            <select {...check("category")} value={values.category} onChange={set("category")} aria-required="true">
              <option value="">Choose…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {fieldError("category")}
          </div>
          <div className="field">
            <label htmlFor="new-drink-measure">Measure<Required /></label>
            <select id="new-drink-measure" value={values.measure} onChange={set("measure")} aria-required="true">
              {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={ids.price}>Price{drink && drink.measure !== "pint" ? ` per ${measureLabel(drink.measure, drink.volume_ml)}` : ""}<Required /></label>
          <div className="price-input"><span aria-hidden="true">£</span><input {...check("price")} inputMode="decimal" value={values.price} onChange={set("price")} aria-required="true" /></div>
          {fieldError("price")}
        </div>
        <div className="field">
          <label htmlFor={`source-${key}`}>Where's it from?<Required /></label>
          <select id={`source-${key}`} value={values.source} onChange={set("source")} aria-required="true">
            <option value="website">The pub's website / menu</option>
            <option value="admin">I checked it (in person, by phone, or a dated menu/photo)</option>
          </select>
        </div>
        <div className="field grow">
          <label htmlFor={ids.sourceUrl}>{values.source === "website" ? <>Link to the page<Required /></> : "Link (optional)"}</label>
          <input {...check("sourceUrl")} type="url" value={values.sourceUrl} onChange={set("sourceUrl")} placeholder="https://" aria-required={values.source === "website"} />
          {fieldError("sourceUrl")}
        </div>
        <div className="field">
          <label htmlFor={ids.seenOn}>Date seen<Required /></label>
          <input {...check("seenOn")} type="date" value={values.seenOn} max={today} onChange={set("seenOn")} aria-required="true" />
          {fieldError("seenOn")}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`note-${key}`}>Note (optional, shown in history)</label>
        <input id={`note-${key}`} value={values.note} onChange={set("note")} maxLength={200} placeholder="e.g. from menu dated Sept 2026" />
      </div>
      <FormError>{error}</FormError>
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : isNew ? "Add drink" : "Save price"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
