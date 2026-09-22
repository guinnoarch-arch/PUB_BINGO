import { getCellIndexesInLines } from "../../utils/bingo.js";

export default function BingoCard({ card, onToggleCell, readOnly = false }) {
  const winningCells = getCellIndexesInLines(card);

  return (
    <div
      className={`bingo-grid size-${card.size}`}
      style={{ gridTemplateColumns: `repeat(${card.size}, minmax(0, 1fr))` }}
      role="grid"
      aria-label={`${card.size} by ${card.size} bingo card`}
    >
      {card.cells.map((cell, index) => {
        const classes = [
          "bingo-cell",
          cell.marked ? "marked" : "",
          cell.free ? "free" : "",
          winningCells.has(index) ? "in-line" : ""
        ].filter(Boolean).join(" ");

        return (
          <button
            key={cell.id}
            type="button"
            className={classes}
            onClick={() => onToggleCell?.(cell.id)}
            disabled={readOnly || cell.free}
            aria-pressed={cell.marked}
          >
            <span>{cell.text}</span>
          </button>
        );
      })}
    </div>
  );
}
