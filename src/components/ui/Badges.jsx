import { isStale, timeAgo } from "../../lib/core/time.js";
import { formatPrice } from "../../lib/core/prices.js";

const SOURCES = {
  seed: { label: "Estimate", className: "badge-seed", title: "Starting estimate, not yet confirmed. Report the real price if you know it." },
  community: { label: "Community", className: "badge-community", title: "Price reported by a visitor" },
  website: { label: "Pub website", className: "badge-website", title: "Price taken from the pub's own website" },
  admin: { label: "Verified", className: "badge-admin", title: "Price checked by a Pub Bingo admin" }
};

export function SourceBadge({ source, url }) {
  const info = SOURCES[source] || SOURCES.seed;
  if (url && source === "website") {
    return (
      <a className={`badge ${info.className}`} href={url} target="_blank" rel="noreferrer" title={`${info.title} (opens the page)`}>
        {info.label} ↗
      </a>
    );
  }
  return <span className={`badge ${info.className}`} title={info.title}>{info.label}</span>;
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
