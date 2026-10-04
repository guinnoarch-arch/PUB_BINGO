import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../lib/AppContext.jsx";
import { friendlyError } from "../../../lib/api/errors.js";
import { AREAS, TAGS } from "../../../data/seedPubs.js";
import { canPublish, missingInfo, slugify, validatePubDetails } from "../../../lib/core/adminPubs.js";
import { useValidation } from "../../../lib/hooks/useValidation.js";
import { ErrorSummary, FormError, Required, RequiredHint, fieldErrorBinding } from "../../ui/FormErrors.jsx";
import ExternalLink from "../../ui/ExternalLink.jsx";

const EMPTY_PUB = {
  id: "", name: "", area: "Soho", address: "", lat: "", lng: "", opened_year: "", tags: [], description: "",
  website: "", drinks_menu_url: "", food_menu_url: "", operator: "", is_published: false, uploads_paused: false
};

function toForm(pub) {
  const text = v => (v == null ? "" : String(v));
  return {
    ...EMPTY_PUB, ...pub,
    address: text(pub.address), lat: text(pub.lat), lng: text(pub.lng), opened_year: text(pub.opened_year),
    website: text(pub.website), drinks_menu_url: text(pub.drinks_menu_url), food_menu_url: text(pub.food_menu_url), operator: text(pub.operator),
    description: text(pub.description), tags: pub.tags || []
  };
}

// Accepts "51.5134, -0.1318" pasted from a map app into the latitude box.
function splitCoordinates(value) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  return match ? { lat: match[1], lng: match[2] } : null;
}

const PUB_FIELD_IDS = {
  name: "pub-name", id: "pub-id", area: "pub-area", lat: "pub-lat", lng: "pub-lng", opened_year: "pub-year",
  website: "pub-website", drinks_menu_url: "pub-menu", food_menu_url: "pub-food-menu"
};

