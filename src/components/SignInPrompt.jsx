import { Link, useLocation } from "react-router-dom";

export default function SignInPrompt({ title, children }) {
  const location = useLocation();
  return (
    <section className="card sign-in-prompt">
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      <Link className="primary-button" to={`/account?next=${encodeURIComponent(location.pathname)}`}>Sign in or create account</Link>
    </section>
  );
}
