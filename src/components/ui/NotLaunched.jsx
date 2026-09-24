import { useApp } from "../../lib/AppContext.jsx";

// Admins see features before launch; this tag reminds them the public can't see it yet.
export default function NotLaunched({ feature: key }) {
  const { isAdmin, featureLive } = useApp();
  if (!isAdmin || featureLive(key)) return null;
  return <span className="not-launched" title="Only admins can see this until it's launched in Admin → Features">Not launched</span>;
}
