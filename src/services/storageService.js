import { DEFAULT_SQUARES } from "../data/defaultSquares.js";
import { createId } from "../utils/ids.js";

// Everything lives in this browser's localStorage for now. Cloud sync / multiplayer can come later.
export const STORAGE_KEY = "pub-bingo-data-v1";
export const PHONE_MODE_STORAGE_KEY = "pub-bingo-phone-mode";
export const DATA_VERSION = 1;

export function createDefaultSquares() {
  return DEFAULT_SQUARES.map(text => ({ id: createId("sq"), text, enabled: true }));
}

export function createDefaultData() {
  return {
    version: DATA_VERSION,
    profile: { displayName: "" },
    settings: {
      themeMode: "light",
      cardSize: 5,
      freeCentre: true
    },
    squares: createDefaultSquares(),
    currentCard: null,
    history: []
  };
}

// Fill in anything missing so older or partial saves still load.
export function normaliseData(raw) {
  const base = createDefaultData();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    version: DATA_VERSION,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    squares: Array.isArray(raw.squares) ? raw.squares.filter(sq => sq && sq.text) : base.squares,
    currentCard: raw.currentCard && Array.isArray(raw.currentCard.cells) ? raw.currentCard : null,
    history: Array.isArray(raw.history) ? raw.history.slice(0, 50) : []
  };
}

export function loadData() {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return normaliseData(text ? JSON.parse(text) : null);
  } catch (error) {
    console.warn("Could not read saved Pub Bingo data, starting fresh:", error);
    return createDefaultData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn("Could not save Pub Bingo data:", error);
    return false;
  }
}

export function readStoredPhoneMode() {
  try {
    const stored = window.localStorage.getItem(PHONE_MODE_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Ignore storage errors and fall back to screen size.
  }
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(max-width: 640px)").matches);
}

export function storePhoneMode(value) {
  try {
    window.localStorage.setItem(PHONE_MODE_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Not critical.
  }
}

export function exportDataFile(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Pub-Bingo-Backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
