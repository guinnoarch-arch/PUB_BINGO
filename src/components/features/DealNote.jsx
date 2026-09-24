import { formatPrice } from "../../lib/core/prices.js";

// Shown next to a drink whose price is a happy-hour price right now.
export default function DealNote({ drink }) {
  if (!drink?.deal) return null;
  return (
    <span className="deal-note" title={drink.deal.title}>
      🍻 {drink.deal.title} until {drink.deal.until}{drink.regular_price ? ` · usually ${formatPrice(drink.regular_price)}` : ""}
    </span>
  );
}
