// Badges, worked out from what you've done in the app.
const count = (list, test) => (list || []).filter(test).length;

const BADGES = [
  { id: "first-round", title: "First round", detail: "Report your first price", goal: 1, progress: a => a.reports.length },
  { id: "regular", title: "Regular", detail: "Report 10 prices", goal: 10, progress: a => a.reports.length },
  { id: "centurion", title: "Centurion", detail: "Report 100 prices", goal: 100, progress: a => a.reports.length },
  { id: "checker", title: "Price checker", detail: "Confirm 10 prices with “Still right?”", goal: 10, progress: a => a.confirms.length },
  { id: "menu-hunter", title: "Menu hunter", detail: "Send a menu that gets used", goal: 1, progress: a => a.menusUsed },
  { id: "menu-master", title: "Menu master", detail: "5 menus used", goal: 5, progress: a => a.menusUsed },
  { id: "receipts", title: "Receipt keeper", detail: "Add 3 receipts to reports", goal: 3, progress: a => count(a.reports, r => r.receipt_path) },
  { id: "stout", title: "Stout scholar", detail: "Report 5 stout prices", goal: 5, progress: a => count(a.reports, r => r.category === "Stout") },
  { id: "cask", title: "Cask champion", detail: "Report 5 real ale prices", goal: 5, progress: a => count(a.reports, r => r.category === "Real Ale") },
  { id: "soho", title: "Soho local", detail: "5 reports or check-ins in Soho", goal: 5, progress: a => a.inArea("Soho") },
  { id: "covent-garden", title: "Covent Garden local", detail: "5 reports or check-ins in Covent Garden", goal: 5, progress: a => a.inArea("Covent Garden") },
  { id: "holborn", title: "Holborn local", detail: "5 reports or check-ins in Holborn", goal: 5, progress: a => a.inArea("Holborn") },
  { id: "kings-cross", title: "King's Cross local", detail: "5 reports or check-ins in King's Cross", goal: 5, progress: a => a.inArea("King's Cross") },
  { id: "explorer", title: "Explorer", detail: "Check in at 5 different pubs", goal: 5, progress: a => new Set(a.checkins.map(c => c.pub_id)).size },
  { id: "pour-judge", title: "Pour judge", detail: "Rate 5 Guinness pours", goal: 5, progress: a => a.pours },
  { id: "trusted", title: "Trusted reporter", detail: "Your reports keep matching others'", goal: 1, progress: a => (a.trusted ? 1 : 0) }
];

// activity: { reports: [{kind, category, pub_id, receipt_path}], checkins: [{pub_id}], menusUsed, pourRatings, trusted }
export function computeBadges(activity = {}, pubsById = {}) {
  const all = activity.reports || [];
  const a = {
    reports: all.filter(r => (r.kind || "report") === "report"),
    confirms: all.filter(r => r.kind === "confirm"),
    checkins: activity.checkins || [],
    menusUsed: activity.menusUsed || 0,
    pours: (activity.pourRatings || []).length,
    trusted: Boolean(activity.trusted)
  };
  a.inArea = area => count(a.reports, r => pubsById[r.pub_id]?.area === area) + count(a.checkins, c => pubsById[c.pub_id]?.area === area);
  return BADGES.map(badge => {
    const value = badge.progress(a);
    return { ...badge, value: Math.min(value, badge.goal), earned: value >= badge.goal };
  });
}

// Top reporters score: a point per price report or "still right" check, more for a menu that gets used.
export const MENU_USED_POINTS = 3;
export function reporterPoints({ reports = 0, confirms = 0, menus_used = 0 } = {}) {
  return reports + confirms + MENU_USED_POINTS * menus_used;
}
