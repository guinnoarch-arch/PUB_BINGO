import { isStale, timeAgo } from "../../lib/core/time.js";
import { formatPrice } from "../../lib/core/prices.js";

export function SourceBadge({ source }) {
  const community = source === "community";
  return (
    <span className={`badge ${community ? "badge-community" : "badge-seed"}`} title={community ? "Price reported by the community" : "Starting estimate, not yet confirmed by a visitor"}>
      {community ? "Community" : "Seed estimate"}
    </span>
  );
}

export function UpdatedAgo({ value }) {
  const stale = isStale(value);
  return (
    <span className={`updated ${stale ? "stale" : ""}`}>
      <time dateTime={value} title={new Date(value).toLocaleString("en-GB")}>Updated {timeAgo(value)}</time>
      {stale && <span className="sr-only"> (may be out of date)</span>}
    </span>
  );
}

// Shows the pint price, or a half/other measure with its pint equivalent.
export function PriceTag({ price, measure = "pint", pintPrice, large = false }) {
  return (
    <span className={`price-tag ${large ? "large" : ""}`}>
      <strong>{formatPrice(price)}</strong>
      {measure !== "pint" && (
        <small> / {measure}{pintPrice ? ` (≈ ${formatPrice(pintPrice)} a pint)` : ""}</small>
      )}
    </span>
  );
}
