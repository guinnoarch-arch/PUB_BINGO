import { PUB_COVERS } from "../../data/pubCovers.js";
import PubIllustration from "./PubIllustration.jsx";

// A pub's cover photo if we have one, otherwise its generated illustration.
export default function PubImage({ pub, className = "" }) {
  const cover = PUB_COVERS[pub.id];
  if (cover) {
    return <img className={`pub-cover ${className}`.trim()} src={cover.src} alt={cover.alt} loading="lazy" decoding="async" />;
  }
  return <PubIllustration pub={pub} className={className} />;
}

export function hasCover(pubId) {
  return Boolean(PUB_COVERS[pubId]);
}
