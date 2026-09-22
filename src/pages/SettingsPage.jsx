import { useRef, useState } from "react";
import { CARD_SIZES, squaresNeeded } from "../utils/bingo.js";

export default function SettingsPage({ appData, actions, pwa }) {
  const { settings, profile } = appData;
  const fileInput = useRef(null);
  const [status, setStatus] = useState("");

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      actions.importData(JSON.parse(await file.text()));
      setStatus("Backup restored.");
    } catch {
      setStatus("That file couldn't be read as a Pub Bingo backup.");
    }
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Make it yours</p>
          <h2>Settings</h2>
        </div>
      </div>

      <section className="card settings-grid">
        <label>
          Your name
          <input
            value={profile.displayName}
            maxLength={40}
            placeholder="Player"
            onChange={event => actions.updateProfile({ displayName: event.target.value })}
          />
        </label>

        <label>
          Card size
          <select value={settings.cardSize} onChange={event => actions.updateSettings({ cardSize: Number(event.target.value) })}>
            {CARD_SIZES.map(size => (
              <option key={size} value={size}>{size}×{size} ({squaresNeeded(size, settings.freeCentre)} squares)</option>
            ))}
          </select>
        </label>

        <label>
          Theme
          <select value={settings.themeMode} onChange={event => actions.updateSettings({ themeMode: event.target.value })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Match device</option>
          </select>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.freeCentre}
            onChange={event => actions.updateSettings({ freeCentre: event.target.checked })}
          />
          Free square in the middle (3×3 and 5×5 cards)
        </label>
        <p className="muted small-text">Card size and free square apply the next time you start a new card.</p>
      </section>

      <section className="card">
        <h3>Install on your phone</h3>
        {pwa.isInstalled ? (
          <p className="muted">Pub Bingo is installed on this device.</p>
        ) : pwa.installPrompt ? (
          <>
            <p className="muted">Add Pub Bingo to your home screen so it opens like an app.</p>
            <button type="button" className="primary-button" onClick={pwa.promptInstall}>Install app</button>
          </>
        ) : (
          <p className="muted">
            On iPhone: open in Safari, tap Share, then "Add to Home Screen". On Android: open the browser menu and choose "Install app".
          </p>
        )}
      </section>

      <section className="card">
        <h3>Your data</h3>
        <p className="muted">Everything is saved in this browser on this device only. Download a backup to move it to another device.</p>
        <div className="row-actions wrap">
          <button type="button" className="secondary-button" onClick={actions.exportData}>Download backup</button>
          <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}>Restore backup</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </div>
        {status && <p className="status-message">{status}</p>}
      </section>

      <section className="card danger-zone">
        <h3>Reset everything</h3>
        <p className="muted">Deletes your squares, current card and history on this device.</p>
        <button
          type="button"
          className="danger-button"
          onClick={() => { if (window.confirm("Delete all Pub Bingo data on this device?")) actions.resetAll(); }}
        >
          Reset app
        </button>
      </section>
    </>
  );
}
