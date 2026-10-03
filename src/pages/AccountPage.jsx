import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { useValidation } from "../lib/hooks/useValidation.js";
import { Loading } from "../components/ui/States.jsx";
import { ErrorSummary, FormError, Required, RequiredHint, fieldErrorBinding } from "../components/ui/FormErrors.jsx";
import AccountExtras from "../components/features/AccountExtras.jsx";
import Segmented from "../components/ui/Segmented.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const MIN_PASSWORD = 8;

// Only allow redirects back into this app, never to another site.
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function validateAccount(form, mode) {
  const e = {};
  if (mode === "signin") {
    if (!form.identifier.trim()) e.identifier = "Enter your email or username.";
    if (!form.password) e.password = "Enter your password.";
  } else if (mode === "signup") {
    if (!form.email.trim()) e.email = "Enter your email address.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter an email address like name@example.com.";
    if (!form.username.trim()) e.username = "Choose a username.";
    else if (!USERNAME_RE.test(form.username.trim())) e.username = "Use 3 to 24 letters, numbers or underscores (no spaces).";
    if (form.password.length < MIN_PASSWORD) e.password = `Use a password of at least ${MIN_PASSWORD} characters.`;
    if (!form.confirm) e.confirm = "Type your password again.";
    else if (form.confirm !== form.password) e.confirm = "The two passwords don't match. Type it again.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    e.email = "Enter the email address you signed up with.";
  }
  return e;
}

const FIELD_IDS = { identifier: "acct-identifier", email: "acct-email", username: "acct-username", password: "acct-password", confirm: "acct-confirm" };

export default function AccountPage() {
  const { api, session, profile, authReady, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ identifier: "", email: "", username: "", password: "", confirm: "" });
  const { errors, reset: resetErrors, checkField, validateAll, attempt } = useValidation(values => validateAccount(values, mode), form);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  function switchMode(nextMode) {
    setMode(nextMode);
    resetErrors();
    setServerError("");
    setNotice("");
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api.auth.signOut();
      toast("Signed out.");
    } catch (error) {
      toast(friendlyError(error, "Couldn't sign you out. Check your connection and try again."), "error");
    } finally {
      setSigningOut(false);
    }
  }

  if (!authReady) return <Loading />;

  if (session) {
    return (
      <>
        <section className="card account-card">
          <p className="eyebrow">Signed in</p>
          <h2>{profile ? `@${profile.username}` : "Your account"}</h2>
          <p className="muted">{session.user.email}{profile?.is_admin ? " · Admin" : ""}</p>
          <div className="row-actions wrap">
            <Link className="secondary-button" to="/favourites">Favourites</Link>
            <Link className="secondary-button" to="/bingo">Bingo card</Link>
            {profile?.is_admin && <Link className="secondary-button" to="/admin">Admin</Link>}
            <button type="button" className="danger-button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </section>
        <AccountExtras />
      </>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setServerError("");
    setNotice("");
    if (!validateAll()) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        await api.auth.signIn({ identifier: form.identifier.trim(), password: form.password });
        toast("Signed in.", "success");
        navigate(next, { replace: true });
      } else if (mode === "signup") {
        const { needsConfirmation } = await api.auth.signUp({ email: form.email.trim(), username: form.username.trim(), password: form.password });
        if (needsConfirmation) {
          switchMode("signin");
          setNotice(`We've sent a confirmation link to ${form.email.trim()}. Open it, then sign in here.`);
        } else {
          toast(`Account created. You're signed in as @${form.username.trim()}.`, "success");
          navigate(next, { replace: true });
        }
      } else {
        await api.auth.sendPasswordReset(form.email.trim());
        setNotice(`If ${form.email.trim()} has an account, a reset link is on its way. Check your inbox and spam folder.`);
      }
    } catch (error) {
      // The form keeps what was typed so it can be corrected and sent again.
      setServerError(friendlyError(error, mode === "signin" ? "Couldn't sign you in." : mode === "signup" ? "Couldn't create your account." : "Couldn't send the reset link."));
    } finally {
      setBusy(false);
    }
  }

  const fieldErrors = fieldErrorBinding(errors, FIELD_IDS);
  const field = (key, label, props = {}) => (
    <div className="field">
      <label htmlFor={FIELD_IDS[key]}>{label}<Required /></label>
      <input
        id={FIELD_IDS[key]}
        value={form[key]}
        onChange={set(key)}
        onBlur={() => checkField(key)}
        aria-required="true"
        {...fieldErrors.props(key)}
        {...props}
      />
      {fieldErrors.message(key)}
    </div>
  );

  return (
    <section className="card account-card">
      <Segmented wide label="Account" value={mode === "signup" ? "signup" : "signin"} onChange={switchMode} options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }]} />
      <p className="muted">Browsing is open to everyone. An account lets you report prices, save favourites, upload photos and play the bingo card.</p>

      <form onSubmit={submit} noValidate className="account-form">
        <ErrorSummary errors={errors} fieldIds={FIELD_IDS} attempt={attempt} />
        {notice && <p className="status-message" role="status">{notice}</p>}
        <RequiredHint />
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
            {field("password", "Password (at least 8 characters)", { type: "password", autoComplete: "new-password" })}
            {field("confirm", "Confirm password", { type: "password", autoComplete: "new-password" })}
          </>
        )}
        {mode === "reset" && field("email", "Email", { type: "email", autoComplete: "email" })}

        <FormError>{serverError}</FormError>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy
            ? (mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…")
            : (mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link")}
        </button>
        {mode === "signin" && <button type="button" className="text-button" onClick={() => switchMode("reset")}>Forgot password?</button>}
        {mode === "reset" && <button type="button" className="text-button" onClick={() => switchMode("signin")}>Back to sign in</button>}
      </form>
      {api.mode === "demo" && <p className="muted small-text">Demo mode: try the admin account <code>admin</code> / <code>password123</code>.</p>}
    </section>
  );
}
