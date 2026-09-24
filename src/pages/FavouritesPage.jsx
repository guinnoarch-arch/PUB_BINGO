import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { cheapestPints } from "../lib/core/search.js";
import FavouriteButton from "../components/ui/FavouriteButton.jsx";
import { PriceTag } from "../components/ui/Badges.jsx";
import { EmptyState, Loading } from "../components/ui/States.jsx";
import PubIllustration from "../components/pub/PubIllustration.jsx";
import SignInPrompt from "../components/SignInPrompt.jsx";

export default function FavouritesPage() {
  const { userId, authReady, pubs, pubsStatus, favourites } = useApp();

  if (!authReady) return <Loading />;
  if (!userId) {
    return <SignInPrompt title="Your favourite pubs">Sign in to save favourites. They're kept with your account, so they follow you to any device.</SignInPrompt>;
  }
  if (pubsStatus === "loading") return <Loading />;

  const list = pubs.filter(pub => favourites.has(pub.id));
  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Saved</p>
          <h2>Favourites</h2>
        </div>
      </div>
      {list.length === 0 ? (
        <section className="card">
          <EmptyState title="No favourites yet">Tap the heart on any pub to save it here. <Link to="/">Find a pub</Link></EmptyState>
        </section>
      ) : (
        <div className="pub-card-grid">
          {list.map(pub => {
            const cheapest = cheapestPints([pub], { limit: 1 })[0];
            return (
              <article key={pub.id} className="card pub-card">
                <PubIllustration pub={pub} />
                <div className="pub-card-body">
                  <Link to={`/pubs/${pub.id}`} className="result-link"><strong>{pub.name}</strong></Link>
                  <span className="muted">{pub.area}</span>
                  {cheapest && (
                    <span className="small-text">Cheapest: {cheapest.drink.name} <PriceTag price={cheapest.price} measure={cheapest.measure} volumeMl={cheapest.volumeMl} pintPrice={cheapest.pintPrice} /></span>
                  )}
                </div>
                <FavouriteButton pub={pub} compact />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
