import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/States.jsx";

export default function NotFoundPage() {
  return (
    <section className="card">
      <EmptyState title="Page not found">That page doesn't exist. <Link to="/">Back to finding pints</Link></EmptyState>
    </section>
  );
}
