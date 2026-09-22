import { pintPrice } from "./prices.js";

// 3×3 Pub Bingo challenge card. "auto" tiles are completed from what the user does in the app;
// the rest are ticked by the user themselves.
export const BINGO_TILES = [
  { id: "cheap-pint", title: "Find a pint under £5.50", detail: "Spot one out in the wild.", mode: "self" },
  { id: "try-stout", title: "Try a stout", detail: "Guinness, porter, oyster stout: all count.", mode: "self" },
  { id: "old-pub", title: "Visit a pub older than 150 years", detail: "Check the pub's page for its opening year.", mode: "self" },
  { id: "first-report", title: "Report your first price", detail: "Completes automatically when you report a price.", mode: "auto" },
  { id: "two-areas", title: "Favourite pubs in two different areas", detail: "For example, one in Soho and one in Covent Garden.", mode: "auto" },
  { id: "real-ale", title: "Drink at a real-ale specialist", detail: "Look for the real-ale-specialist tag.", mode: "self" },
  { id: "cheap-report", title: "Report a pint under £6.50", detail: "Completes automatically: help find the bargains.", mode: "auto" },
  { id: "photo", title: "Share a pub photo", detail: "Completes automatically when you upload a photo.", mode: "auto" },
  { id: "five-reports", title: "Report 5 prices", detail: "Completes automatically: become a regular reporter.", mode: "auto" }
];

// activity: { reports: [{price, measure, pub_id}], favouritePubIds: [], photoCount, pubsById: {id: pub} }
export function evaluateAutoTiles(activity = {}) {
  const reports = activity.reports || [];
  const pubsById = activity.pubsById || {};
  const areas = new Set((activity.favouritePubIds || []).map(id => pubsById[id]?.area).filter(Boolean));
  return {
    "first-report": reports.length >= 1,
    "two-areas": areas.size >= 2,
    "cheap-report": reports.some(r => pintPrice(r.price, r.measure || "pint") < 6.5),
    photo: (activity.photoCount || 0) >= 1,
    "five-reports": reports.length >= 5
  };
}

// Merges stored progress (self-ticked + previously auto-completed) with live auto results.
// Auto tiles stay complete once earned, even if (say) a favourite is later removed.
export function buildCardState(progressRows = [], autoResults = {}) {
  const stored = new Map(progressRows.map(row => [row.tile_id, row.completed_at]));
  return BINGO_TILES.map(tile => {
    const completedAt = stored.get(tile.id) || null;
    const done = Boolean(completedAt) || (tile.mode === "auto" && Boolean(autoResults[tile.id]));
    return { ...tile, done, completedAt, needsSaving: tile.mode === "auto" && done && !completedAt };
  });
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function completedLines(cardState) {
  return LINES.filter(line => line.every(index => cardState[index]?.done));
}
