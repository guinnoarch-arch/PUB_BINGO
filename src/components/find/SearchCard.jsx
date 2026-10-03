import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { CATEGORIES } from "../../data/seedPubs.js";
import { PUB_FILTERS } from "../../lib/core/pubFilters.js";
import NotLaunched from "../ui/NotLaunched.jsx";

// The search box, category chips and (when launched) pub filters at the top of Find.
// The search and category live in the address bar; updateParam(key, value) changes them.
export default function SearchCard({ query, category, updateParam, filtersOn, filters, toggleFilter }) {
  const { feature } = useApp();
  return (
    <section className="card search-card">
      <form role="search" onSubmit={event => event.preventDefault()}>
        <label htmlFor="pint-search" className="search-label">Find the cheapest pint of…</label>
        <div className="search-row">
          <input
            id="pint-search"
            type="search"
            value={query}
            onChange={event => updateParam("q", event.target.value)}
            placeholder="Guinness, IPA, Camden Hells…"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && <button type="button" className="secondary-button" onClick={() => updateParam("q", "")}>Clear</button>}
        </div>
      </form>
      <div className="chip-row" role="group" aria-label="Filter by category">
        <button type="button" className={`chip ${!category ? "active" : ""}`} aria-pressed={!category} onClick={() => updateParam("cat", "")}>All</button>
        {CATEGORIES.filter(c => c !== "Other").map(c => (
          <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} aria-pressed={category === c} onClick={() => updateParam("cat", category === c ? "" : c)}>{c}</button>
        ))}
      </div>
      {filtersOn && (
        <div className="chip-row" role="group" aria-label="Filter pubs">
          {PUB_FILTERS.map(f => (
            <button key={f.key} type="button" className={`chip ${filters.has(f.key) ? "active" : ""}`} aria-pressed={filters.has(f.key)} onClick={() => toggleFilter(f.key)}>{f.label}</button>
          ))}
          <NotLaunched feature="pub_filters" />
        </div>
      )}
      {filtersOn && filters.has("open") && <p className="muted small-text">“Open now” only includes pubs whose opening hours we have.</p>}
      {(feature("crawl_planner") || feature("round_calculator")) && (
        <div className="row-actions wrap tool-links">
          {feature("crawl_planner") && <span><Link className="secondary-button small" to="/crawl">🗺️ Plan a crawl</Link> <NotLaunched feature="crawl_planner" /></span>}
          {feature("round_calculator") && <span><Link className="secondary-button small" to="/round">🍻 Price a round</Link> <NotLaunched feature="round_calculator" /></span>}
        </div>
      )}
    </section>
  );
}
