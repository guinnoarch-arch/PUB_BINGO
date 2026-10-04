import { Link, useLocation } from "react-router-dom";

// "Sign in to …" with a button that brings you back here afterwards.
// inline: for use inside an existing card (no card or heading of its own).
export default function SignInPrompt({ title, children, inline = false }) {
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  const button = <Link className="primary-button" to={`/account?next=${next}`}>Sign in or create account</Link>;
  if (inline) {
    return (
      <div className="sign-in-prompt">
        <p className="muted">{children}</p>
        {button}
      </div>
    );
  }
  return (
    <section className="card sign-in-prompt">
      <h1 className="section-title">{title}</h1>
      <p className="muted">{children}</p>
      {button}
    </section>
  );
}
