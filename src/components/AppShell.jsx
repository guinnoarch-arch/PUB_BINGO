import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import InlineQrCode from "./ui/InlineQrCode.jsx";
import { useWatchMatches } from "./features/PriceWatches.jsx";

function IconButton({ label, active = false, onClick, children }) {
  return (
    <button type="button" className={`header-icon-button ${active ? "active" : ""}`} onClick={onClick} aria-label={label} title={label} aria-pressed={active}>
      {children}
    </button>
  );
}

const icons = {
  moon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /></svg>,
  sun: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
  qr: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2v-2ZM18 14h2v2h-2v-2ZM14 18h2v2h-2v-2ZM18 18h2v2h-2v-2Z" /></svg>,
  bulb: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" /></svg>,
  user: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
};

function shareUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  return configured ? configured.replace(/\/$/, "") : window.location.origin;
}

export default function AppShell({ children, theme, onToggleTheme, isOnline }) {
  const { api, session, profile, isAdmin, toasts, dismissToast } = useApp();
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef(null);
  const watchHits = useWatchMatches().filter(r => r.matches.length).length;
  const url = shareUrl();
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // The "Open on phone" panel closes with Escape or a tap outside it.
  useEffect(() => {
    if (!showShare) return undefined;
    const onKey = event => { if (event.key === "Escape") setShowShare(false); };
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
    ["/whats-on", "What's on", "What's on"],
    ["/leaderboard", "Leaderboard", "Top"],
    ["/feed", "Feed", "Feed"],
    ["/bingo", "Bingo", "Bingo"],
    ["/favourites", "Favourites", "Saved"],
    ...(isAdmin ? [["/admin", "Admin", "Admin"]] : [])
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="app-fixed-area">
        <header className="app-header">
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
              <IconButton label="Open on phone" active={showShare} onClick={() => setShowShare(v => !v)}>{icons.qr}</IconButton>
              {showShare && (
                <div className="device-share-panel" role="dialog" aria-label="Open on your phone">
                  <div className="panel-header">
                    <strong>Open on phone</strong>
                    <button type="button" className="text-button" onClick={() => setShowShare(false)}>Close</button>
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
        </header>

        {api.mode === "demo" && (
          <div className="app-banner" role="note">Demo mode: prices and accounts live in this tab only and reset on reload. Connect Supabase for real shared data.</div>
        )}
        {!isOnline && <div className="app-banner warning" role="status">You're offline. Showing the last loaded prices.</div>}

        <nav className="top-nav" aria-label="Main">
          {nav.map(([to, label, short]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${to === "/admin" ? "nav-item-admin" : ""}`}>
              {short !== label ? <><span className="nav-label-long">{label}</span><span className="nav-label-short" aria-hidden="true">{short}</span></> : label}
              {to === "/favourites" && watchHits > 0 && <span className="tab-count" aria-label={`${watchHits} price watch${watchHits === 1 ? "" : "es"} matched`}>{watchHits}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <main id="main" className="page-content" tabIndex={-1}>{children}</main>

      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span>{t.message}</span>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { dismissToast(t.id); t.action.onClick(); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
