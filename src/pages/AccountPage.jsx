import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { Loading } from "../components/ui/States.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

// Only allow redirects back into this app, never to another site.
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function AccountPage() {
  const { api, session, profile, authReady, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ identifier: "", email: "", username: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  if (!authReady) return <Loading />;

  if (session) {
    return (
      <section className="card account-card">
        <p className="eyebrow">Signed in</p>
        <h2>{profile ? `@${profile.username}` : "Your account"}</h2>
        <p className="muted">{session.user.email}{profile?.is_admin ? " · Admin" : ""}</p>
        <div className="row-actions wrap">
          <Link className="secondary-button" to="/favourites">Favourites</Link>
          <Link className="secondary-button" to="/bingo">Bingo card</Link>
          {profile?.is_admin && <Link className="secondary-button" to="/admin">Admin</Link>}
          <button type="button" className="danger-button" onClick={async () => { await api.auth.signOut(); toast("Signed out."); }}>Sign out</button>
        </div>
      </section>
    );
  }

  function validate() {
    const e = {};
    if (mode === "signin") {
      if (!form.identifier.trim()) e.identifier = "Enter your email or username";
      if (!form.password) e.password = "Enter your password";
    } else if (mode === "signup") {
      if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email";
      if (!USERNAME_RE.test(form.username.trim())) e.username = "3-24 letters, numbers or underscores";
      if (form.password.length < 8) e.password = "At least 8 characters";
      if (form.confirm !== form.password) e.confirm = "Passwords don't match";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      e.email = "Enter a valid email";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        await api.auth.signIn({ identifier: form.identifier.trim(), password: form.password });
        toast("Welcome back!", "success");
        navigate(next, { replace: true });
      } else if (mode === "signup") {
        const { needsConfirmation } = await api.auth.signUp({ email: form.email.trim(), username: form.username.trim(), password: form.password });
        if (needsConfirmation) {
          setMessage("Check your email for a confirmation link, then sign in.");
          setMode("signin");
        } else {
          toast("Account created. Cheers!", "success");
          navigate(next, { replace: true });
        }
      } else {
        await api.auth.sendPasswordReset(form.email.trim());
        setMessage("If that email has an account, a reset link is on its way.");
      }
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  const field = (key, label, props = {}) => (
    <div className="field">
      <label htmlFor={`acct-${key}`}>{label}</label>
      <input
        id={`acct-${key}`}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `acct-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && <span id={`acct-${key}-error`} className="field-error">{errors[key]}</span>}
    </div>
  );

  return (
    <section className="card account-card">
      <div className="segmented wide" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setErrors({}); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setErrors({}); }}>Create account</button>
      </div>
      <p className="muted">Browsing is open to everyone. An account lets you report prices, save favourites, upload photos and play the bingo card.</p>

      <form onSubmit={submit} noValidate className="account-form">
        {mode === "signin" && (
          <>
            {field("identifier", "Email or username", { autoComplete: "username", autoCapitalize: "none" })}
            {field("password", "Password", { type: "password", autoComplete: "current-password" })}
          </>
        )}
        {mode === "signup" && (
          <>
            {field("email", "Email", { type: "email", autoComplete: "email" })}
            {field("username", "Username (shown on your reports)", { autoComplete: "username", autoCapitalize: "none", maxLength: 24 })}
            {field("password", "Password", { type: "password", autoComplete: "new-password" })}
            {field("confirm", "Confirm password", { type: "password", autoComplete: "new-password" })}
          </>
        )}
        {mode === "reset" && field("email", "Email", { type: "email", autoComplete: "email" })}

        {message && <p className="status-message" role="status">{message}</p>}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
        {mode === "signin" && <button type="button" className="text-button" onClick={() => setMode("reset")}>Forgot password?</button>}
        {mode === "reset" && <button type="button" className="text-button" onClick={() => setMode("signin")}>Back to sign in</button>}
      </form>
      {api.mode === "demo" && <p className="muted small-text">Demo mode: try the admin account <code>admin</code> / <code>password123</code>.</p>}
    </section>
  );
}
