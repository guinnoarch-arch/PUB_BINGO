import BingoCard from "../components/bingo/BingoCard.jsx";
import { getCardStats, squaresNeeded } from "../utils/bingo.js";

export default function PlayPage({ appData, actions, setActivePage }) {
  const card = appData.currentCard;
  const { cardSize, freeCentre } = appData.settings;
  const enabledCount = appData.squares.filter(sq => sq.enabled !== false).length;
  const needed = squaresNeeded(cardSize, freeCentre);
  const canStart = enabledCount >= needed;

  if (!card) {
    return (
      <section className="card welcome-card">
        <div className="brand-icon large"><img src="/icons/pb-icon-192.png" alt="" /></div>
        <p className="eyebrow">Ready when you are</p>
        <h2>Start a Pub Bingo card</h2>
        <p className="muted">
          You'll get a {cardSize}×{cardSize} card made from your squares. Tap a square when it happens. Get a full line to shout Bingo!
        </p>
        {canStart ? (
          <button type="button" className="primary-button big" onClick={actions.newCard}>New card</button>
        ) : (
          <>
            <p className="status-message warning">
              You need {needed} squares switched on for a {cardSize}×{cardSize} card. You have {enabledCount}.
            </p>
            <button type="button" className="secondary-button" onClick={() => setActivePage("squares")}>Edit squares</button>
          </>
        )}
      </section>
    );
  }

  const stats = getCardStats(card);
  const hasBingo = stats.lines > 0;

  return (
    <>
      <section className={`hero-card ${hasBingo ? "bingo" : ""}`}>
        <div>
          <p className="eyebrow">{card.title}</p>
          <h2>{stats.fullHouse ? "Full house!" : hasBingo ? "BINGO!" : `${stats.marked} / ${stats.total}`}</h2>
          <p>
            {hasBingo
              ? `${stats.lines} line${stats.lines === 1 ? "" : "s"} complete. Keep going for a full house.`
              : "squares marked. Tap a square when it happens."}
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="hero-button" onClick={actions.newCard} disabled={!canStart}>New card</button>
          <button type="button" className="hero-button ghost" onClick={actions.clearMarks}>Clear marks</button>
        </div>
      </section>

      <section className="card bingo-card-wrap">
        <BingoCard card={card} onToggleCell={actions.toggleCell} />
      </section>

      <section className="summary-grid">
        <div className="card summary-card">
          <p className="eyebrow">Marked</p>
          <h3>{stats.marked}</h3>
          <p className="muted">of {stats.total} squares</p>
        </div>
        <div className="card summary-card">
          <p className="eyebrow">Lines</p>
          <h3>{stats.lines}</h3>
          <p className="muted">rows, columns and diagonals</p>
        </div>
        <div className="card summary-card">
          <p className="eyebrow">Started</p>
          <h3>{new Date(card.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</h3>
          <p className="muted">{new Date(card.createdAt).toLocaleDateString()}</p>
        </div>
      </section>
    </>
  );
}
