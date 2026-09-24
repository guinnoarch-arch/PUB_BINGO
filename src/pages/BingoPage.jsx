import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { buildCardState, completedLines, evaluateAutoTiles } from "../lib/core/bingo.js";
import { ErrorState, Loading } from "../components/ui/States.jsx";
import SignInPrompt from "../components/SignInPrompt.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import { weekStart, weeklyCardState, weeklyStreak } from "../lib/core/weeklyBingo.js";
import { addDays, formatDate } from "../lib/core/events.js";

export default function BingoPage() {
  const { api, userId, authReady, pubsById, favourites, changeVersion, toast, feature, clock } = useApp();
  const weeklyOn = feature("weekly_bingo");
  const [mode, setMode] = useState("week");
  const showWeek = weeklyOn && mode === "week";
  const start = weekStart(clock);
  const [progress, setProgress] = useState(null);
  const [activity, setActivity] = useState({ reports: [], photoCount: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [retry, setRetry] = useState(0);
  const savingAuto = useRef(new Set());

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    Promise.all([api.listBingoProgress(userId), api.getMyActivity(userId)])
      .then(([rows, act]) => { if (active) { setProgress(rows); setActivity(act); setError(""); } })
      .catch(err => active && setError(friendlyError(err, "Couldn't load your bingo card.")));
    return () => { active = false; };
  }, [api, userId, changeVersion, retry]);

  const auto = useMemo(() => evaluateAutoTiles({
    reports: activity.reports,
    photoCount: activity.photoCount,
    favouritePubIds: [...favourites],
    pubsById
  }), [activity, favourites, pubsById]);
  const card = useMemo(() => (showWeek
    ? weeklyCardState(start, progress || [], activity, pubsById)
    : buildCardState(progress || [], auto)), [showWeek, start, progress, activity, pubsById, auto]);
  const streak = useMemo(() => (weeklyOn ? weeklyStreak(progress || [], clock) : 0), [weeklyOn, progress, clock]);
  const lines = completedLines(card);
  const doneCount = card.filter(t => t.done).length;

  // Save newly earned auto tiles so they stay complete.
  useEffect(() => {
    if (!userId || !progress) return;
    const toSave = card.filter(t => t.needsSaving && !savingAuto.current.has(t.id));
    if (!toSave.length) return;
    toSave.forEach(t => savingAuto.current.add(t.id));
    Promise.all(toSave.map(t => api.setBingoTile(userId, t.id, true)))
      .then(() => {
        setProgress(prev => [...prev, ...toSave.map(t => ({ tile_id: t.id, completed_at: new Date().toISOString() }))]);
        toast(toSave.length === 1 ? `Bingo tile complete: ${toSave[0].title}` : `${toSave.length} bingo tiles complete!`, "success");
      })
      .catch(() => {})
      .finally(() => toSave.forEach(t => savingAuto.current.delete(t.id)));
  }, [api, userId, card, progress, toast]);

  async function toggle(tile) {
    if (tile.mode === "auto") return;
    setSaving(tile.id);
    const next = !tile.done;
    try {
      await api.setBingoTile(userId, tile.id, next);
      setProgress(prev => (next
        ? [...prev, { tile_id: tile.id, completed_at: new Date().toISOString() }]
        : prev.filter(row => row.tile_id !== tile.id)));
    } catch (err) {
      toast(friendlyError(err, "Couldn't save your bingo card."), "error");
    } finally {
      setSaving(null);
    }
  }

  if (!authReady) return <Loading />;
  if (!userId) {
    return <SignInPrompt title="Pub Bingo challenge card">Sign in to play. Your card is saved to your account, and some tiles complete automatically as you report prices, favourite pubs and share photos.</SignInPrompt>;
  }
  if (error) return <ErrorState message={error} onRetry={() => setRetry(r => r + 1)} />;
  if (!progress) return <Loading label="Loading your card…" />;

  const inLine = new Set(lines.flat());
  const fullHouse = doneCount === card.length;

  return (
    <>
      {weeklyOn && (
        <div className="segmented" role="tablist" aria-label="Bingo cards">
          <button type="button" role="tab" aria-selected={mode === "week"} className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>This week</button>
          <button type="button" role="tab" aria-selected={mode === "classic"} className={mode === "classic" ? "active" : ""} onClick={() => setMode("classic")}>Classic card</button>
          <NotLaunched feature="weekly_bingo" />
        </div>
      )}
      <section className={`hero-card ${lines.length ? "bingo" : ""}`}>
        <div>
          <p className="eyebrow">{showWeek ? `Week of ${formatDate(start)} – ${formatDate(addDays(start, 6))}` : "Your challenge card"}</p>
          <h2>{fullHouse ? "Full house!" : lines.length ? "BINGO!" : `${doneCount} / 9`}</h2>
          <p>
            {fullHouse ? "Every tile done. Legend."
              : lines.length ? `${lines.length} line${lines.length === 1 ? "" : "s"} complete. Go for the full house.`
              : "Complete a row, column or diagonal to get Bingo."}
          </p>
          {showWeek && <p className="streak">🔥 Streak: <strong>{streak} week{streak === 1 ? "" : "s"}</strong> with a line{showWeek ? " · a new card every Monday" : ""}</p>}
        </div>
      </section>

      <section className="card">
        <div className="bingo-grid" role="list">
          {card.map((tile, index) => (
            <div key={tile.id} role="listitem">
              <button
                type="button"
                className={`bingo-cell ${tile.done ? "marked" : ""} ${inLine.has(index) ? "in-line" : ""} ${tile.mode}`}
                aria-pressed={tile.done}
                aria-disabled={tile.mode === "auto"}
                disabled={saving === tile.id}
                onClick={() => toggle(tile)}
                title={tile.detail}
              >
                <span className="bingo-title">{tile.title}</span>
                <span className="bingo-detail">{tile.mode === "auto" ? (tile.done ? "✓ Done" : "Auto") : tile.done ? "✓ Ticked" : "Tap when done"}</span>
              </button>
            </div>
          ))}
        </div>
        <p className="muted small-text">Tiles marked “Auto” complete themselves from what you do in the app. Tap the others once you've done them.</p>
      </section>
    </>
  );
}
