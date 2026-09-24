import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { PRICES_ONLINE_LABELS, adminTotals, filterRows, sortRows, summarisePub, toCsv } from "../lib/core/adminPubs.js";
import { timeAgo } from "../lib/core/time.js";
import LiveFeed from "../components/LiveFeed.jsx";
import AdminMenus from "../components/suggestions/AdminMenus.jsx";
import AdminFeatures from "../components/admin/AdminFeatures.jsx";
import AdminDigest from "../components/admin/AdminDigest.jsx";
import HeldReports from "../components/admin/HeldReports.jsx";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";

const COLUMNS = [
  ["name", "Pub"],
  ["published", "Status"],
  ["drinkCount", "Drinks"],
  ["verifiedPct", "Real prices"],
  ["lastPriceUpdate", "Last price update"],
  ["website", "Website"],
  ["pricesOnline", "Prices online?"],
  ["eventCount", "Events"],
  ["operator", "Operator"],
  ["missing", "Missing info"]
];

const FILTERS = [
  ["all", "All pubs"],
  ["published", "Live"],
  ["hidden", "Hidden"],
  ["needs-prices", "Has estimates"],
  ["no-website", "No website"],
  ["events-to-check", "Events to check"]
];

function downloadCsv(rows) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pub-bingo-pubs-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function PubsTable() {
  const { api, changeVersion } = useApp();
  const navigate = useNavigate();
  const [pubs, setPubs] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    api.admin.listPubs()
      .then(rows => { if (active) { setPubs(rows); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load pubs.")));
    return () => { active = false; };
  }, [api, changeVersion, retry]);

  const allRows = useMemo(() => (pubs || []).map(summarisePub), [pubs]);
  const rows = useMemo(() => sortRows(filterRows(allRows, { text, status }), sort.key, sort.direction), [allRows, text, status, sort]);
  const totals = adminTotals(allRows);

  const toggleSort = key => setSort(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));

  if (error) return <ErrorState message={error} onRetry={() => setRetry(r => r + 1)} />;
  if (!pubs) return <Loading label="Loading pubs…" />;

  return (
    <>
      <div className="stat-strip" aria-label="Summary">
        <div><strong>{totals.pubs}</strong><span>pubs</span></div>
        <div><strong>{totals.published}</strong><span>live</span></div>
        <div><strong>{totals.hidden}</strong><span>hidden</span></div>
        <div><strong>{totals.drinks}</strong><span>drinks</span></div>
        <div><strong>{totals.verifiedPct}%</strong><span>real prices</span></div>
        <div><strong>{totals.withWebsite}</strong><span>with website</span></div>
      </div>

      <div className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-search">Search pubs</label>
        <input id="admin-search" type="search" placeholder="Search name, area, operator…" value={text} onChange={e => setText(e.target.value)} />
        <label className="sr-only" htmlFor="admin-filter">Show</label>
        <select id="admin-filter" value={status} onChange={e => setStatus(e.target.value)}>
          {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className="secondary-button" onClick={() => downloadCsv(rows)}>Download CSV</button>
        <Link className="primary-button" to="/admin/pubs/new">+ Add pub</Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No pubs match">Try a different search or filter.</EmptyState>
      ) : (
        <div className="sheet-wrap" role="region" aria-label="Pubs table" tabIndex={0}>
          <table className="sheet">
            <thead>
              <tr>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} scope="col" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggleSort(key)}>
                      {label}{sort.key === key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} onClick={() => navigate(`/admin/pubs/${row.id}`)} className={row.published ? "" : "row-hidden"}>
                  <th scope="row">
                    <Link to={`/admin/pubs/${row.id}`} onClick={e => e.stopPropagation()}>{row.name}</Link>
                    <span className="muted">{row.area}</span>
                  </th>
                  <td><span className={`status-pill ${row.published ? "live" : "hidden"}`}>{row.published ? "Live" : "Hidden"}</span></td>
                  <td className="num">{row.drinkCount}</td>
                  <td>
                    <span className={`meter ${row.verifiedPct >= 75 ? "good" : row.verifiedPct >= 25 ? "mid" : "low"}`} title={`${row.bySource.seed} estimates · ${row.bySource.community} community · ${row.bySource.website} from website · ${row.bySource.admin} checked by admin`}>
                      {row.verifiedPct}%
                    </span>
                    <span className="muted small-text"> {row.verifiedCount}/{row.drinkCount}</span>
                  </td>
                  <td>{row.lastPriceUpdate ? timeAgo(row.lastPriceUpdate) : "–"}</td>
                  <td>
                    {row.website
                      ? <a href={row.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Yes ↗</a>
                      : <span className="muted">None</span>}
                  </td>
                  <td>
                    <span className={`prices-online ${row.pricesOnline}`}>{PRICES_ONLINE_LABELS[row.pricesOnline]}</span>
                    {row.menuUrl && <a className="small-text" href={row.menuUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}> menu ↗</a>}
                  </td>
                  <td className="num">
                    {row.eventCount}
                    {row.eventsToCheck > 0 && <span className="to-check" title="Events waiting to be checked and published"> +{row.eventsToCheck} to check</span>}
                  </td>
                  <td>{row.operator || <span className="muted">–</span>}</td>
                  <td className="small-text">{row.missing.length ? row.missing.join(", ") : <span className="ok-text">Complete</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small-text">
        “Real prices” = drinks whose current price came from the community, a pub website or an admin check, rather than a starting estimate. Click a row to see and edit the pub.
      </p>
    </>
  );
}

const TABS = [
  ["pubs", "Pubs", "Pubs"],
  ["week", "This week", "Week"],
  ["menus", "Menus sent in", "Menus"],
  ["reports", "Price reports", "Reports"],
  ["features", "Features", "Features"]
];

export default function AdminPage() {
  const { api, authReady, isAdmin } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get("tab")) ? params.get("tab") : "pubs";
  const setTab = useCallback(next => setParams(next === "pubs" ? {} : { tab: next }, { replace: true }), [setParams]);
  const [menus, setMenus] = useState(null);
  const [menusError, setMenusError] = useState("");
  const [menusKey, setMenusKey] = useState(0);
  const reloadMenus = useCallback(() => setMenusKey(k => k + 1), []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.admin.listMenuSubmissions()
      .then(rows => { if (active) { setMenus(rows); setMenusError(""); } })
      .catch(err => active && setMenusError(friendlyError(err, "Couldn't load menus sent in.")));
    return () => { active = false; };
  }, [api, isAdmin, menusKey]);
  const newMenus = (menus || []).filter(m => m.status === "new").length;

  if (!authReady) return <Loading />;
  if (!isAdmin) {
    return <section className="card"><EmptyState title="Admins only">This page is for Pub Bingo admins. <Link to="/">Back to search</Link></EmptyState></section>;
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>{TABS.find(([key]) => key === tab)[1]}</h2>
        </div>
        <div className="segmented" role="tablist" aria-label="Admin sections">
          {TABS.map(([key, , short]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {short}{key === "menus" && newMenus > 0 && <span className="tab-count" aria-label={`${newMenus} new`}>{newMenus}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === "pubs" && <section className="card"><PubsTable /></section>}
      {tab === "menus" && (
        <section className="card" aria-label="Menus sent in">
          {menusError ? <ErrorState message={menusError} onRetry={reloadMenus} />
            : menus === null ? <Loading label="Loading menus…" />
              : <AdminMenus items={menus} onChanged={reloadMenus} />}
        </section>
      )}
      {tab === "week" && <section className="card" aria-label="This week"><AdminDigest /></section>}
      {tab === "features" && <section className="card" aria-label="Features"><AdminFeatures /></section>}
      {tab === "reports" && <HeldReports />}
      {tab === "reports" && (
        <section className="card" aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="section-title">Recent price reports</h2>
          <p className="muted small-text">Hiding a report removes it from public view and puts the drink back to its previous price.</p>
          <LiveFeed limit={50} />
        </section>
      )}
    </>
  );
}
