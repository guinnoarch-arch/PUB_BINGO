import { getCardStats } from "../utils/bingo.js";

export default function HistoryPage({ appData, actions }) {
  const history = appData.history;

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Past nights</p>
          <h2>History</h2>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => { if (window.confirm("Clear all saved history?")) actions.clearHistory(); }}
          >
            Clear history
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <section className="card">
          <p className="muted">No finished cards yet. When you start a new card, the old one is saved here.</p>
        </section>
      ) : (
        <section className="card list-card">
          {history.map(card => {
            const stats = getCardStats(card);
            return (
              <div key={card.id} className="list-row">
                <div className="list-row-text">
                  <strong>{card.title}</strong>
                  <span className="muted small-text">
                    {new Date(card.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {card.size}×{card.size}
                  </span>
                </div>
                <span className={`pill ${stats.lines ? "good" : ""}`}>
                  {stats.fullHouse ? "Full house" : stats.lines ? `${stats.lines} line${stats.lines === 1 ? "" : "s"}` : `${stats.marked}/${stats.total}`}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
