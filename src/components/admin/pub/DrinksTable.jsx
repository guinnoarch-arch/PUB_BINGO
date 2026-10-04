import { useMemo, useState } from "react";
import { useApp } from "../../../lib/AppContext.jsx";
import { friendlyError } from "../../../lib/api/errors.js";
import { CATEGORIES } from "../../../data/seedPubs.js";
import { formatPrice, measureLabel, pintPrice } from "../../../lib/core/prices.js";
import { timeAgo } from "../../../lib/core/time.js";
import { sortDrinksForMenu } from "../../../lib/core/search.js";
import { SourceBadge } from "../../ui/Badges.jsx";
import { EmptyState } from "../../ui/States.jsx";
import DrinkHistory from "../../pub/DrinkHistory.jsx";
import { usePending } from "../../../lib/hooks/usePending.js";
import SetPriceForm from "./SetPriceForm.jsx";
import EditDrinkForm from "./EditDrinkForm.jsx";

export default function DrinksTable({ pub, priceDefaults, onChanged }) {
  const { api, toast, notifyChange } = useApp();
  const [open, setOpen] = useState(null); // { id, mode: "price" | "edit" | "history" } or { id: "new" }
  const { run, isPending } = usePending();
  const drinks = useMemo(() => sortDrinksForMenu(pub.drinks, { by: "name", categories: CATEGORIES }), [pub.drinks]);
  const done = () => { setOpen(null); onChanged(); };

  function remove(drink) {
    if (!window.confirm(`Delete ${drink.name} and its whole price history?`)) return;
    run(drink.id, async () => {
      try {
        await api.admin.deleteDrink(drink.id);
        toast(`${drink.name} deleted.`, "success");
        notifyChange();
        onChanged();
      } catch (err) {
        toast(friendlyError(err, `Couldn't delete ${drink.name}. Try again.`), "error");
      }
    });
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
                <DrinkRow key={drink.id} pub={pub} drink={drink} priceDefaults={priceDefaults} open={open?.id === drink.id ? open.mode : null}
                  setOpen={mode => setOpen(mode ? { id: drink.id, mode } : null)} onDone={done} onRemove={() => remove(drink)} removing={isPending(drink.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open?.id === "new" ? (
        <div className="inline-panel">
          <h3 className="section-title">Add a drink</h3>
          <SetPriceForm pub={pub} priceDefaults={priceDefaults} onDone={done} onCancel={() => setOpen(null)} />
        </div>
      ) : (
        <button type="button" className="secondary-button" onClick={() => setOpen({ id: "new" })}>+ Add a drink</button>
      )}
    </>
  );
}

function DrinkRow({ pub, drink, priceDefaults, open, setOpen, onDone, onRemove, removing }) {
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
          <button type="button" className="text-button danger" onClick={onRemove} disabled={removing}>{removing ? "Deleting…" : "Delete"}</button>
        </td>
      </tr>
      {open && (
        <tr className="expanded-row">
          <td colSpan={6}>
            {open === "price" && <SetPriceForm pub={pub} drink={drink} priceDefaults={priceDefaults} onDone={onDone} onCancel={() => setOpen(null)} />}
            {open === "edit" && <EditDrinkForm drink={drink} onDone={onDone} onCancel={() => setOpen(null)} />}
            {open === "history" && <DrinkHistory drink={drink} />}
          </td>
        </tr>
      )}
    </>
  );
}
