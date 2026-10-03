import { useState } from "react";
import { useApp } from "../../../lib/AppContext.jsx";
import { friendlyError } from "../../../lib/api/errors.js";
import { CATEGORIES } from "../../../data/seedPubs.js";
import { MEASURES, isDraught } from "../../../lib/core/prices.js";
import { FieldError, FormError, Required } from "../../ui/FormErrors.jsx";

export default function EditDrinkForm({ drink, onDone, onCancel }) {
  const { api, toast, notifyChange } = useApp();
  const [name, setName] = useState(drink.name);
  const [category, setCategory] = useState(drink.category);
  const [measure, setMeasure] = useState(drink.measure);
  const [volume, setVolume] = useState(drink.volume_ml ? String(drink.volume_ml) : "");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setError("");
    const found = {};
    if (name.trim().length < 2) found.name = "Enter the drink's name.";
    const volumeMl = !isDraught(measure) && volume.trim() ? Number(volume) : null;
    if (volumeMl !== null && !(volumeMl >= 100 && volumeMl <= 2000)) found.volume = "Enter a size between 100 and 2000 ml, like 330.";
    setFieldErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await api.admin.updateDrink(drink.id, { name, category, measure, volumeMl });
      toast(`${name.trim()} updated.`, "success");
      notifyChange();
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the drink."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="set-price-form" onSubmit={save} noValidate>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`edit-name-${drink.id}`}>Name<Required /></label>
          <input id={`edit-name-${drink.id}`} value={name} onChange={e => setName(e.target.value)} maxLength={60} aria-required="true"
            aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `edit-name-${drink.id}-error` : undefined} />
          <FieldError id={`edit-name-${drink.id}-error`}>{fieldErrors.name}</FieldError>
        </div>
        <div className="field">
          <label htmlFor={`edit-cat-${drink.id}`}>Category</label>
          <select id={`edit-cat-${drink.id}`} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`edit-measure-${drink.id}`}>Measure</label>
          <select id={`edit-measure-${drink.id}`} value={measure} onChange={e => setMeasure(e.target.value)}>
            {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {!isDraught(measure) && (
          <div className="field">
            <label htmlFor={`edit-volume-${drink.id}`}>Size (ml)</label>
            <input id={`edit-volume-${drink.id}`} inputMode="numeric" value={volume} onChange={e => setVolume(e.target.value)} placeholder="e.g. 330"
              aria-invalid={Boolean(fieldErrors.volume)} aria-describedby={fieldErrors.volume ? `edit-volume-${drink.id}-error` : undefined} />
            <FieldError id={`edit-volume-${drink.id}-error`}>{fieldErrors.volume}</FieldError>
          </div>
        )}
      </div>
      <FormError>{error}</FormError>
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
