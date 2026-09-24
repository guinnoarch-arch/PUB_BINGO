// "Needs checking": prices that are only estimates, or haven't been confirmed for a while.
export const CHECK_AFTER_DAYS = 60;

export function needsChecking(pubs, { days = CHECK_AFTER_DAYS, now = Date.now() } = {}) {
  const rows = [];
  for (const pub of pubs || []) {
    for (const drink of pub.drinks || []) {
      const updated = new Date(drink.last_updated_at).getTime();
      const age = Number.isFinite(updated) ? Math.floor((now - updated) / 86400000) : Infinity;
      const estimate = drink.source === "seed";
      if (!estimate && age < days) continue;
      rows.push({ pub, drink, estimate, age });
    }
  }
  // Real prices that have gone stale first (they were right once), oldest first; then estimates.
  return rows.sort((a, b) => Number(a.estimate) - Number(b.estimate) || b.age - a.age || a.pub.name.localeCompare(b.pub.name));
}

export function groupByPub(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.pub.id)) groups.set(row.pub.id, { pub: row.pub, rows: [] });
    groups.get(row.pub.id).rows.push(row);
  }
  return [...groups.values()];
}
