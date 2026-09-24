import { useApp } from "../../lib/AppContext.jsx";

// "@sam ✓": the tick shows for trusted reporters (when that feature is on).
export default function ReporterName({ username, fallback = "Someone" }) {
  const { feature, extras } = useApp();
  if (!username) return <>{fallback}</>;
  const trusted = feature("trusted_reporters") && extras.trusted.has(username);
  return (
    <>
      @{username}
      {trusted && <span className="trusted-tick" title="Trusted reporter: their prices keep matching other people's" aria-label="trusted reporter"> ✓</span>}
    </>
  );
}
