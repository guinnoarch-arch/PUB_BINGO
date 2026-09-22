export const NAV_ITEMS = [
  ["play", "Play"],
  ["squares", "Squares"],
  ["history", "History"],
  ["settings", "Settings"]
];

export default function TopNav({ activePage, setActivePage }) {
  return (
    <nav className="top-nav" aria-label="Main">
      {NAV_ITEMS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`nav-item ${activePage === key ? "active" : ""}`}
          aria-current={activePage === key ? "page" : undefined}
          onClick={() => setActivePage(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
