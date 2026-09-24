import { useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { CATEGORIES } from "../../data/seedPubs.js";
import { LIMITS, MEASURES, formatPrice, measureLabel, validatePriceReport } from "../../lib/core/prices.js";

const NEW_DRINK = "__new__";

export default function ReportPriceForm({ pub, drinks, initialDrinkId = "", onDone, onCancel }) {
  const { api, userId, feature, toast, notifyChange } = useApp();
  const receiptRef = useRef(null);
  const location = useLocation();
  const formId = useId();
  const [drinkChoice, setDrinkChoice] = useState(initialDrinkId || (drinks.length ? drinks[0].id : NEW_DRINK));
  const [drinkName, setDrinkName] = useState("");
  const [category, setCategory] = useState("");
  const [measure, setMeasure] = useState("pint");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!userId) {
    return (
      <div className="sign-in-prompt">
        <p>Sign in to report a price. Reports are shared with everyone and help keep prices accurate.</p>
        <Link className="primary-button" to={`/account?next=${encodeURIComponent(location.pathname)}`}>Sign in or create account</Link>
      </div>
    );
  }

  const isNew = drinkChoice === NEW_DRINK;
  const selected = drinks.find(d => d.id === drinkChoice);
  const fieldId = name => `${formId}-${name}`;
  const errorProps = name => (errors[name] ? { "aria-invalid": true, "aria-describedby": fieldId(`${name}-error`) } : {});
  const FieldError = ({ name }) => (errors[name] ? <span id={fieldId(`${name}-error`)} className="field-error">{errors[name]}</span> : null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    const result = validatePriceReport({
      pubId: pub.id,
      drinkId: isNew ? null : drinkChoice,
      drinkName: isNew ? drinkName : null,
      category: isNew ? category : null,
      measure: isNew ? measure : selected?.measure,
      price,
      note
    });
    setErrors(result.errors);
    if (!result.ok) return;

    // Double-check big jumps, which are usually typos (e.g. 65 instead of 6.50).
    const usual = selected ? Number(selected.regular_price ?? selected.current_price) : null;
    if (selected && Math.abs(result.value.price - usual) / usual > 0.5) {
      const ok = window.confirm(`${formatPrice(result.value.price)} is very different from the current ${formatPrice(usual)}. Submit anyway?`);
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const report = await api.submitPriceReport(result.value);
      const name = isNew ? result.value.drinkName : selected.name;
      const receipt = receiptRef.current?.files?.[0];
      if (receipt && report?.id) {
        try {
          await api.uploadReceipt(userId, report.id, receipt);
        } catch (err) {
          toast(friendlyError(err, "Your price was saved, but the receipt couldn't be added."), "error");
        }
      }
      toast(report?.held
        ? `Thanks! ${formatPrice(result.value.price)} is quite different from the current price, so an admin will check it before it goes live.`
        : `Thanks! ${name} at ${pub.name} is now ${formatPrice(result.value.price)}.`, "success");
      notifyChange();
      onDone?.();
    } catch (error) {
      setSubmitError(friendlyError(error, "Couldn't save your price."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor={fieldId("drink")}>Drink</label>
      <select id={fieldId("drink")} value={drinkChoice} onChange={event => setDrinkChoice(event.target.value)}>
        {drinks.map(drink => (
          <option key={drink.id} value={drink.id}>
            {drink.name}{drink.measure !== "pint" ? ` (${measureLabel(drink.measure, drink.volume_ml)})` : ""}: now {formatPrice(drink.regular_price ?? drink.current_price)}
          </option>
        ))}
        <option value={NEW_DRINK}>+ A drink that isn't listed</option>
      </select>

      {isNew && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor={fieldId("name")}>Drink name</label>
            <input id={fieldId("name")} value={drinkName} maxLength={LIMITS.drinkName.max} onChange={e => setDrinkName(e.target.value)} placeholder="e.g. Camden Hells" autoComplete="off" {...errorProps("drinkName")} />
            <FieldError name="drinkName" />
          </div>
          <div className="field">
            <label htmlFor={fieldId("category")}>Category</label>
            <select id={fieldId("category")} value={category} onChange={e => setCategory(e.target.value)} {...errorProps("category")}>
              <option value="">Choose…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldError name="category" />
          </div>
          <div className="field">
            <label htmlFor={fieldId("measure")}>Measure</label>
            <select id={fieldId("measure")} value={measure} onChange={e => setMeasure(e.target.value)}>
              {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fieldId("price")}>Price paid{selected && selected.measure !== "pint" ? ` (per ${measureLabel(selected.measure, selected.volume_ml)})` : ""}</label>
          <div className="price-input">
            <span aria-hidden="true">£</span>
            <input id={fieldId("price")} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="6.20" autoComplete="off" {...errorProps("price")} />
          </div>
          <FieldError name="price" />
        </div>
        <div className="field grow">
          <label htmlFor={fieldId("note")}>Note <span className="muted">(optional)</span></label>
          <input id={fieldId("note")} value={note} maxLength={LIMITS.note.max} onChange={e => setNote(e.target.value)} placeholder="e.g. happy hour price" {...errorProps("note")} />
          <FieldError name="note" />
        </div>
      </div>

      {feature("receipts") && (
        <div className="field">
          <label htmlFor={fieldId("receipt")}>🧾 Receipt photo <span className="muted">(optional, only admins see it)</span></label>
          <input id={fieldId("receipt")} ref={receiptRef} type="file" accept="image/*" />
          <span className="muted small-text">Adds a “Receipt” badge to your report. Cover any card numbers first.</span>
        </div>
      )}

      {submitError && <p className="form-error" role="alert">{submitError}</p>}
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Saving…" : "Submit price"}</button>
        {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
