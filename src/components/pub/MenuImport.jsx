import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { CATEGORIES } from "../../data/seedPubs.js";
import { buildImportRows, parseMenuLines } from "../../lib/core/menuImport.js";
import { extractPdfLines, validateMenuFile } from "../../lib/pdfText.js";
import { formatPrice, parsePrice } from "../../lib/core/prices.js";
import { timeAgo } from "../../lib/core/time.js";

// Admin: upload a PDF drinks menu, read the prices from it, review, then save them as
// "Pub website" prices that link back to the uploaded PDF.
// With a `submission` (a PDF a user sent in), it reads that file instead. Those stay private, so the
// prices are saved as "Verified" with the date the menu was seen, and no public link.
export default function MenuImport({ pub, submission = null, onImported }) {
  const { api, userId, toast, notifyChange } = useApp();
  const fileRef = useRef(null);
  const [stage, setStage] = useState("idle"); // idle | reading | review | saving
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(null);
  const [lines, setLines] = useState([]);
  const [rows, setRows] = useState([]);
  const [showOther, setShowOther] = useState(false);
  const [menus, setMenus] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.admin.listMenus(pub.id).then(list => active && setMenus(list)).catch(() => {});
    return () => { active = false; };
  }, [api, pub.id, reloadKey]);

  async function read(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    const problem = validateMenuFile(file);
    if (problem) { setError(problem); return; }
    await process(file, () => api.admin.uploadMenu(userId, pub.id, file));
  }

  async function readSubmission() {
    setError("");
    setStage("reading");
    try {
      const file = await api.admin.menuSubmissionFile(submission);
      const viewUrl = await api.admin.menuSubmissionUrl(submission.storage_path).catch(() => "");
      await process(file, async () => ({ file_name: submission.file_name, viewUrl, submission }));
    } catch (err) {
      setError(friendlyError(err, "Couldn't open the menu that was sent in."));
      setStage("idle");
    }
  }

  async function process(file, store) {
    setError("");
    setStage("reading");
    try {
      const { lines: found } = await extractPdfLines(file);
      if (!found.length) {
        setError("No text found in this PDF. It's probably a scan or photo. Enter the prices by hand with “Set price”, or send the PDF to Claude to read.");
        setStage("idle");
        return;
      }
      const candidates = parseMenuLines(found);
      const uploaded = await store();
      setMenu(uploaded);
      setLines(found);
      setRows(buildImportRows(candidates, pub.drinks || []).map(r => ({ ...r, price: r.price.toFixed(2) })));
      setStage("review");
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(friendlyError(err, "Couldn't read that PDF."));
      setStage("idle");
    }
  }

  const update = (key, patch) => setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const visibleRows = useMemo(() => rows.filter(r => showOther || r.draught || r.drinkId), [rows, showOther]);
  const selected = rows.filter(r => r.selected);

  async function save() {
    setStage("saving");
    let saved = 0;
    const failures = [];
    for (const row of selected) {
      const price = parsePrice(String(row.price));
      if (price == null) { failures.push(`${row.name}: price isn't a number`); continue; }
      const sent = menu.submission;
      try {
        await api.admin.setDrinkPrice({
          pubId: pub.id,
          drinkId: row.drinkId,
          drinkName: row.drinkId ? null : row.name,
          category: row.drinkId ? null : row.category,
          measure: row.drinkId ? null : row.measure,
          price,
          source: sent ? "admin" : "website",
          sourceUrl: sent ? null : menu.url,
          note: (sent ? `From a menu sent in${sent.sender?.username ? ` by @${sent.sender.username}` : ""}` : `From menu: ${menu.file_name}`).slice(0, 200),
          observedOn: sent ? sent.seen_on : null
        });
        saved += 1;
      } catch (err) {
        failures.push(`${row.name}: ${friendlyError(err)}`);
      }
    }
    if (menu.submission) {
      if (saved) await api.admin.reviewMenuSubmission(menu.submission.id, { status: "used", note: menu.submission.admin_note, pricesImported: saved }).catch(() => {});
    } else {
      await api.admin.markMenuImported(menu.id, saved).catch(() => {});
    }
    notifyChange();
    onImported?.();
    setReloadKey(k => k + 1);
    if (failures.length) {
      setError(`Saved ${saved}. Not saved: ${failures.join("; ")}`);
      setRows(prev => prev.filter(r => !r.selected || failures.some(f => f.startsWith(`${r.name}:`))));
      setStage("review");
    } else {
      toast(`${saved} price${saved === 1 ? "" : "s"} imported from ${menu.file_name}.`, "success");
      setStage("idle");
      setRows([]);
      setMenu(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="menu-import">
      {submission && stage !== "review" && stage !== "saving" && (
        <div className="inline-panel">
          <p><strong>📄 {submission.file_name}</strong> <span className="muted small-text">sent in, seen {submission.seen_on}</span></p>
          <button type="button" className="primary-button" onClick={readSubmission} disabled={stage === "reading"}>{stage === "reading" ? "Reading menu…" : "Read prices from the menu sent in"}</button>
          <p className="muted small-text">Prices are saved as “Verified” with the menu's date. The file stays private.</p>
        </div>
      )}
      {stage !== "review" && stage !== "saving" && (
        <form className="upload-form" onSubmit={read}>
          <label htmlFor={`menu-file-${pub.id}`}>PDF drinks menu</label>
          <input id={`menu-file-${pub.id}`} ref={fileRef} type="file" accept="application/pdf,.pdf" />
          <button type="submit" className="primary-button" disabled={stage === "reading"}>{stage === "reading" ? "Reading menu…" : "Upload and read prices"}</button>
          <p className="muted small-text">The menu is saved with the pub, and each imported price links to it. You'll check every price before anything is saved.</p>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      {(stage === "review" || stage === "saving") && (
        <div className="import-review">
          <div className="section-header">
            <h3 className="section-title">Found {rows.length} price{rows.length === 1 ? "" : "s"} in {menu.file_name}</h3>
            <a className="text-button" href={menu.viewUrl || menu.url} target="_blank" rel="noreferrer">Open PDF ↗</a>
          </div>
          <p className="muted small-text">
            Ticked rows will be saved. Matches to drinks already listed are ticked when the price has changed. New drinks start unticked: tick the ones you want to add. Check names and prices against the PDF.
          </p>
          <div className="row-actions wrap">
            <button type="button" className="secondary-button small" onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: Boolean(r.drinkId) })))}>Tick all matches</button>
            <button type="button" className="secondary-button small" onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}>Untick all</button>
            <label className="checkbox-label"><input type="checkbox" checked={showOther} onChange={e => setShowOther(e.target.checked)} /> Show bottles, wine and spirits too</label>
          </div>

          {visibleRows.length === 0 ? (
            <p className="status-message">No draught prices recognised. Tick “Show bottles…” or check the text found below.</p>
          ) : (
            <div className="sheet-wrap" role="region" aria-label="Prices found in the menu" tabIndex={0}>
              <table className="sheet import-sheet">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Save</span></th>
                    <th scope="col">Drink</th>
                    <th scope="col">Measure</th>
                    <th scope="col">Menu price</th>
                    <th scope="col">Now</th>
                    <th scope="col">On the menu</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(row => {
                    const price = parsePrice(String(row.price));
                    const diff = row.currentPrice != null && price != null ? price - row.currentPrice : null;
                    return (
                      <tr key={row.key} className={row.selected ? "row-selected" : ""}>
                        <td><input type="checkbox" aria-label={`Save ${row.name}`} checked={row.selected} onChange={e => update(row.key, { selected: e.target.checked })} /></td>
                        <td>
                          {row.drinkId ? (
                            <>
                              <strong>{row.name}</strong> <span className="status-pill live">Matched</span>
                              {row.manual && <button type="button" className="text-button" onClick={() => update(row.key, { drinkId: null, name: row.menuName, currentPrice: null, manual: false })}>Undo</button>}
                            </>
                          ) : (
                            <div className="new-drink-fields">
                              <input aria-label="New drink name" value={row.name} maxLength={60} onChange={e => update(row.key, { name: e.target.value })} />
                              <select aria-label="Category" value={row.category} onChange={e => update(row.key, { category: e.target.value })}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <span className="status-pill hidden">New drink</span>
                              <select
                                aria-label={`Match ${row.menuName} to a listed drink`}
                                value=""
                                onChange={e => {
                                  const drink = (pub.drinks || []).find(d => d.id === e.target.value);
                                  if (drink) update(row.key, { drinkId: drink.id, name: drink.name, category: drink.category, measure: drink.measure, currentPrice: Number(drink.current_price), manual: true, selected: true });
                                }}
                              >
                                <option value="">…or match to a listed drink</option>
                                {(pub.drinks || [])
                                  .filter(d => !rows.some(r => r.drinkId === d.id))
                                  .map(d => <option key={d.id} value={d.id}>{d.name}{d.measure !== "pint" ? ` (${d.measure})` : ""}</option>)}
                              </select>
                            </div>
                          )}
                        </td>
                        <td>
                          {row.drinkId ? row.measure : (
                            <select aria-label="Measure" value={row.measure} onChange={e => update(row.key, { measure: e.target.value })}>
                              <option value="pint">pint</option>
                              <option value="half">half</option>
                            </select>
                          )}
                        </td>
                        <td>
                          <div className="price-input"><span aria-hidden="true">£</span>
                            <input aria-label={`Price for ${row.name}`} inputMode="decimal" value={row.price} onChange={e => update(row.key, { price: e.target.value })} />
                          </div>
                        </td>
                        <td className="num">
                          {row.currentPrice != null ? formatPrice(row.currentPrice) : "–"}
                          {diff != null && Math.abs(diff) >= 0.005 && <span className={diff > 0 ? "trend up" : "trend down"}> {diff > 0 ? "▲" : "▼"}{formatPrice(Math.abs(diff))}</span>}
                        </td>
                        <td className="small-text muted menu-raw">{row.raw}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="row-actions wrap">
            <button type="button" className="primary-button" disabled={!selected.length || stage === "saving"} onClick={save}>
              {stage === "saving" ? "Saving…" : `Save ${selected.length} price${selected.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" className="secondary-button" disabled={stage === "saving"} onClick={() => { setStage("idle"); setRows([]); setError(""); }}>Cancel</button>
          </div>
          <details className="menu-text">
            <summary>Show all text found in the PDF ({lines.length} lines)</summary>
            <pre>{lines.join("\n")}</pre>
          </details>
        </div>
      )}

      {menus.length > 0 && (
        <div className="menu-history">
          <h3 className="section-title">Uploaded menus</h3>
          <ul>
            {menus.map(m => (
              <li key={m.id}>
                <a href={m.viewUrl || m.url} target="_blank" rel="noreferrer">{m.file_name}</a>
                <span className="muted small-text"> · {timeAgo(m.uploaded_at)} · {m.prices_imported} price{m.prices_imported === 1 ? "" : "s"} imported</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
