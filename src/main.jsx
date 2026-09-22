import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "./components/layout/AppShell.jsx";
import PlayPage from "./pages/PlayPage.jsx";
import SquaresPage from "./pages/SquaresPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { NAV_ITEMS } from "./components/layout/TopNav.jsx";
import {
  createDefaultData,
  createDefaultSquares,
  exportDataFile,
  loadData,
  normaliseData,
  readStoredPhoneMode,
  saveData,
  storePhoneMode
} from "./services/storageService.js";
import { createCard, toggleCell } from "./utils/bingo.js";
import { createId } from "./utils/ids.js";
import "./styles/global.css";

const PAGE_KEYS = NAV_ITEMS.map(([key]) => key);

function readInitialPage() {
  const page = new URLSearchParams(window.location.search).get("page");
  return PAGE_KEYS.includes(page) ? page : "play";
}

function resolveTheme(mode) {
  if (mode === "system") return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return mode === "dark" ? "dark" : "light";
}

// Keeps the last 50 cards; a card only goes into history if something was marked on it.
function archiveCard(history, card) {
  if (!card || !card.cells.some(cell => cell.marked && !cell.free)) return history;
  return [card, ...history.filter(item => item.id !== card.id)].slice(0, 50);
}

function usePwa() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    const onPrompt = event => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => { setIsInstalled(true); setInstallPrompt(null); };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    // Only register in production builds so dev hot-reload isn't served stale files.
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").then(registration => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
        });
      });
    }).catch(error => console.warn("Service worker registration failed:", error));

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }, []);

  return {
    installPrompt,
    isInstalled,
    isOnline,
    hasUpdate: Boolean(waitingWorker),
    applyUpdate: () => waitingWorker?.postMessage({ type: "SKIP_WAITING" }),
    promptInstall: async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
    }
  };
}

function App() {
  const [appData, setAppData] = useState(loadData);
  const [activePage, setActivePage] = useState(readInitialPage);
  const [phoneMode, setPhoneMode] = useState(readStoredPhoneMode);
  const pwa = usePwa();

  useEffect(() => { saveData(appData); }, [appData]);
  useEffect(() => { storePhoneMode(phoneMode); }, [phoneMode]);

  useEffect(() => {
    const mode = appData.settings.themeMode;
    const apply = () => document.documentElement.setAttribute("data-theme", resolveTheme(mode));
    apply();
    if (mode !== "system" || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener?.("change", apply);
    return () => query.removeEventListener?.("change", apply);
  }, [appData.settings.themeMode]);

  function navigate(page) {
    setActivePage(page);
    const url = new URL(window.location.href);
    if (page === "play") url.searchParams.delete("page");
    else url.searchParams.set("page", page);
    window.history.replaceState(null, "", url);
  }

  const actions = useMemo(() => ({
    phoneMode,
    togglePhoneMode: () => setPhoneMode(prev => !prev),
    toggleTheme: () => setAppData(prev => ({
      ...prev,
      settings: { ...prev.settings, themeMode: resolveTheme(prev.settings.themeMode) === "dark" ? "light" : "dark" }
    })),
    updateSettings: patch => setAppData(prev => ({ ...prev, settings: { ...prev.settings, ...patch } })),
    updateProfile: patch => setAppData(prev => ({ ...prev, profile: { ...prev.profile, ...patch } })),

    newCard: () => setAppData(prev => {
      try {
        const card = createCard({
          squares: prev.squares.filter(sq => sq.enabled !== false).map(sq => sq.text),
          size: prev.settings.cardSize,
          freeCentre: prev.settings.freeCentre
        });
        return { ...prev, currentCard: card, history: archiveCard(prev.history, prev.currentCard) };
      } catch (error) {
        // The Play page disables "New card" when there aren't enough squares, so this is a safety net.
        console.warn(error.message);
        return prev;
      }
    }),
    toggleCell: cellId => setAppData(prev => (
      prev.currentCard ? { ...prev, currentCard: toggleCell(prev.currentCard, cellId) } : prev
    )),
    clearMarks: () => setAppData(prev => (prev.currentCard ? {
      ...prev,
      currentCard: {
        ...prev.currentCard,
        cells: prev.currentCard.cells.map(cell => ({ ...cell, marked: cell.free })),
        completedLines: [],
        bingoAt: null
      }
    } : prev)),

    addSquare: text => setAppData(prev => ({
      ...prev,
      squares: [...prev.squares, { id: createId("sq"), text: text.trim(), enabled: true }]
    })),
    updateSquare: (id, patch) => setAppData(prev => ({
      ...prev,
      squares: prev.squares.map(sq => (sq.id === id ? { ...sq, ...patch } : sq))
    })),
    removeSquare: id => setAppData(prev => ({ ...prev, squares: prev.squares.filter(sq => sq.id !== id) })),
    resetSquares: () => setAppData(prev => ({ ...prev, squares: createDefaultSquares() })),

    clearHistory: () => setAppData(prev => ({ ...prev, history: [] })),
    exportData: () => exportDataFile(appData),
    importData: raw => {
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.squares)) throw new Error("Not a Pub Bingo backup");
      setAppData(normaliseData(raw));
    },
    resetAll: () => setAppData(createDefaultData())
  }), [phoneMode, appData]);

  const pageProps = { appData, actions, pwa, setActivePage: navigate };

  return (
    <AppShell activePage={activePage} setActivePage={navigate} appData={appData} actions={actions} pwa={pwa}>
      {activePage === "play" && <PlayPage {...pageProps} />}
      {activePage === "squares" && <SquaresPage {...pageProps} />}
      {activePage === "history" && <HistoryPage {...pageProps} />}
      {activePage === "settings" && <SettingsPage {...pageProps} />}
    </AppShell>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
