import { CircleAlert } from "lucide-react";

export function Loading({ label = "Loading…" }) {
  return (
    <div className="state-box" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// title says what didn't work ("Couldn't load the feed"); message says why and what to do.
export function ErrorState({ title = "This didn't load", message, onRetry }) {
  return (
    <div className="state-box error" role="alert">
      <CircleAlert className="state-icon" aria-hidden="true" />
      <strong>{title}</strong>
      {message && <span>{message}</span>}
      {onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="state-box empty">
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}
