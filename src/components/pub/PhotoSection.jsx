import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/AppContext.jsx";
import { friendlyError } from "../../lib/api/errors.js";
import { validatePhotoFile } from "../../lib/api/photos.js";
import { cleanText } from "../../lib/core/prices.js";
import PubImage, { hasCover } from "./PubImage.jsx";
import { PUB_COVERS } from "../../data/pubCovers.js";

export default function PhotoSection({ pub, photos, onChanged }) {
  const { api, userId, isAdmin, toast } = useApp();
  const fileRef = useRef(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pausedView, setPausedView] = useState(pub.uploads_paused);
  useEffect(() => setPausedView(pub.uploads_paused), [pub.uploads_paused]);

  async function upload(event) {
    event.preventDefault();
    setError("");
    const file = fileRef.current?.files?.[0];
    const problem = validatePhotoFile(file);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      await api.uploadPhoto(userId, pub.id, file, cleanText(caption).slice(0, 140));
      toast("Photo uploaded. Thanks!", "success");
      setCaption("");
      fileRef.current.value = "";
      onChanged();
    } catch (err) {
      setError(friendlyError(err, "Couldn't upload your photo."));
    } finally {
      setBusy(false);
    }
  }

  async function run(action, success) {
    try {
      await action();
      toast(success, "success");
      onChanged();
      return true;
    } catch (err) {
      toast(friendlyError(err), "error");
      return false;
    }
  }

  return (
    <section className="card" aria-labelledby="photos-heading">
      <div className="section-header">
        <h2 id="photos-heading" className="section-title">Photos</h2>
        {isAdmin && (
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={pausedView}
              onChange={event => {
                const paused = event.target.checked;
                setPausedView(paused);
                run(() => api.admin.setUploadsPaused(pub.id, paused), paused ? "Uploads paused for this pub." : "Uploads re-opened.")
                  .then(ok => { if (!ok) setPausedView(!paused); });
              }}
            />
            Pause uploads
          </label>
        )}
      </div>

      <div className="photo-grid">
        {photos.map(photo => (
          <figure key={photo.id} className={photo.is_hidden ? "hidden-report" : ""}>
            <img src={api.photoUrl(photo.storage_path)} alt={photo.caption || `Photo of ${pub.name}`} loading="lazy" />
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
            {(isAdmin || photo.uploaded_by === userId) && (
              <div className="photo-actions">
                {isAdmin && (
                  <button type="button" className="text-button" onClick={() => run(() => api.admin.setPhotoHidden(photo.id, !photo.is_hidden), photo.is_hidden ? "Photo restored." : "Photo hidden.")}>
                    {photo.is_hidden ? "Unhide" : "Hide"}
                  </button>
                )}
                <button type="button" className="text-button danger" onClick={() => window.confirm("Delete this photo?") && run(() => api.deletePhoto(photo), "Photo deleted.")}>Delete</button>
              </div>
            )}
          </figure>
        ))}
        {photos.length === 0 && (
          <figure className="illustration-figure">
            <PubImage pub={pub} />
            <figcaption className="muted">
              {hasCover(pub.id) ? PUB_COVERS[pub.id].credit : "No photos yet. This is a placeholder illustration."}
            </figcaption>
          </figure>
        )}
      </div>

      {pausedView ? (
        <p className="status-message warning">Photo uploads are paused for this pub.</p>
      ) : userId ? (
        <form className="upload-form" onSubmit={upload}>
          <label htmlFor="photo-file">Add a photo</label>
          <input id="photo-file" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" />
          <label htmlFor="photo-caption" className="sr-only">Caption</label>
          <input id="photo-caption" value={caption} maxLength={140} onChange={e => setCaption(e.target.value)} placeholder="Caption (optional)" />
          <button type="submit" className="primary-button" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
          <p className="muted small-text">JPEG, PNG or WebP. Photos are resized, and location data is removed before upload.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      ) : (
        <p className="muted"><Link to={`/account?next=/pubs/${pub.id}`}>Sign in</Link> to add photos.</p>
      )}
    </section>
  );
}
