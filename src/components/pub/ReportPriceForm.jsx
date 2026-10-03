import { useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { useValidation } from "../../lib/useValidation.js";
import { CATEGORIES } from "../../data/seedPubs.js";
import { LIMITS, MEASURES, formatPrice, measureLabel, validatePriceReport } from "../../lib/core/prices.js";
import { ErrorSummary, FieldError, FormError, Required, RequiredHint } from "../ui/FormErrors.jsx";

const NEW_DRINK = "__new__";
// A price this far from the usual one is probably a typo (e.g. 65 instead of 6.50).
const BIG_CHANGE = 0.5;

export default function ReportPriceForm({ pub, drinks, initialDrinkId = "", onDone, onCancel }) {
  const { api, userId, feature, toast, notifyChange } = useApp();
  const receiptRef = useRef(null);
  const location = useLocation();
  const formId = useId();
  const [values, setValues] = useState({
    drinkChoice: initialDrinkId || (drinks.length ? drinks[0].id : NEW_DRINK),
    drinkName: "",
    category: "",
    measure: "pint",
    price: "",
    note: ""
  });
  const isNew = values.drinkChoice === NEW_DRINK;
  const selected = drinks.find(d => d.id === values.drinkChoice);
  const toInput = v => ({
    pubId: pub.id,
    drinkId: v.drinkChoice === NEW_DRINK ? null : v.drinkChoice,
    drinkName: v.drinkChoice === NEW_DRINK ? v.drinkName : null,
    category: v.drinkChoice === NEW_DRINK ? v.category : null,
    measure: v.drinkChoice === NEW_DRINK ? v.measure : drinks.find(d => d.id === v.drinkChoice)?.measure,
    price: v.price,
    note: v.note
  });
  const { errors, checkField, validateAll, attempt } = useValidation(v => validatePriceReport(toInput(v)).errors, values);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = key => event => setValues(prev => ({ ...prev, [key]: event.target.value }));

  if (!userId) {
    return (
      <div className="sign-in-prompt">
        <p>Sign in to report a price. Reports are shared with everyone and help keep prices accurate.</p>
        <Link className="primary-button" to={`/account?next=${encodeURIComponent(location.pathname)}`}>Sign in or create account</Link>
      </div>
    );
  }

  const fieldId = name => `${formId}-${name}`;
  const fieldIds = { drinkName: fieldId("drinkName"), category: fieldId("category"), price: fieldId("price"), note: fieldId("note") };
  const errorProps = name => ({
    onBlur: () => checkField(name),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? fieldId(`${name}-error`) : undefined
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    if (!validateAll()) return;
    const result = validatePriceReport(toInput(values));

    const usual = selected ? Number(selected.regular_price ?? selected.current_price) : null;
    if (selected && Math.abs(result.value.price - usual) / usual > BIG_CHANGE) {
      const ok = window.confirm(`${formatPrice(result.value.price)} is very different from the current ${formatPrice(usual)}. Is that what you paid?`);
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
          toast(friendlyError(err, "Your price was saved, but the receipt couldn't be added. You can report again with the receipt later."), "error");
        }
      }
      toast(report?.held
        ? `${formatPrice(result.value.price)} is well away from the current price, so an admin will check it before it goes live.`
        : `${name} at ${pub.name} is now ${formatPrice(result.value.price)}.`, "success");
      notifyChange();
      onDone?.();
    } catch (error) {
      // Everything typed stays in the form so it can be fixed and sent again.
      setSubmitError(friendlyError(error, "Couldn't save your price."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={errors} fieldIds={fieldIds} attempt={attempt} />
      <RequiredHint />
      <label htmlFor={fieldId("drink")}>Drink<Required /></label>
      <select id={fieldId("drink")} value={values.drinkChoice} onChange={set("drinkChoice")} aria-required="true">
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
            <label htmlFor={fieldIds.drinkName}>Drink name<Required /></label>
            <input id={fieldIds.drinkName} value={values.drinkName} maxLength={LIMITS.drinkName.max} onChange={set("drinkName")} placeholder="e.g. Camden Hells" autoComplete="off" aria-required="true" {...errorProps("drinkName")} />
            <FieldError id={fieldId("drinkName-error")}>{errors.drinkName}</FieldError>
          </div>
          <div className="field">
            <label htmlFor={fieldIds.category}>Category<Required /></label>
            <select id={fieldIds.category} value={values.category} onChange={set("category")} aria-required="true" {...errorProps("category")}>
              <option value="">Choose…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldError id={fieldId("category-error")}>{errors.category}</FieldError>
          </div>
          <div className="field">
            <label htmlFor={fieldId("measure")}>Measure<Required /></label>
            <select id={fieldId("measure")} value={values.measure} onChange={set("measure")} aria-required="true">
              {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fieldIds.price}>Price paid{selected && selected.measure !== "pint" ? ` (per ${measureLabel(selected.measure, selected.volume_ml)})` : ""}<Required /></label>
          <div className="price-input">
            <span aria-hidden="true">£</span>
            <input id={fieldIds.price} inputMode="decimal" value={values.price} onChange={set("price")} placeholder="6.20" autoComplete="off" aria-required="true" {...errorProps("price")} />
          </div>
          <FieldError id={fieldId("price-error")}>{errors.price}</FieldError>
        </div>
        <div className="field grow">
          <label htmlFor={fieldIds.note}>Note <span className="muted">(optional)</span></label>
          <input id={fieldIds.note} value={values.note} maxLength={LIMITS.note.max} onChange={set("note")} placeholder="e.g. happy hour price" {...errorProps("note")} />
          <FieldError id={fieldId("note-error")}>{errors.note}</FieldError>
        </div>
      </div>

      {feature("receipts") && (
        <div className="field">
          <label htmlFor={fieldId("receipt")}>Receipt photo <span className="muted">(optional, only admins see it)</span></label>
          <input id={fieldId("receipt")} ref={receiptRef} type="file" accept="image/*" />
          <span className="muted small-text">Adds a “Receipt” badge to your report. Cover any card numbers first.</span>
        </div>
      )}

      <FormError>{submitError}</FormError>
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Saving…" : "Submit price"}</button>
        {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
