// Pub features people can search for on the What's on page. Keys are pub tags.
export const FEATURES = [
  { tag: "beer-garden", label: "Beer garden" },
  { tag: "outdoor-drinking", label: "Outdoor drinking" },
  { tag: "sports-tv", label: "Sport on TV" },
  { tag: "live-music", label: "Live music" },
  { tag: "quiz-night", label: "Quiz night" },
  { tag: "comedy", label: "Comedy" },
  { tag: "sing-along", label: "Sing-along" },
  { tag: "food", label: "Food" },
  { tag: "dog-friendly", label: "Dog friendly" },
  { tag: "real-ale-specialist", label: "Real ale" },
  { tag: "craft-beer", label: "Craft beer" },
  { tag: "historic", label: "Historic" },
  { tag: "no-music-no-tv", label: "Quiet (no music or TV)" }
];

export const EVENT_CATEGORIES = [
  { key: "live-music", label: "Live music" },
  { key: "sports", label: "Sport" },
  { key: "quiz", label: "Quiz" },
  { key: "comedy", label: "Comedy" },
  { key: "sing-along", label: "Sing-along" },
  { key: "open-mic", label: "Open mic" },
  { key: "tap-takeover", label: "Tap takeover" },
  { key: "food", label: "Food" },
  { key: "other", label: "Other" }
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "real-ale-specialist" → "Real ale specialist"; uses the feature's own label when there is one.
export function tagLabel(tag) {
  const feature = FEATURES.find(f => f.tag === tag);
  if (feature) return feature.label;
  const text = String(tag || "").replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
