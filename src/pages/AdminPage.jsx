import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import LiveFeed from "../components/LiveFeed.jsx";
import { EmptyState, Loading } from "../components/ui/States.jsx";

export default function AdminPage() {
  const { api, authReady, isAdmin, pubs, reloadPubs, toast } = useApp();
  // Optimistic state so the switch responds immediately; rolled back if the request fails.
  const [pending, setPending] = useState({});

  if (!authReady) return <Loading />;
  if (!isAdmin) {
    return <section className="card"><EmptyState title="Admins only">This page is for Pub Bingo admins. <Link to="/">Back to search</Link></EmptyState></section>;
  }

  async function setPaused(pub, paused) {
    setPending(prev => ({ ...prev, [pub.id]: paused }));
    try {
      await api.admin.setUploadsPaused(pub.id, paused);
      toast(`${pub.name}: uploads ${paused ? "paused" : "open"}.`, "success");
      await reloadPubs({ quiet: true });
    } catch (error) {
      toast(friendlyError(error), "error");
    } finally {
      setPending(prev => {
        const next = { ...prev };
        delete next[pub.id];
        return next;
      });
    }
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Moderation</h2>
        </div>
      </div>

      <section className="card" aria-labelledby="uploads-heading">
        <h2 id="uploads-heading" className="section-title">Photo uploads by pub</h2>
        <p className="muted small-text">Pause uploads for a pub to stop new photos (for example, while dealing with spam). Existing photos stay up; hide them one by one from the pub's page.</p>
        <ul className="admin-list">
          {pubs.map(pub => {
            const paused = pending[pub.id] ?? Boolean(pub.uploads_paused);
            return (
              <li key={pub.id}>
                <Link to={`/pubs/${pub.id}`}>{pub.name}</Link>
                <label className="admin-toggle">
                  <input type="checkbox" checked={paused} disabled={pub.id in pending} onChange={e => setPaused(pub, e.target.checked)} />
                  {paused ? "Uploads paused" : "Uploads open"}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="section-title">Recent price reports</h2>
        <p className="muted small-text">Hiding a report removes it from public view and resets the drink to its previous visible price.</p>
        <LiveFeed limit={50} />
      </section>
    </>
  );
}
