import { useState } from "react";
import { squaresNeeded } from "../utils/bingo.js";

export default function SquaresPage({ appData, actions }) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const { cardSize, freeCentre } = appData.settings;
  const enabledCount = appData.squares.filter(sq => sq.enabled !== false).length;
  const needed = squaresNeeded(cardSize, freeCentre);

  function submitNew(event) {
    event.preventDefault();
    if (!newText.trim()) return;
    actions.addSquare(newText);
    setNewText("");
  }

  function saveEdit(id) {
    if (editText.trim()) actions.updateSquare(id, { text: editText.trim() });
    setEditingId(null);
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Your squares</p>
          <h2>Squares</h2>
        </div>
        <span className={`pill ${enabledCount >= needed ? "good" : "warn"}`}>
          {enabledCount} on · {needed} needed
        </span>
      </div>

      <section className="card">
        <form className="inline-form" onSubmit={submitNew}>
          <input
            value={newText}
            onChange={event => setNewText(event.target.value)}
            placeholder="Add a square…"
            maxLength={80}
            aria-label="New square"
          />
          <button type="submit" className="primary-button">Add</button>
        </form>
        <p className="muted small-text">Switch squares off to keep them out of new cards without deleting them.</p>
      </section>

      <section className="card list-card">
        {appData.squares.length === 0 && <p className="muted">No squares yet. Add some above or reset to the starter list.</p>}
        {appData.squares.map(square => (
          <div key={square.id} className={`list-row ${square.enabled === false ? "disabled" : ""}`}>
            <label className="switch" title={square.enabled === false ? "Off" : "On"}>
              <input
                type="checkbox"
                checked={square.enabled !== false}
                onChange={event => actions.updateSquare(square.id, { enabled: event.target.checked })}
                aria-label={`Use "${square.text}" in new cards`}
              />
              <span />
            </label>
            {editingId === square.id ? (
              <input
                className="list-row-input"
                value={editText}
                autoFocus
                maxLength={80}
                onChange={event => setEditText(event.target.value)}
                onBlur={() => saveEdit(square.id)}
                onKeyDown={event => {
                  if (event.key === "Enter") saveEdit(square.id);
                  if (event.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span className="list-row-text">{square.text}</span>
            )}
            <div className="row-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => { setEditingId(square.id); setEditText(square.text); }}
              >
                Edit
              </button>
              <button type="button" className="text-button danger" onClick={() => actions.removeSquare(square.id)}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Start again</h3>
        <p className="muted">Put back the starter list of squares. Your current card isn't changed.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => { if (window.confirm("Replace your squares with the starter list?")) actions.resetSquares(); }}
        >
          Reset to starter squares
        </button>
      </section>
    </>
  );
}
