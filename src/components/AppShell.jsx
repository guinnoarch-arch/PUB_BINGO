import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import InlineQrCode from "./common/InlineQrCode.jsx";

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
  phone: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M10 5h4M11 18.5h2" /></svg>,
  laptop: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="10" rx="1.5" /><path d="M3 18h18M7 14l-2 4M17 14l2 4" /></svg>,
  qr: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2v-2ZM18 14h2v2h-2v-2ZM14 18h2v2h-2v-2ZM18 18h2v2h-2v-2Z" /></svg>,
  user: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
};

function shareUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  return configured ? configured.replace(/\/$/, "") : window.location.origin;
}

export default function AppShell({ children, theme, onToggleTheme, phoneMode, onTogglePhoneMode, isOnline }) {
  const { api, session, profile, isAdmin, toasts } = useApp();
  const navigate = useNavigate();
  const [showShare, setShowShare] = useState(false);
  const url = shareUrl();
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const nav = [
    ["/", "Find"],
    ["/leaderboard", "Leaderboard"],
    ["/feed", "Feed"],
    ["/bingo", "Bingo"],
    ["/favourites", "Favourites"],
    ...(isAdmin ? [["/admin", "Admin"]] : [])
  ];

  return (
    <div className={`app-shell ${phoneMode ? "phone-mode" : ""}`.trim()}>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="app-fixed-area">
        <header className="app-header">
          <Link to="/" className="brand" aria-label="Pub Bingo home">
            <span className="brand-icon"><img src="/icons/pb-icon-192.png" alt="" /></span>
            <span>
              <span className="brand-title">Pub Bingo</span>
              <span className="brand-subtitle">Cheapest pints in Soho &amp; Covent Garden</span>
            </span>
          </Link>
          <div className="header-actions">
            <IconButton label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={onToggleTheme}>{theme === "dark" ? icons.sun : icons.moon}</IconButton>
            <IconButton label={phoneMode ? "Desktop view" : "Phone view"} active={phoneMode} onClick={onTogglePhoneMode}>{phoneMode ? icons.laptop : icons.phone}</IconButton>
            <div className="device-share-wrapper">
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
            <button type="button" className="account-chip" onClick={() => navigate("/account")} aria-label={session ? "Your account" : "Sign in"}>
              {icons.user}
              <span>{session ? (profile ? `@${profile.username}` : "Account") : "Sign in"}</span>
            </button>
          </div>
        </header>

        {api.mode === "demo" && (
          <div className="app-banner" role="note">Demo mode: prices and accounts live in this tab only and reset on reload. Connect Supabase for real shared data.</div>
        )}
        {!isOnline && <div className="app-banner warning" role="status">You're offline. Showing the last loaded prices.</div>}

        <nav className="top-nav" aria-label="Main">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${to === "/admin" ? "nav-item-admin" : ""}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main id="main" className="page-content" tabIndex={-1}>{children}</main>

      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map(t => <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>{t.message}</div>)}
      </div>
    </div>
  );
}
