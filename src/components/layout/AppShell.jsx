import { useState } from "react";
import TopNav from "./TopNav.jsx";
import InlineQrCode from "../common/InlineQrCode.jsx";

function HeaderIconButton({ label, title, active = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`header-icon-button ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={title || label}
    >
      {children}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M10 5h4" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

function LaptopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="4" width="14" height="10" rx="1.5" />
      <path d="M3 18h18" />
      <path d="m7 14-2 4" />
      <path d="m17 14 2 4" />
    </svg>
  );
}

function QrCodeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4h6v6H4V4Z" />
      <path d="M14 4h6v6h-6V4Z" />
      <path d="M4 14h6v6H4v-6Z" />
      <path d="M14 14h2v2h-2v-2ZM18 14h2v2h-2v-2ZM14 18h2v2h-2v-2ZM18 18h2v2h-2v-2Z" />
    </svg>
  );
}

function resolveShareUrl() {
  if (typeof window === "undefined") return "";
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return window.location.origin;
}

function isLocalHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(window.location.hostname);
}

export default function AppShell({ children, activePage, setActivePage, appData, actions, pwa }) {
  const [showDeviceShare, setShowDeviceShare] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const themeMode = appData.settings.themeMode;
  const themeLabel = themeMode === "dark" ? "Light mode" : "Dark mode";
  const playerName = appData.profile.displayName || "Player";
  const shareUrl = resolveShareUrl();
  const connectionLabel = pwa.isOnline ? "Online" : "Offline";

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Link copied");
    } catch {
      setCopyStatus("Could not copy link");
    }
    window.setTimeout(() => setCopyStatus(""), 2500);
  }

  return (
    <div className={`app-shell ${actions.phoneMode ? "phone-mode" : ""}`.trim()}>
      <div className="app-fixed-area">
        <header className="app-header">
          <div
            className="brand"
            onClick={() => setActivePage("play")}
            onKeyDown={event => { if (event.key === "Enter") setActivePage("play"); }}
            role="button"
            tabIndex={0}
          >
            <div className="brand-icon"><img src="/icons/pb-icon-192.png" alt="" /></div>
            <div>
              <h1>Pub Bingo</h1>
              <p className="brand-subtitle">
                <span>Cheers, {playerName}</span>
                <span className={`connection-pill ${pwa.isOnline ? "online" : "offline"}`}>{connectionLabel}</span>
              </p>
            </div>
          </div>

          <div className="header-actions">
            <HeaderIconButton label={themeLabel} onClick={actions.toggleTheme}>
              {themeMode === "dark" ? <SunIcon /> : <MoonIcon />}
            </HeaderIconButton>
            <HeaderIconButton
              label={actions.phoneMode ? "Desktop view" : "Phone view"}
              title={actions.phoneMode ? "Return to desktop layout" : "Use compact phone-friendly layout"}
              active={actions.phoneMode}
              onClick={actions.togglePhoneMode}
            >
              {actions.phoneMode ? <LaptopIcon /> : <PhoneIcon />}
            </HeaderIconButton>
            <div className="device-share-wrapper">
              <HeaderIconButton
                label="Open on phone"
                title="Show a QR code to open Pub Bingo on your phone"
                active={showDeviceShare}
                onClick={() => setShowDeviceShare(prev => !prev)}
              >
                <QrCodeIcon />
              </HeaderIconButton>
              {showDeviceShare && (
                <div className="device-share-panel" role="dialog" aria-label="Open app on another device">
                  <div className="panel-header">
                    <strong>Open on phone</strong>
                    <button type="button" className="text-button" onClick={() => setShowDeviceShare(false)}>Close</button>
                  </div>
                  <p className="muted">Scan this with your phone camera to open Pub Bingo.</p>
                  <div className="device-qr-card">
                    <InlineQrCode value={shareUrl} size={240} />
                  </div>
                  {isLocalHost() && !import.meta.env.VITE_PUBLIC_APP_URL && (
                    <p className="status-message warning">
                      You're running locally, so this link only works on this computer. Once the app is deployed, set VITE_PUBLIC_APP_URL to the live link.
                    </p>
                  )}
                  <input className="device-share-link" value={shareUrl} readOnly aria-label="App link" />
                  <div className="row-actions">
                    <button type="button" className="secondary-button small" onClick={copyShareLink}>Copy link</button>
                  </div>
                  {copyStatus && <p className="status-message">{copyStatus}</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        {pwa.hasUpdate && (
          <div className="app-banner">
            <span>A new version of Pub Bingo is ready.</span>
            <button type="button" className="primary-button small" onClick={pwa.applyUpdate}>Update now</button>
          </div>
        )}

        <TopNav activePage={activePage} setActivePage={setActivePage} />
      </div>

      <main className="page-content">{children}</main>
    </div>
  );
}
