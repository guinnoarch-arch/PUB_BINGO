import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { allWatchMatches } from "../../lib/core/watches.js";
import { formatPrice, parsePrice } from "../../lib/core/prices.js";
import { AREAS } from "../../data/seedPubs.js";
import NotLaunched from "../ui/NotLaunched.jsx";
import { ErrorSummary, FieldError, FormError } from "../ui/FormErrors.jsx";
import { usePending } from "../../lib/usePending.js";

export function useWatchMatches() {
  const { livePubs, priceWatches, feature } = useApp();
  return useMemo(() => (feature("price_watch") ? allWatchMatches(livePubs, priceWatches) : []), [livePubs, priceWatches, feature]);
}

export default function PriceWatches() {
  const { api, feature, reloadWatches, toast } = useApp();
  const results = useWatchMatches();
  const [query, setQuery] = useState("");
  const [max, setMax] = useState("6.00");
  const [area, setArea] = useState("");
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState("");
  const { run, isPending } = usePending();
  if (!feature("price_watch")) return null;

  async function add(event) {
    event.preventDefault();
    setServerError("");
    const price = parsePrice(max);
    const found = {};
    if (query.trim().length < 2) found.query = "Type a drink, like Guinness or IPA.";
    if (price == null) found.max = "Enter the most you'd pay, like 6.00.";
    setErrors(found);
    setAttempt(a => a + 1);
    if (Object.keys(found).length) return;
    await run("add", async () => {
      try {
        await api.addPriceWatch({ query: query.trim(), maxPrice: price, area });
        setQuery("");
        reloadWatches();
        toast("Price watch saved. Matches show here and on the Saved tab.", "success");
      } catch (err) {
        setServerError(friendlyError(err, "Couldn't save the price watch. Check your connection and try again."));
      }
    });
  }

  // Removing offers Undo, which adds the same watch back.
  const remove = watch => run(watch.id, async () => {
    try {
      await api.deletePriceWatch(watch.id);
      reloadWatches();
      toast(`Stopped watching ${watch.query}.`, "info", {
        action: {
          label: "Undo",
          onClick: () => api.addPriceWatch({ query: watch.query, maxPrice: Number(watch.max_price), area: watch.area || "" })
            .then(reloadWatches)
            .catch(err => toast(friendlyError(err, "Couldn't restore the price watch."), "error"))
        }
      });
    } catch (err) {
      toast(friendlyError(err, "Couldn't remove the price watch. Try again."), "error");
    }
  });

  return (
    <section className="card" aria-labelledby="watch-heading">
      <div className="section-header">
        <h2 id="watch-heading" className="section-title">🔔 Price watches</h2>
        <NotLaunched feature="price_watch" />
      </div>
      <p className="muted small-text">Get told when a drink turns up under your price. Matches use confirmed pint prices (including happy hours while they're on).</p>
      <ErrorSummary errors={errors} fieldIds={{ query: "watch-q", max: "watch-max" }} attempt={attempt} />
      <form className="watch-form" onSubmit={add} noValidate>
        <div className="field">
          <label htmlFor="watch-q">Drink</label>
          <input id="watch-q" value={query} onChange={e => { setQuery(e.target.value); setErrors(prev => ({ ...prev, query: undefined })); }} placeholder="Guinness, IPA…" aria-invalid={Boolean(errors.query)} aria-describedby={errors.query ? "watch-q-error" : undefined} />
          <FieldError id="watch-q-error">{errors.query}</FieldError>
        </div>
        <div className="field">
          <label htmlFor="watch-max">Under</label>
          <div className="price-input"><span aria-hidden="true">£</span><input id="watch-max" inputMode="decimal" value={max} onChange={e => { setMax(e.target.value); setErrors(prev => ({ ...prev, max: undefined })); }} aria-invalid={Boolean(errors.max)} aria-describedby={errors.max ? "watch-max-error" : undefined} /></div>
          <FieldError id="watch-max-error">{errors.max}</FieldError>
        </div>
        <div className="field"><label htmlFor="watch-area">Area</label>
          <select id="watch-area" value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Anywhere</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button type="submit" className="primary-button" disabled={isPending("add")}>{isPending("add") ? "Saving…" : "Watch"}</button>
      </form>
      <FormError>{serverError}</FormError>
      {results.length > 0 && (
        <ul className="watch-list">
          {results.map(({ watch, matches }) => (
            <li key={watch.id}>
              <div className="section-header">
                <strong>{watch.query} under {formatPrice(watch.max_price)}{watch.area ? ` in ${watch.area}` : ""}</strong>
                <button type="button" className="text-button danger" disabled={isPending(watch.id)} onClick={() => remove(watch)}>Remove</button>
              </div>
              {matches.length === 0 ? <span className="muted small-text">No matches right now.</span> : (
                <ul className="match-list">
                  {matches.slice(0, 5).map(m => (
                    <li key={m.drink.id}>🎯 <Link to={`/pubs/${m.pub.id}`}>{m.drink.name} at {m.pub.name}</Link> <strong>{formatPrice(m.pintPrice)}</strong>{m.drink.deal ? ` (until ${m.drink.deal.until})` : ""}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
