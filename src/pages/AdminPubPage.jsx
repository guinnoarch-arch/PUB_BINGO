import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { AREAS, CATEGORIES, TAGS } from "../data/seedPubs.js";
import { PRICES_ONLINE_LABELS, canPublish, missingInfo, one, slugify } from "../lib/core/adminPubs.js";
import { MEASURES, formatPrice, isDraught, measureLabel, parsePrice, pintPrice } from "../lib/core/prices.js";
import { timeAgo } from "../lib/core/time.js";
import { SourceBadge } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import DrinkHistory from "../components/pub/DrinkHistory.jsx";
import AdminEvents from "../components/events/AdminEvents.jsx";
import MenuImport from "../components/pub/MenuImport.jsx";

const EMPTY_PUB = {
  id: "", name: "", area: "Soho", address: "", lat: "", lng: "", opened_year: "", tags: [], description: "",
  website: "", drinks_menu_url: "", operator: "", is_published: false, uploads_paused: false
};

function toForm(pub) {
  const text = v => (v == null ? "" : String(v));
  return {
    ...EMPTY_PUB, ...pub,
    address: text(pub.address), lat: text(pub.lat), lng: text(pub.lng), opened_year: text(pub.opened_year),
    website: text(pub.website), drinks_menu_url: text(pub.drinks_menu_url), operator: text(pub.operator),
    description: text(pub.description), tags: pub.tags || []
  };
}

// Accepts "51.5134, -0.1318" pasted from a map app into the latitude box.
function splitCoordinates(value) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  return match ? { lat: match[1], lng: match[2] } : null;
}

function PubDetailsForm({ pub, isNew, onSaved }) {
  const { api, toast, reloadPubs } = useApp();
  const [form, setForm] = useState(() => toForm(pub || EMPTY_PUB));
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
          <label htmlFor="pub-name">Pub name</label>
          <input id="pub-name" value={form.name} onChange={set("name")} maxLength={100} required />
        </div>
        <div className="field">
          <label htmlFor="pub-id">ID (used in the link)</label>
          <input id="pub-id" value={form.id} onChange={e => { setIdTouched(true); set("id")(e); }} readOnly={!isNew} pattern="[a-z0-9-]+" />
        </div>
        <div className="field">
          <label htmlFor="pub-area">Area</label>
          <input id="pub-area" list="area-options" value={form.area} onChange={set("area")} maxLength={40} />
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
          <input id="pub-lat" inputMode="decimal" value={form.lat} onChange={set("lat")} placeholder="51.5132" />
        </div>
        <div className="field">
          <label htmlFor="pub-lng">Longitude</label>
          <input id="pub-lng" inputMode="decimal" value={form.lng} onChange={set("lng")} placeholder="-0.1275" />
        </div>
        <div className="field">
          <label htmlFor="pub-year">Opened (year)</label>
          <input id="pub-year" inputMode="numeric" value={form.opened_year} onChange={set("opened_year")} placeholder="e.g. 1772" />
        </div>
      </div>
      <p className="muted small-text">
        Tip: in Google Maps, right-click the pub and click the numbers to copy them, then paste both into Latitude.
        {osmLink && <> Or <a href={osmLink} target="_blank" rel="noreferrer">look up the address on OpenStreetMap ↗</a>.</>}
      </p>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="pub-website">Website</label>
          <input id="pub-website" type="url" value={form.website} onChange={set("website")} placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor="pub-menu">Drinks menu link</label>
          <input id="pub-menu" type="url" value={form.drinks_menu_url} onChange={set("drinks_menu_url")} placeholder="https://" />
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

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions wrap">
        <button type="submit" className="primary-button" disabled={saving || !form.id || !form.name}>{saving ? "Saving…" : isNew ? "Create pub" : "Save pub details"}</button>
        {!isNew && form.is_published && <Link className="secondary-button" to={`/pubs/${form.id}`}>View public page</Link>}
        {!isNew && !form.is_published && <Link className="secondary-button" to={`/pubs/${form.id}`}>Preview page</Link>}
      </div>
    </form>
  );
}

