import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/States.jsx";

export default function NotFoundPage() {
  return (
    <section className="card">
      <EmptyState asHeading title="Page not found"><p>That page doesn't exist. Check the address, or start from the home page.</p><Link className="secondary-button" to="/">Go to the home page</Link></EmptyState>
    </section>
  );
}
