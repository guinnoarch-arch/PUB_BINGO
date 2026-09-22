import { useApp } from "../../lib/AppContext.jsx";

export default function FavouriteButton({ pub, compact = false }) {
  const { favourites, toggleFavourite } = useApp();
  const active = favourites.has(pub.id);
  const label = active ? `Remove ${pub.name} from favourites` : `Add ${pub.name} to favourites`;
  return (
    <button
      type="button"
      className={`favourite-button ${active ? "active" : ""} ${compact ? "compact" : ""}`}
      onClick={event => { event.preventDefault(); event.stopPropagation(); toggleFavourite(pub.id); }}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.5 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
      </svg>
      {!compact && <span>{active ? "Favourite" : "Add to favourites"}</span>}
    </button>
  );
}
