import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { CATEGORIES } from "../data/seedPubs.js";
import { isDraught, pintPrice } from "../lib/core/prices.js";
import FavouriteButton from "../components/ui/FavouriteButton.jsx";
import { PriceTag, SourceBadge, UpdatedAgo } from "../components/ui/Badges.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import PubImage from "../components/pub/PubImage.jsx";
import ReportPriceForm from "../components/pub/ReportPriceForm.jsx";
import DrinkHistory from "../components/pub/DrinkHistory.jsx";
import PhotoSection from "../components/pub/PhotoSection.jsx";
import PubWhatsOn from "../components/events/PubWhatsOn.jsx";
import StillRightButton from "../components/features/StillRightButton.jsx";
import DealNote from "../components/features/DealNote.jsx";
import { CheckIn, PourScore, PubDeals, PubHours } from "../components/features/PubExtras.jsx";
import { applyDeals } from "../lib/core/deals.js";

export default function PubPage() {
  const { pubId } = useParams();
  const { api, changeVersion, isAdmin, feature, deals, clock } = useApp();
  const [pub, setPub] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reportDrinkId, setReportDrinkId] = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reportRef = useRef(null);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let active = true;
    api.getPub(pubId)
      .then(data => {
        if (!active) return;
        setPub(data);
        setStatus(data ? "ready" : "missing");
        if (data) document.title = `${data.name} · Pub Bingo`;
      })
      .catch(err => {
        if (!active) return;
        setError(friendlyError(err, "Couldn't load this pub."));
        setStatus(s => (s === "ready" ? "ready" : "error"));
      });
    return () => { active = false; };
  }, [api, pubId, changeVersion, reloadKey]);

  useEffect(() => () => { document.title = "Pub Bingo"; }, []);

  // Links like /pubs/the-harp#report jump straight to the report form.
  const { hash } = useLocation();
  useEffect(() => {
    if (status === "ready" && hash === "#report") {
      window.requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [status, hash]);

  // Happy-hour prices apply here too while a deal is on.
  const livePub = useMemo(() => (pub && feature("happy_hours") ? applyDeals([pub], deals, clock)[0] : pub), [pub, feature, deals, clock]);
  const drinks = useMemo(() => [...(livePub?.drinks || [])].sort((a, b) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
    || Number(isDraught(b.measure)) - Number(isDraught(a.measure))
    || Number(a.current_price) - Number(b.current_price)
  ), [livePub]);

  function startReport(drinkId) {
    setReportDrinkId(drinkId ?? "");
    window.requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (status === "loading") return <Loading label="Loading pub…" />;
  if (status === "error") return <ErrorState message={error} onRetry={() => { setStatus("loading"); reload(); }} />;
  if (status === "missing") {
    return <EmptyState title="Pub not found">That pub isn't in Pub Bingo (yet). <Link to="/">Back to search</Link></EmptyState>;
  }

  const age = pub.opened_year ? new Date().getFullYear() - pub.opened_year : null;
  const mapLink = `https://www.openstreetmap.org/?mlat=${pub.lat}&mlon=${pub.lng}#map=18/${pub.lat}/${pub.lng}`;

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">← All pubs</Link>
        {isAdmin && <Link to={`/admin/pubs/${pub.id}`} className="admin-link">Edit in admin</Link>}
      </nav>
      {pub.is_published === false && (
        <p className="app-banner warning" role="note">This pub is hidden from the public. Only admins can see this page.</p>
      )}

      <section className="card pub-hero">
        <div className="pub-hero-art">
          {pub.pub_photos?.find(p => !p.is_hidden)
            ? <img src={api.photoUrl(pub.pub_photos.find(p => !p.is_hidden).storage_path)} alt={`${pub.name}`} />
            : <PubImage pub={pub} />}
        </div>
        <div className="pub-hero-text">
          <p className="eyebrow">{pub.area}{pub.opened_year ? ` · Est. ${pub.opened_year}` : ""}{age ? ` (${age} years)` : ""}</p>
          <h2 className="pub-name">{pub.name}</h2>
          {pub.address && <p>{Number.isFinite(pub.lat) ? <a href={mapLink} target="_blank" rel="noreferrer">{pub.address}</a> : pub.address}</p>}
          {pub.website && <p><a href={pub.website} target="_blank" rel="noreferrer">Pub website ↗</a></p>}
          <PubHours pub={pub} />
          <ul className="tag-list" aria-label="Tags">
            {(pub.tags || []).map(tag => <li key={tag} className="tag">{tag}</li>)}
          </ul>
          <p>{pub.description}</p>
          <div className="row-actions wrap">
            <FavouriteButton pub={pub} />
            <button type="button" className="secondary-button" onClick={() => startReport(drinks[0]?.id)}>Report a price</button>
            <Link className="secondary-button" to={`/suggestions?menu=${encodeURIComponent(pub.id)}`}>📄 Send us the menu</Link>
            <CheckIn pub={pub} />
          </div>
        </div>
      </section>

      <PubDeals pub={pub} />
      <PubWhatsOn pub={pub} />

      <section className="card" aria-labelledby="drinks-heading">
        <div className="section-header">
          <h2 id="drinks-heading" className="section-title">Drinks ({drinks.length})</h2>
          <span className="muted small-text">
            <span className="badge badge-seed">Estimate</span> not yet confirmed · <span className="badge badge-community">Community</span> reported by a visitor · <span className="badge badge-website">Pub website</span> from the pub's site · <span className="badge badge-admin">Verified</span> checked by admin
          </span>
        </div>
        {drinks.length === 0 ? (
          <EmptyState title="No drinks listed yet">Add the first one with “Report a price”.</EmptyState>
        ) : (
          <ul className="drink-list">
            {drinks.map(drink => (
              <li key={drink.id}>
                <div className="drink-row">
                  <div className="drink-main">
                    <strong>{drink.name}</strong>
                    <span className="result-meta">
                      <span className="category-pill">{drink.category}</span>
                      <SourceBadge source={drink.source} url={drink.source_url} />
                      <UpdatedAgo value={drink.last_updated_at} />
                      <DealNote drink={drink} />
                    </span>
                  </div>
                  <PriceTag price={drink.current_price} measure={drink.measure} volumeMl={drink.volume_ml} pintPrice={pintPrice(drink.current_price, drink.measure, drink.volume_ml)} />
                  <div className="drink-actions">
                    <StillRightButton drink={drink} />
                    <button type="button" className="secondary-button small" onClick={() => startReport(drink.id)}>Update price</button>
                    <button
                      type="button"
                      className="text-button"
                      aria-expanded={openHistory === drink.id}
                      onClick={() => setOpenHistory(openHistory === drink.id ? null : drink.id)}
                    >
                      History
                    </button>
                  </div>
                </div>
                {openHistory === drink.id && <DrinkHistory drink={drink} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PourScore pub={pub} />

      <section className="card" id="report" ref={reportRef} aria-labelledby="report-heading">
        <h2 id="report-heading" className="section-title">Report a price</h2>
        <p className="muted small-text">Paid a different price? Tell everyone. Every report is kept, so we can show price trends.</p>
        <ReportPriceForm
          key={reportDrinkId ?? "default"}
          pub={pub}
          drinks={drinks}
          initialDrinkId={reportDrinkId || drinks[0]?.id || ""}
          onDone={() => setReportDrinkId(null)}
        />
      </section>

      <PhotoSection pub={pub} photos={pub.pub_photos || []} onChanged={reload} />
    </>
  );
}
