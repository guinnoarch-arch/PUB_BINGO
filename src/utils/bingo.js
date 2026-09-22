import { FREE_SQUARE_LABEL } from "../data/defaultSquares.js";
import { createId } from "./ids.js";

export const CARD_SIZES = [3, 4, 5];

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A free centre square only exists on odd-sized cards.
export function hasCentreSquare(size) {
  return size % 2 === 1;
}

export function squaresNeeded(size, freeCentre) {
  return size * size - (freeCentre && hasCentreSquare(size) ? 1 : 0);
}

export function createCard({ squares, size = 5, freeCentre = true, title = "" }) {
  const pool = (squares || []).map(text => String(text || "").trim()).filter(Boolean);
  const needed = squaresNeeded(size, freeCentre);
  if (pool.length < needed) {
    throw new Error(`You need at least ${needed} squares for a ${size}×${size} card (you have ${pool.length}).`);
  }

  const picked = shuffle(pool).slice(0, needed);
  const centreIndex = Math.floor((size * size) / 2);
  const useFree = freeCentre && hasCentreSquare(size);
  const cells = [];

  for (let index = 0; index < size * size; index += 1) {
    if (useFree && index === centreIndex) {
      cells.push({ id: createId("cell"), text: FREE_SQUARE_LABEL, marked: true, free: true });
    } else {
      cells.push({ id: createId("cell"), text: picked.shift(), marked: false, free: false });
    }
  }

  return {
    id: createId("card"),
    title: title || "Tonight's card",
    size,
    cells,
    createdAt: new Date().toISOString(),
    completedLines: [],
    bingoAt: null
  };
}

// Every row, column and both diagonals, as lists of cell indexes.
export function getAllLines(size) {
  const lines = [];
  for (let r = 0; r < size; r += 1) {
    lines.push({ key: `row-${r}`, cells: Array.from({ length: size }, (_, c) => r * size + c) });
  }
  for (let c = 0; c < size; c += 1) {
    lines.push({ key: `col-${c}`, cells: Array.from({ length: size }, (_, r) => r * size + c) });
  }
  lines.push({ key: "diag-down", cells: Array.from({ length: size }, (_, i) => i * size + i) });
  lines.push({ key: "diag-up", cells: Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)) });
  return lines;
}

export function findCompletedLines(card) {
  if (!card) return [];
  return getAllLines(card.size)
    .filter(line => line.cells.every(index => card.cells[index]?.marked))
    .map(line => line.key);
}

export function getCardStats(card) {
  if (!card) return { marked: 0, total: 0, lines: 0, fullHouse: false };
  const playable = card.cells.filter(cell => !cell.free);
  const marked = playable.filter(cell => cell.marked).length;
  return {
    marked,
    total: playable.length,
    lines: findCompletedLines(card).length,
    fullHouse: card.cells.every(cell => cell.marked)
  };
}

export function toggleCell(card, cellId) {
  const cells = card.cells.map(cell => (
    cell.id === cellId && !cell.free ? { ...cell, marked: !cell.marked } : cell
  ));
  const next = { ...card, cells };
  const completedLines = findCompletedLines(next);
  return {
    ...next,
    completedLines,
    bingoAt: completedLines.length ? (card.bingoAt || new Date().toISOString()) : null
  };
}

export function getCellIndexesInLines(card) {
  const lineKeys = new Set(card?.completedLines || []);
  const indexes = new Set();
  getAllLines(card?.size || 0)
    .filter(line => lineKeys.has(line.key))
    .forEach(line => line.cells.forEach(index => indexes.add(index)));
  return indexes;
}
