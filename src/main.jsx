import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { api, configError } from "./lib/api/index.js";
import { AppProvider } from "./lib/AppContext.jsx";
import AppShell from "./components/AppShell.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import FindPage from "./pages/FindPage.jsx";
import PubPage from "./pages/PubPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import FeedPage from "./pages/FeedPage.jsx";
import FavouritesPage from "./pages/FavouritesPage.jsx";
import BingoPage from "./pages/BingoPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import "./styles/global.css";

const THEME_KEY = "pub-bingo-theme";
const PHONE_KEY = "pub-bingo-phone-mode";

// Display preferences only; all real data lives in the database.
function readPref(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* not important */ }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { document.getElementById("main")?.scrollTo?.(0, 0); }, [pathname]);
  return null;
}

function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch(error => console.warn("Service worker registration failed:", error));
  }, []);
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = readPref(THEME_KEY, "");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [phoneMode, setPhoneMode] = useState(() => {
    const saved = readPref(PHONE_KEY, "");
    return saved ? saved === "true" : Boolean(window.matchMedia?.("(max-width: 640px)").matches);
  });
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const { pathname } = useLocation();
  useServiceWorker();

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() => setTheme(t => { const next = t === "dark" ? "light" : "dark"; writePref(THEME_KEY, next); return next; })}
      phoneMode={phoneMode}
      onTogglePhoneMode={() => setPhoneMode(p => { writePref(PHONE_KEY, String(!p)); return !p; })}
      isOnline={isOnline}
    >
      <ScrollToTop />
      <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<FindPage />} />
          <Route path="/pubs/:pubId" element={<PubPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
          <Route path="/bingo" element={<BingoPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </AppShell>
  );
}

function ConfigErrorScreen() {
  return (
    <main className="config-error">
      <div className="card">
        <h1>Pub Bingo isn't connected yet</h1>
        <p>{configError}</p>
        <p className="muted">See the README for Supabase setup. To try the UI without a database, run with <code>VITE_DEMO_MODE=true</code>.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {configError ? <ConfigErrorScreen /> : (
      <BrowserRouter>
        <AppProvider api={api}>
          <App />
        </AppProvider>
      </BrowserRouter>
    )}
  </StrictMode>
);
