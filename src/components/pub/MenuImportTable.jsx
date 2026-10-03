import { CATEGORIES } from "../../data/seedPubs.js";
import { formatPrice, parsePrice } from "../../lib/core/prices.js";

// The review table for a PDF menu import: tick the prices to save, fix names and prices, or match a
// new drink to one already listed. update(rowKey, changes) edits a row.
export default function MenuImportTable({ rows, visibleRows, drinks, update }) {
  return (
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
                          const drink = drinks.find(d => d.id === e.target.value);
                          if (drink) update(row.key, { drinkId: drink.id, name: drink.name, category: drink.category, measure: drink.measure, currentPrice: Number(drink.current_price), manual: true, selected: true });
                        }}
                      >
                        <option value="">…or match to a listed drink</option>
                        {drinks
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
  );
}
