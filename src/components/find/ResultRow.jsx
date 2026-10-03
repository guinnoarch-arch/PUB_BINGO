import { Link } from "react-router-dom";
import { formatDistance } from "../../lib/core/geo.js";
import FavouriteButton from "../ui/FavouriteButton.jsx";
import { PriceTag, SourceBadge, UpdatedAgo } from "../ui/Badges.jsx";
import DealNote from "../features/DealNote.jsx";
import { PourScore } from "../features/PubExtras.jsx";

// One drink in the Find results: name, pub, badges, price and a favourite button.
// busy: someone checked in there recently.
export default function ResultRow({ row, busy = false }) {
  return (
    <li className="result-row">
      <div className="result-main">
        <Link to={`/pubs/${row.pub.id}`} className="result-link">
          <strong>{row.drink.name}</strong>
          <span className="muted"> {row.pub.name} · {row.pub.area}</span>
        </Link>
        <span className="result-meta">
          <span className="category-pill">{row.drink.category}</span>
          <SourceBadge source={row.drink.source} url={row.drink.source_url} />
          <UpdatedAgo value={row.drink.last_updated_at} />
          <DealNote drink={row.drink} />
          {/guinness/i.test(row.drink.name) && <PourScore pub={row.pub} compact />}
          {busy && <span className="busy-note">🔥 busy now</span>}
        </span>
        {row.distance != null && <span className="distance">{formatDistance(row.distance)}</span>}
      </div>
      <div className="result-side">
        <PriceTag price={row.price} measure={row.measure} volumeMl={row.volumeMl} pintPrice={row.pintPrice} />
        <FavouriteButton pub={row.pub} compact />
      </div>
    </li>
  );
}
