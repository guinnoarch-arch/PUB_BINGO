import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { buildCardState, completedLines, evaluateAutoTiles, isFullHouse } from "../lib/core/bingo.js";
import { ErrorState, Loading } from "../components/ui/States.jsx";
import SignInPrompt from "../components/SignInPrompt.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import { weekStart, weeklyCardState, weeklyStreak } from "../lib/core/weeklyBingo.js";
import { addDays, formatDate } from "../lib/core/events.js";
import { useUrlParams } from "../lib/hooks/useUrlParam.js";
import Segmented from "../components/ui/Segmented.jsx";

function heroText({ fullHouse, lineCount }) {
  if (fullHouse) return { heading: "Full house", body: "Every tile is done." };
  if (lineCount) return { heading: "Bingo", body: `${lineCount} line${lineCount === 1 ? "" : "s"} complete. Keep going for a full house.` };
  return null;
}

function BingoTile({ tile, inLine, saving, onToggle }) {
  const status = tile.done ? (inLine ? "In a line" : "Done") : tile.mode === "auto" ? "Ticks itself" : "Tap when done";
  const className = `bingo-cell ${tile.done ? "marked" : ""} ${inLine ? "in-line" : ""} ${tile.mode}`;
  const content = (
    <>
      {tile.done && <span className="bingo-tick" aria-hidden="true">✓</span>}
      <span className="bingo-title">{tile.title}</span>
      <span className="bingo-detail">{status}</span>
    </>
  );

  // Auto tiles complete from what you do in the app, so there's nothing to tap.
  if (tile.mode === "auto") {
    return <div className={className} title={tile.detail}>{content}<span className="sr-only">. {tile.detail}</span></div>;
  }
  return (
    <button type="button" className={className} aria-pressed={tile.done} disabled={saving} onClick={() => onToggle(tile)} title={tile.detail}>
      {content}
    </button>
  );
}

export default function BingoPage() {
  const { api, userId, authReady, pubsById, favourites, changeVersion, toast, feature, clock } = useApp();
  const weeklyOn = feature("weekly_bingo");
  const [params, setParam] = useUrlParams();
  const mode = params.get("card") === "classic" ? "classic" : "week";
  const setMode = next => setParam("card", next === "week" ? "" : next);
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
  const streak = useMemo(() => (weeklyOn ? weeklyStreak(progress || [], clock, activity, pubsById) : 0), [weeklyOn, progress, clock, activity, pubsById]);
  const lines = completedLines(card);
  const doneCount = card.filter(t => t.done).length;

  // Save newly earned auto tiles so they stay complete. If saving fails they're still shown as
  // done (they're worked out from activity) and saving is tried again on the next change.
  useEffect(() => {
    if (!userId || !progress) return;
    const toSave = card.filter(t => t.needsSaving && !savingAuto.current.has(t.id));
    if (!toSave.length) return;
    toSave.forEach(t => savingAuto.current.add(t.id));
    Promise.all(toSave.map(t => api.setBingoTile(userId, t.id, true)))
      .then(() => {
        setProgress(prev => [...prev, ...toSave.map(t => ({ tile_id: t.id, completed_at: new Date().toISOString() }))]);
        toast(toSave.length === 1 ? `Bingo tile complete: ${toSave[0].title}` : `${toSave.length} bingo tiles complete.`, "success");
      })
      .catch(() => {})
      .finally(() => toSave.forEach(t => savingAuto.current.delete(t.id)));
  }, [api, userId, card, progress, toast]);

  async function setTile(tile, next) {
    setSaving(tile.id);
    try {
      await api.setBingoTile(userId, tile.id, next);
      setProgress(prev => (next
        ? [...prev.filter(row => row.tile_id !== tile.id), { tile_id: tile.id, completed_at: new Date().toISOString() }]
        : prev.filter(row => row.tile_id !== tile.id)));
      return true;
    } catch (err) {
      toast(friendlyError(err, "Couldn't save your bingo card. Check your connection and tap the tile again."), "error");
      return false;
    } finally {
      setSaving(null);
    }
  }

  // Unticking is easy to do by accident one-handed, so it offers Undo rather than asking first.
  async function toggle(tile) {
    const next = !tile.done;
    const saved = await setTile(tile, next);
    if (saved && !next) {
      toast(`Unticked “${tile.title}”.`, "info", { action: { label: "Undo", onClick: () => setTile(tile, true) } });
    }
  }

  if (!authReady) return <Loading />;
  if (!userId) {
    return <SignInPrompt title="Pub Bingo challenge card">Sign in to play. Your card is saved to your account, and some tiles complete automatically as you report prices, favourite pubs and share photos.</SignInPrompt>;
  }
  if (error) return <ErrorState title="Couldn't load your bingo card" message={error} onRetry={() => setRetry(r => r + 1)} />;
  if (!progress) return <Loading label="Loading your card…" />;

  const inLine = new Set(lines.flat());
  const win = heroText({ fullHouse: isFullHouse(card), lineCount: lines.length });

  return (
    <>
      {weeklyOn && (
        <div className="tab-row">
          <Segmented label="Bingo cards" value={mode} onChange={setMode} options={[{ value: "week", label: "This week" }, { value: "classic", label: "Classic card" }]} />
          <NotLaunched feature="weekly_bingo" />
        </div>
      )}
      <section className={`hero-card ${win ? "bingo" : ""}`} aria-labelledby="bingo-heading">
        <p className="eyebrow">{showWeek ? `Week of ${formatDate(start)} – ${formatDate(addDays(start, 6))}` : "Your challenge card"}</p>
        <div role="status" aria-live="polite">
          <h2 id="bingo-heading">{win ? win.heading : `${doneCount} of ${card.length} done`}</h2>
          <p>{win ? win.body : "Complete a row, column or diagonal to get Bingo."}</p>
        </div>
        {showWeek && <p className="streak">Streak: <strong>{streak} week{streak === 1 ? "" : "s"}</strong> with a line. A new card starts every Monday.</p>}
      </section>

      <section className="card">
        <ul className="bingo-grid">
          {card.map((tile, index) => (
            <li key={tile.id}>
              <BingoTile tile={tile} inLine={inLine.has(index)} saving={saving === tile.id} onToggle={toggle} />
            </li>
          ))}
        </ul>
        <p className="muted small-text">Dashed tiles tick themselves from what you do in the app. Tap the others once you've done them.</p>
      </section>
    </>
  );
}
