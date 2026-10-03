import { Heart } from "lucide-react";
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
      <Heart aria-hidden="true" />
      {!compact && <span>{active ? "Favourite" : "Add to favourites"}</span>}
    </button>
  );
}
