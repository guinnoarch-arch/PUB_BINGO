import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/AppContext.jsx";
import { friendlyError } from "../lib/api/errors.js";
import { formatDay } from "../lib/core/time.js";
import { EmptyState, ErrorState, Loading } from "../components/ui/States.jsx";
import AdminEvents from "../components/events/AdminEvents.jsx";
import MenuImport from "../components/pub/MenuImport.jsx";
import AdminDeals from "../components/admin/AdminDeals.jsx";
import AdminHours from "../components/admin/AdminHours.jsx";
import NotLaunched from "../components/ui/NotLaunched.jsx";
import UploadsPausedToggle from "../components/pub/UploadsPausedToggle.jsx";
import PubDetailsForm from "../components/admin/pub/PubDetailsForm.jsx";
import ResearchNotes from "../components/admin/pub/ResearchNotes.jsx";
import DrinksTable from "../components/admin/pub/DrinksTable.jsx";
import { SubmissionDetails, SubmissionFile, SubmissionReview } from "../components/suggestions/AdminMenus.jsx";
import { ChevronLeft } from "lucide-react";
import { usePageTitle } from "../lib/hooks/usePageTitle.js";

export default function AdminPubPage() {
  const { pubId } = useParams();
  const isNew = pubId === "new";
  const navigate = useNavigate();
  const { api, authReady, isAdmin, changeVersion } = useApp();
  const [pub, setPub] = useState(null);
  const [status, setStatus] = useState(isNew ? "ready" : "loading");
  usePageTitle(isNew ? "Add a pub" : pub?.name ? `Edit ${pub.name}` : "Admin");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(k => k + 1), []);
  const [params, setParams] = useSearchParams();
  const submissionId = params.get("submission");
  const [submission, setSubmission] = useState(null);
  const [submissionKey, setSubmissionKey] = useState(0);

  // Opened from Admin → Menus sent in: show that menu beside the drinks.
  useEffect(() => {
    if (!submissionId || !isAdmin) { setSubmission(null); return undefined; }
    let active = true;
    api.admin.getMenuSubmission(submissionId)
      .then(row => active && setSubmission(row && row.pub_id === pubId ? row : null))
      .catch(() => active && setSubmission(null));
    return () => { active = false; };
  }, [api, submissionId, isAdmin, pubId, submissionKey]);
  const priceDefaults = useMemo(() => (submission ? {
    observedOn: submission.seen_on,
    note: `From a menu sent in${submission.sender?.username ? ` by @${submission.sender.username}` : ""}, seen ${formatDay(submission.seen_on, { weekday: true })}`.slice(0, 200)
  } : null), [submission]);

  useEffect(() => {
    if (isNew || !isAdmin) return undefined;
    let active = true;
    api.admin.getPub(pubId)
      .then(data => { if (active) { setPub(data); setStatus(data ? "ready" : "missing"); } })
      .catch(err => { if (active) { setError(friendlyError(err)); setStatus("error"); } });
    return () => { active = false; };
  }, [api, pubId, isNew, isAdmin, changeVersion, reloadKey]);

  if (!authReady) return <Loading />;
  if (!isAdmin) return <section className="card"><EmptyState asHeading title="Admins only"><p>This page is for Pub Bingo admins.</p><Link className="secondary-button" to="/">Back to search</Link></EmptyState></section>;
  if (status === "loading") return <Loading label="Loading pub…" />;
  if (status === "error") return <ErrorState title="Couldn't load this pub" message={error} onRetry={reload} />;
  if (status === "missing") return <section className="card"><EmptyState asHeading title="Pub not found"><p>There\'s no pub with that ID. It may have been renamed.</p><Link className="secondary-button" to="/admin">Back to all pubs</Link></EmptyState></section>;

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/admin"><ChevronLeft aria-hidden="true" />All pubs</Link></nav>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Admin · {isNew ? "New pub" : pub.area}</p>
          <h1>{isNew ? "Add a pub" : pub.name}</h1>
        </div>
        {!isNew && <span className={`status-pill ${pub.is_published ? "live" : "hidden"}`}>{pub.is_published ? "Live" : "Hidden"}</span>}
      </div>

      <section className="card" aria-labelledby="details-heading">
        <h2 id="details-heading" className="section-title">Pub details</h2>
        <PubDetailsForm
          key={isNew ? "new" : pub.id}
          pub={pub}
          isNew={isNew}
          onSaved={saved => (isNew ? navigate(`/admin/pubs/${saved.id}`, { replace: true }) : reload())}
        />
      </section>

      {!isNew && (
        <>
          {submission && (
            <section className="card submission-panel" aria-labelledby="submission-heading">
              <div className="section-header">
                <h2 id="submission-heading" className="section-title">Menu sent in</h2>
                <button type="button" className="text-button" onClick={() => setParams({}, { replace: true })}>Close</button>
              </div>
              <div className="submission">
                <SubmissionFile item={submission} large />
                <div className="submission-body">
                  <SubmissionDetails item={submission} />
                  <p className="muted small-text">
                    Use <strong>Set price</strong> below: the date and a note are filled in from this menu, and it's saved as <strong>Verified</strong>. An older price is added to the history but won't replace a newer one.
                    {submission.file_kind === "pdf" && " For a PDF, you can also read all the prices at once in “Import prices from a PDF menu”."}
                    {" "}When you're done, set it to “Used to update prices” and save.
                  </p>
                  <SubmissionReview key={`${submission.id}-${submission.status}-${submission.admin_note}`} item={submission} compact onChanged={() => setSubmissionKey(k => k + 1)} />
                </div>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="drinks-heading">
            <div className="section-header">
              <h2 id="drinks-heading" className="section-title">Drinks and prices ({(pub.drinks || []).length})</h2>
            </div>
            <p className="muted small-text">
              Use “Set price” when you've read a price on the pub's own menu (add the link) or checked it in person. It's saved in the drink's history and shown with a “Pub website” or “Verified” badge.
            </p>
            <DrinksTable pub={pub} priceDefaults={priceDefaults} onChanged={reload} />
          </section>

          <section className="card" aria-labelledby="menu-import-heading">
            <h2 id="menu-import-heading" className="section-title">Import prices from a PDF menu</h2>
            <MenuImport pub={pub} submission={submission?.file_kind === "pdf" ? submission : null} onImported={() => { reload(); setSubmissionKey(k => k + 1); }} />
          </section>

          <section className="card" aria-labelledby="deals-admin-heading">
            <div className="section-header">
              <h2 id="deals-admin-heading" className="section-title">Happy hours</h2>
              <NotLaunched feature="happy_hours" />
            </div>
            <p className="muted small-text">While a published deal is on, search, the map and the leaderboard show the deal price and when it ends (once “Happy hours” is live in Admin → Features).</p>
            <AdminDeals pub={pub} />
          </section>

          <section className="card" aria-labelledby="hours-admin-heading">
            <div className="section-header">
              <h2 id="hours-admin-heading" className="section-title">Opening hours</h2>
              <NotLaunched feature="pub_filters" />
            </div>
            <AdminHours key={pub.id} pub={pub} onSaved={reload} />
          </section>

          <section className="card" aria-labelledby="events-admin-heading">
            <h2 id="events-admin-heading" className="section-title">What's on (events)</h2>
            <p className="muted small-text">Events found by web research start as “Needs checking”. Check the source, fix the details if needed, then publish. Features like beer garden or sport on TV are the tags in Pub details above.</p>
            <AdminEvents pub={pub} />
          </section>

          <section className="card" aria-labelledby="research-heading">
            <h2 id="research-heading" className="section-title">Price research (admins only)</h2>
            <ResearchNotes key={pub.id} pub={pub} onSaved={reload} />
          </section>

          <section className="card" aria-labelledby="photos-admin-heading">
            <h2 id="photos-admin-heading" className="section-title">Photos</h2>
            <UploadsPausedToggle pubId={pub.id} paused={pub.uploads_paused} onChange={paused => setPub(prev => ({ ...prev, uploads_paused: paused }))} />
            <p className="muted small-text">Hide or delete individual photos from the <Link to={`/pubs/${pub.id}`}>pub's page</Link>.</p>
          </section>
        </>
      )}
    </>
  );
}
