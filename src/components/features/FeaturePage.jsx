import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { EmptyState, Loading } from "../ui/States.jsx";

// Pages for features that haven't launched show "coming soon" to the public (admins see the page).
export default function FeaturePage({ feature: key, children }) {
  const { feature, authReady } = useApp();
  if (!authReady) return <Loading />;
  if (!feature(key)) {
    return <section className="card"><EmptyState asHeading title="Coming soon"><p>This part of Pub Bingo isn't open yet.</p><Link className="secondary-button" to="/">Back to search</Link></EmptyState></section>;
  }
  return children;
}
