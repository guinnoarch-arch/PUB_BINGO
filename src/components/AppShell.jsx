import { forwardRef, useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import InlineQrCode from "./ui/InlineQrCode.jsx";
import { useWatchMatches } from "./features/PriceWatches.jsx";
import { Lightbulb, Moon, QrCode, Sun, User } from "lucide-react";

// expanded: for a button that opens a panel (announced as expanded/collapsed).
const IconButton = forwardRef(function IconButton({ label, onClick, expanded, children }, ref) {
  return (
    <button ref={ref} type="button" className={`header-icon-button ${expanded ? "active" : ""}`} onClick={onClick} aria-label={label} title={label} aria-expanded={expanded}>
      {children}
    </button>
  );
});

const icons = {
  moon: <Moon aria-hidden="true" />,
  sun: <Sun aria-hidden="true" />,
  qr: <QrCode aria-hidden="true" />,
  bulb: <Lightbulb aria-hidden="true" />,
  user: <User aria-hidden="true" />
};

function shareUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  return configured ? configured.replace(/\/$/, "") : window.location.origin;
}

export default function AppShell({ children, theme, onToggleTheme, isOnline }) {
  const { api, session, profile, isAdmin, toasts, dismissToast } = useApp();
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef(null);
  const shareButtonRef = useRef(null);
  const shareCloseRef = useRef(null);
  const closeShare = ({ returnFocus = true } = {}) => {
    setShowShare(false);
    if (returnFocus) shareButtonRef.current?.focus();
  };
  const watchHits = useWatchMatches().filter(r => r.matches.length).length;
  const url = shareUrl();
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // The "Open on phone" panel: focus moves into it when it opens, and back to its button when it
  // closes with Escape or Close. A tap outside closes it without moving focus.
  useEffect(() => {
    if (!showShare) return undefined;
    shareCloseRef.current?.focus();
    const onKey = event => {
      if (event.key !== "Escape") return;
      setShowShare(false);
      shareButtonRef.current?.focus();
    };
    const onPointer = event => { if (!shareRef.current?.contains(event.target)) setShowShare(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [showShare]);

  // [path, label, short label for narrow screens]
  const nav = [
    ["/", "Find", "Find"],
    ["/whats-on", "What's on", "Events"],
    ["/leaderboard", "Leaderboard", "Top"],
    ["/feed", "Feed", "Feed"],
    ["/bingo", "Bingo", "Bingo"],
    ["/favourites", "Favourites", "Saved"],
    ...(isAdmin ? [["/admin", "Admin", "Admin"]] : [])
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-fixed-area">
        <div className="app-header">
          <Link to="/" className="brand" aria-label="Pub Bingo home">
            <span className="brand-icon"><img src="/icons/pb-icon-192.png?v=2" alt="" /></span>
            <span>
              <span className="brand-title">Pub Bingo</span>
              <span className="brand-subtitle">Cheapest pints in central London</span>
            </span>
          </Link>
          <div className="header-actions">
            <NavLink to="/suggestions" className={({ isActive }) => `header-icon-button ${isActive ? "active" : ""}`} aria-label="Suggestions" title="Suggestions">{icons.bulb}</NavLink>
            <IconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={onToggleTheme}>{theme === "dark" ? icons.sun : icons.moon}</IconButton>
            <div className="device-share-wrapper" ref={shareRef}>
              <IconButton ref={shareButtonRef} label="Open on phone" expanded={showShare} onClick={() => (showShare ? closeShare() : setShowShare(true))}>{icons.qr}</IconButton>
              {showShare && (
                <div className="device-share-panel" role="dialog" aria-label="Open on your phone">
                  <div className="panel-header">
                    <strong>Open on phone</strong>
                    <button ref={shareCloseRef} type="button" className="text-button" onClick={() => closeShare()}>Close</button>
                  </div>
                  <div className="device-qr-card"><InlineQrCode value={url} size={220} /></div>
                  {isLocal && !import.meta.env.VITE_PUBLIC_APP_URL && (
                    <p className="status-message warning">This is a local address, so it only works on this computer. Set VITE_PUBLIC_APP_URL to the live link once deployed.</p>
                  )}
                  <input className="device-share-link" value={url} readOnly aria-label="App link" />
                </div>
              )}
            </div>
            <Link to="/account" className="account-chip" aria-label={session ? "Your account" : "Sign in"}>
              {icons.user}
              <span>{session ? (profile ? `@${profile.username}` : "Account") : "Sign in"}</span>
            </Link>
          </div>
        </div>

        {api.mode === "demo" && (
          <div className="app-banner" role="note">Demo mode: prices and accounts live in this tab only and reset on reload. Connect Supabase for real shared data.</div>
        )}
        {!isOnline && <div className="app-banner warning" role="status">You're offline. Showing the last loaded prices.</div>}

        <nav className="top-nav" aria-label="Main">
          {nav.map(([to, label, short]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              {short !== label ? <><span className="nav-label-long">{label}</span><span className="nav-label-short">{short}</span></> : label}
              {to === "/favourites" && watchHits > 0 && <span className="tab-count" aria-label={`${watchHits} price watch${watchHits === 1 ? "" : "es"} matched`}>{watchHits}</span>}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="page-content" tabIndex={-1}>{children}</main>

      <section className="toast-region" aria-label="Notifications" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span>{t.message}</span>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { dismissToast(t.id); t.action.onClick(); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
