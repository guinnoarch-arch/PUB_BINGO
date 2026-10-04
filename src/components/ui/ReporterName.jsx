import { useApp } from "../../lib/AppContext.jsx";
import { BadgeCheck } from "lucide-react";

// "@sam" plus a tick for trusted reporters (when that feature is on).
export default function ReporterName({ username, fallback = "Someone" }) {
  const { feature, extras } = useApp();
  if (!username) return <>{fallback}</>;
  const trusted = feature("trusted_reporters") && extras.trusted.has(username);
  return (
    <>
      @{username}
      {trusted && <span className="trusted-tick" title="Trusted reporter: their prices keep matching other people's" > <BadgeCheck aria-hidden="true" /><span className="sr-only">(trusted reporter)</span></span>}
    </>
  );
}