function ResearchNotes({ pub, onSaved }) {
  const { api, toast } = useApp();
  const admin = one(pub.pub_admin) || {};
  const [pricesOnline, setPricesOnline] = useState(admin.prices_online || "unknown");
  const [notes, setNotes] = useState(admin.notes || "");
  const [markChecked, setMarkChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await api.admin.savePubAdmin(pub.id, { pricesOnline, notes, markChecked });
      setPricesOnline(saved?.prices_online || pricesOnline);
      setNotes(saved?.notes ?? notes);
      toast("Notes saved.", "success");
      setMarkChecked(false);
      onSaved();
    } catch (err) {
      toast(friendlyError(err, "Couldn't save notes."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="row-actions wrap">
        {pub.website && <a className="secondary-button small" href={pub.website} target="_blank" rel="noreferrer">Open website ↗</a>}
        {pub.drinks_menu_url && <a className="secondary-button small" href={pub.drinks_menu_url} target="_blank" rel="noreferrer">Open drinks menu ↗</a>}
        <a className="secondary-button small" href={`https://www.google.com/search?q=${encodeURIComponent(`${pub.name} ${pub.address || "London"} drinks menu prices`)}`} target="_blank" rel="noreferrer">Search the web ↗</a>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="prices-online">Are prices published online?</label>
          <select id="prices-online" value={pricesOnline} onChange={e => setPricesOnline(e.target.value)}>
            {Object.entries(PRICES_ONLINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">Prices last checked</span>
          <span>{admin.prices_checked_at ? `${timeAgo(admin.prices_checked_at)} (${new Date(admin.prices_checked_at).toLocaleDateString("en-GB")})` : "Never"}</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="admin-notes">Research notes (admins only)</label>
        <textarea id="admin-notes" rows={6} value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={markChecked} onChange={e => setMarkChecked(e.target.checked)} />
        I've checked this pub's prices today
      </label>
      <div><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save notes"}</button></div>
    </form>
  );
}

function SetPriceForm({ pub, drink, onDone, onCancel }) {
  const { api, toast, notifyChange } = useApp();
  const isNew = !drink;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [measure, setMeasure] = useState(drink?.measure || "pint");
  const [price, setPrice] = useState(drink ? String(drink.current_price) : "");
  const [source, setSource] = useState(pub.drinks_menu_url || pub.website ? "website" : "admin");
  const [sourceUrl, setSourceUrl] = useState(pub.drinks_menu_url || pub.website || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setError("");
    const value = parsePrice(price);
    if (value == null) { setError("Enter a price like 6.20"); return; }
    setSaving(true);
    try {
      await api.admin.setDrinkPrice({
        pubId: pub.id,
        drinkId: drink?.id || null,
        drinkName: isNew ? name : null,
        category: isNew ? category : null,
        measure: isNew ? measure : null,
        price: value,
        source,
        sourceUrl: source === "website" ? sourceUrl.trim() : sourceUrl.trim() || null,
        note: note.trim() || null
      });
      toast(`${isNew ? name : drink.name}: ${formatPrice(value)} saved.`, "success");
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
      {isNew && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="new-drink-name">Drink name</label>
            <input id="new-drink-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="e.g. London Pride" />
          </div>
          <div className="field">
            <label htmlFor="new-drink-category">Category</label>
            <select id="new-drink-category" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Choose…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-drink-measure">Measure</label>
            <select id="new-drink-measure" value={measure} onChange={e => setMeasure(e.target.value)}>
              {MEASURES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`price-${drink?.id || "new"}`}>Price{drink && drink.measure !== "pint" ? ` per ${measureLabel(drink.measure, drink.volume_ml)}` : ""}</label>
          <div className="price-input"><span aria-hidden="true">£</span><input id={`price-${drink?.id || "new"}`} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor={`source-${drink?.id || "new"}`}>Where's it from?</label>
          <select id={`source-${drink?.id || "new"}`} value={source} onChange={e => setSource(e.target.value)}>
            <option value="website">The pub's website / menu</option>
            <option value="admin">I checked it in person / by phone</option>
          </select>
        </div>
        <div className="field grow">
          <label htmlFor={`url-${drink?.id || "new"}`}>{source === "website" ? "Link to the page" : "Link (optional)"}</label>
          <input id={`url-${drink?.id || "new"}`} type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://" />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`note-${drink?.id || "new"}`}>Note (optional, shown in history)</label>
        <input id={`note-${drink?.id || "new"}`} value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="e.g. from menu dated Sept 2026" />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : isNew ? "Add drink" : "Save price"}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function EditDrinkForm({ drink, onDone, onCancel }) {
  const { api, toast, notifyChange } = useApp();
  const [name, setName] = useState(drink.name);
  const [category, setCategory] = useState(drink.category);
  const [measure, setMeasure] = useState(drink.measure);
  const [volume, setVolume] = useState(drink.volume_ml ? String(drink.volume_ml) : "");
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    try {
      const volumeMl = !isDraught(measure) && volume.trim() ? Number(volume) : null;
      if (volumeMl !== null && !(volumeMl >= 100 && volumeMl <= 2000)) { setError("Size must be 100-2000 ml"); return; }
      await api.admin.updateDrink(drink.id, { name, category, measure, volumeMl });
      toast("Drink updated.", "success");
      notifyChange();
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <form className="set-price-form" onSubmit={save}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`edit-name-${drink.id}`}>Name</label>
          <input id={`edit-name-${drink.id}`} value={name} onChange={e => setName(e.target.value)} maxLength={60} />
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
            <input id={`edit-volume-${drink.id}`} inputMode="numeric" value={volume} onChange={e => setVolume(e.target.value)} placeholder="e.g. 330" />
          </div>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="primary-button">Save</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function DrinksTable({ pub, onChanged }) {
  const { api, toast, notifyChange } = useApp();
  const [open, setOpen] = useState(null); // { id, mode: "price" | "edit" | "history" } or { id: "new" }
  const drinks = useMemo(() => [...(pub.drinks || [])].sort((a, b) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)), [pub.drinks]);
  const done = () => { setOpen(null); onChanged(); };

  async function remove(drink) {
    if (!window.confirm(`Delete ${drink.name} and its whole price history?`)) return;
    try {
      await api.admin.deleteDrink(drink.id);
      toast(`${drink.name} deleted.`, "success");
      notifyChange();
      onChanged();
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  return (
    <>
      {drinks.length === 0 ? (
        <EmptyState title="No drinks yet">Add the first one below.</EmptyState>
      ) : (
        <div className="sheet-wrap" role="region" aria-label="Drinks" tabIndex={0}>
          <table className="sheet drinks-sheet">
            <thead>
              <tr>
                <th scope="col">Drink</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Source</th>
                <th scope="col">Updated</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {drinks.map(drink => (
                <DrinkRow key={drink.id} pub={pub} drink={drink} open={open?.id === drink.id ? open.mode : null}
                  setOpen={mode => setOpen(mode ? { id: drink.id, mode } : null)} onDone={done} onRemove={() => remove(drink)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open?.id === "new" ? (
        <div className="inline-panel">
          <h3 className="section-title">Add a drink</h3>
          <SetPriceForm pub={pub} onDone={done} onCancel={() => setOpen(null)} />
        </div>
      ) : (
        <button type="button" className="secondary-button" onClick={() => setOpen({ id: "new" })}>+ Add a drink</button>
      )}
    </>
  );
}

function DrinkRow({ pub, drink, open, setOpen, onDone, onRemove }) {
  return (
    <>
      <tr>
        <th scope="row">{drink.name}{drink.measure !== "pint" ? <span className="muted"> ({measureLabel(drink.measure, drink.volume_ml)})</span> : null}</th>
        <td>{drink.category}</td>
        <td className="num">
          {formatPrice(drink.current_price)}
          {drink.measure !== "pint" && pintPrice(drink.current_price, drink.measure, drink.volume_ml) != null && (
            <span className="muted small-text"> ≈ {formatPrice(pintPrice(drink.current_price, drink.measure, drink.volume_ml))}/pint</span>
          )}
        </td>
        <td><SourceBadge source={drink.source} url={drink.source_url} /></td>
        <td>{timeAgo(drink.last_updated_at)}</td>
        <td className="row-actions">
          <button type="button" className="secondary-button small" aria-expanded={open === "price"} onClick={() => setOpen(open === "price" ? null : "price")}>Set price</button>
          <button type="button" className="text-button" aria-expanded={open === "history"} onClick={() => setOpen(open === "history" ? null : "history")}>History</button>
          <button type="button" className="text-button" aria-expanded={open === "edit"} onClick={() => setOpen(open === "edit" ? null : "edit")}>Edit</button>
          <button type="button" className="text-button danger" onClick={onRemove}>Delete</button>
        </td>
      </tr>
      {open && (
        <tr className="expanded-row">
          <td colSpan={6}>
            {open === "price" && <SetPriceForm pub={pub} drink={drink} onDone={onDone} onCancel={() => setOpen(null)} />}
            {open === "edit" && <EditDrinkForm drink={drink} onDone={onDone} onCancel={() => setOpen(null)} />}
            {open === "history" && <DrinkHistory drink={drink} />}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminPubPage() {
  const { pubId } = useParams();
  const isNew = pubId === "new";
  const navigate = useNavigate();
  const { api, authReady, isAdmin, changeVersion, toast } = useApp();
  const [pub, setPub] = useState(null);
  const [status, setStatus] = useState(isNew ? "ready" : "loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pausedOverride, setPausedOverride] = useState(null);
  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (isNew || !isAdmin) return undefined;
    let active = true;
    api.admin.getPub(pubId)
      .then(data => { if (active) { setPub(data); setStatus(data ? "ready" : "missing"); } })
      .catch(err => { if (active) { setError(friendlyError(err)); setStatus("error"); } });
    return () => { active = false; };
  }, [api, pubId, isNew, isAdmin, changeVersion, reloadKey]);

  if (!authReady) return <Loading />;
  if (!isAdmin) return <section className="card"><EmptyState title="Admins only"><Link to="/">Back to search</Link></EmptyState></section>;
  if (status === "loading") return <Loading label="Loading pub…" />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;
  if (status === "missing") return <section className="card"><EmptyState title="Pub not found"><Link to="/admin">Back to all pubs</Link></EmptyState></section>;

  // Optimistic: the switch moves straight away and rolls back if saving fails.
  async function setPaused(paused) {
    setPausedOverride(paused);
    try {
      await api.admin.setUploadsPaused(pub.id, paused);
      toast(paused ? "Photo uploads paused." : "Photo uploads open.", "success");
      setPub(prev => ({ ...prev, uploads_paused: paused }));
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setPausedOverride(null);
    }
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/admin">← All pubs</Link></nav>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Admin · {isNew ? "New pub" : pub.area}</p>
          <h2>{isNew ? "Add a pub" : pub.name}</h2>
        </div>
        {!isNew && <span className={`status-pill ${pub.is_published ? "live" : "hidden"}`}>{pub.is_published ? "Live" : "Hidden"}</span>}
      </div>

      <section className="card" aria-labelledby="details-heading">
        <h2 id="details-heading" className="section-title">Pub details</h2>
        <PubDetailsForm
          key={isNew ? "new" : pub.id}
          pub={pub}
          isNew={isNew}
          onSaved={saved => (isNew ? navigate(`/admin/pubs/${saved.id}`, { replace: true }) : reload())}
        />
      </section>

      {!isNew && (
        <>
          <section className="card" aria-labelledby="drinks-heading">
            <div className="section-header">
              <h2 id="drinks-heading" className="section-title">Drinks and prices ({(pub.drinks || []).length})</h2>
            </div>
            <p className="muted small-text">
              Use “Set price” when you've read a price on the pub's own menu (add the link) or checked it in person. It's saved in the drink's history and shown with a “Pub website” or “Verified” badge.
            </p>
            <DrinksTable pub={pub} onChanged={reload} />
          </section>

          <section className="card" aria-labelledby="menu-import-heading">
            <h2 id="menu-import-heading" className="section-title">Import prices from a PDF menu</h2>
            <MenuImport pub={pub} onImported={reload} />
          </section>

          <section className="card" aria-labelledby="events-admin-heading">
            <h2 id="events-admin-heading" className="section-title">What's on (events)</h2>
            <p className="muted small-text">Events found by web research start as “Needs checking”. Check the source, fix the details if needed, then publish. Features like beer garden or sport on TV are the tags in Pub details above.</p>
            <AdminEvents pub={pub} />
          </section>

          <section className="card" aria-labelledby="research-heading">
            <h2 id="research-heading" className="section-title">Price research (admins only)</h2>
            <ResearchNotes key={pub.id} pub={pub} onSaved={reload} />
          </section>

          <section className="card" aria-labelledby="photos-admin-heading">
            <h2 id="photos-admin-heading" className="section-title">Photos</h2>
            <label className="admin-toggle">
              <input type="checkbox" checked={pausedOverride ?? Boolean(pub.uploads_paused)} disabled={pausedOverride !== null} onChange={e => setPaused(e.target.checked)} />
              Pause photo uploads for this pub
            </label>
            <p className="muted small-text">Hide or delete individual photos from the <Link to={`/pubs/${pub.id}`}>pub's page</Link>.</p>
          </section>
        </>
      )}
    </>
  );
}