export default function PubDetailsForm({ pub, isNew, onSaved }) {
  const { api, toast, reloadPubs } = useApp();
  const [form, setForm] = useState(() => toForm(pub || EMPTY_PUB));
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { errors, checkField, validateAll, attempt } = useValidation(values => validatePubDetails(values, { isNew }), form);
  // Shared props for a validated text field: blur check, red border and the error text link.
  const { props: errorProps, message: fieldError } = fieldErrorBinding(errors, PUB_FIELD_IDS);
  const check = key => ({ id: PUB_FIELD_IDS[key], onBlur: () => checkField(key), ...errorProps(key) });
  const set = key => event => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "name" && isNew && !idTouched) next.id = slugify(value);
      if (key === "lat") {
        const both = splitCoordinates(value);
        if (both) Object.assign(next, both);
      }
      return next;
    });
  };

  const draft = { ...form, lat: form.lat === "" ? null : Number(form.lat), lng: form.lng === "" ? null : Number(form.lng), drinks: pub?.drinks || [] };
  const publishable = canPublish(draft);
  const missing = missingInfo(draft);

  async function save(event) {
    event.preventDefault();
    setError("");
    if (!validateAll()) return;
    setSaving(true);
    try {
      const saved = await api.admin.savePub({
        id: form.id.trim(),
        name: form.name,
        area: form.area,
        address: form.address,
        lat: form.lat.trim(),
        lng: form.lng.trim(),
        opened_year: form.opened_year.trim(),
        tags: form.tags,
        description: form.description,
        website: form.website,
        drinks_menu_url: form.drinks_menu_url,
        food_menu_url: form.food_menu_url,
        operator: form.operator,
        is_published: form.is_published
      });
      toast(`${saved.name} saved${saved.is_published ? "" : " (hidden)"}.`, "success");
      setForm(toForm(saved));
      reloadPubs({ quiet: true });
      onSaved(saved);
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the pub."));
    } finally {
      setSaving(false);
    }
  }

  const toggleTag = tag => setForm(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag] }));
  const osmLink = form.address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(form.address)}` : null;

  return (
    <form className="admin-form" onSubmit={save} noValidate>
      <ErrorSummary errors={errors} fieldIds={PUB_FIELD_IDS} attempt={attempt} />
      <div className={`publish-box ${form.is_published ? "live" : "hidden"}`}>
        <label className="admin-toggle">
          <input type="checkbox" checked={form.is_published} onChange={set("is_published")} disabled={!publishable && !form.is_published} />
          {form.is_published ? "Live: shown to the public" : "Hidden: only admins can see it"}
        </label>
        {!publishable && <p className="small-text muted">Add an address and map position before publishing. You can save it hidden until then.</p>}
        {missing.length > 0 && <p className="small-text">Still missing: {missing.join(", ")}</p>}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="pub-name">Pub name<Required /></label>
          <input {...check("name")} value={form.name} onChange={set("name")} maxLength={100} aria-required="true" />
          {fieldError("name")}
        </div>
        <div className="field">
          <label htmlFor="pub-id">ID (used in the link){isNew && <Required />}</label>
          <input {...check("id")} value={form.id} onChange={e => { setIdTouched(true); set("id")(e); }} readOnly={!isNew} aria-required={isNew} />
          {fieldError("id")}
        </div>
        <div className="field">
          <label htmlFor="pub-area">Area<Required /></label>
          <input {...check("area")} list="area-options" value={form.area} onChange={set("area")} maxLength={40} aria-required="true" />
          {fieldError("area")}
          <datalist id="area-options">{AREAS.map(a => <option key={a} value={a} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="pub-operator">Operator / owner</label>
          <input id="pub-operator" value={form.operator} onChange={set("operator")} maxLength={60} placeholder="e.g. Fuller's, Greene King, Independent" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pub-address">Address</label>
        <input id="pub-address" value={form.address} onChange={set("address")} maxLength={200} placeholder="e.g. 47 Chandos Place, London WC2N 4HS" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="pub-lat">Latitude</label>
          <input {...check("lat")} inputMode="decimal" value={form.lat} onChange={set("lat")} placeholder="51.5132" />
          {fieldError("lat")}
        </div>
        <div className="field">
          <label htmlFor="pub-lng">Longitude</label>
          <input {...check("lng")} inputMode="decimal" value={form.lng} onChange={set("lng")} placeholder="-0.1275" />
          {fieldError("lng")}
        </div>
        <div className="field">
          <label htmlFor="pub-year">Opened (year)</label>
          <input {...check("opened_year")} inputMode="numeric" value={form.opened_year} onChange={set("opened_year")} placeholder="e.g. 1772" />
          {fieldError("opened_year")}
        </div>
      </div>
      <p className="muted small-text">
        Tip: in Google Maps, right-click the pub and click the numbers to copy them, then paste both into Latitude.
        {osmLink && <> Or <ExternalLink href={osmLink}>look up the address on OpenStreetMap</ExternalLink>.</>}
      </p>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="pub-website">Website</label>
          <input {...check("website")} type="url" value={form.website} onChange={set("website")} placeholder="https://" />
          {fieldError("website")}
        </div>
        <div className="field">
          <label htmlFor="pub-menu">Drinks menu link</label>
          <input {...check("drinks_menu_url")} type="url" value={form.drinks_menu_url} onChange={set("drinks_menu_url")} placeholder="https://" />
          {fieldError("drinks_menu_url")}
        </div>
        <div className="field">
          <label htmlFor="pub-food-menu">Food menu link</label>
          <input {...check("food_menu_url")} type="url" value={form.food_menu_url} onChange={set("food_menu_url")} placeholder="https://" />
          {fieldError("food_menu_url")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="pub-description">Description / history (shown to the public)</label>
        <textarea id="pub-description" rows={3} value={form.description} onChange={set("description")} maxLength={1000} />
      </div>

      <fieldset className="tag-picker">
        <legend>Tags</legend>
        {TAGS.map(tag => (
          <label key={tag} className={`chip ${form.tags.includes(tag) ? "active" : ""}`}>
            <input type="checkbox" className="sr-only" checked={form.tags.includes(tag)} onChange={() => toggleTag(tag)} />
            {tag}
          </label>
        ))}
      </fieldset>

      <RequiredHint />
      <FormError>{error}</FormError>
      <div className="row-actions wrap">
        <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : isNew ? "Create pub" : "Save pub details"}</button>
        {!isNew && form.is_published && <Link className="secondary-button" to={`/pubs/${form.id}`}>View public page</Link>}
        {!isNew && !form.is_published && <Link className="secondary-button" to={`/pubs/${form.id}`}>Preview page</Link>}
      </div>
    </form>
  );
}
