import { api } from '@convex/_generated/api';
import { useAction } from 'convex/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';

/**
 * Step 3 — confirm image (§5.1): a large preview of the auto-picked best
 * candidate, with a thumbnail row to swap among the others found on the page.
 * **This step is the validation** — a homepage's hero banner returns 200 and
 * parses cleanly, so it is the user's eye here, not a URL rule, that rejects a
 * confidently wrong image (§5.3).
 *
 * "Use this image" is where the chosen candidate is downloaded, normalized and
 * stored, all inside the action (§4.2) — the browser cannot fetch those bytes
 * itself, and never sees them. The bail-out and a download that dead-ends both
 * land in the *same* place: Review, holding everything but the image (§5.5).
 */
export function ConfirmImageStep() {
  const navigate = useNavigate();
  const { clearImage, imported, setImported, setStoredImage } = useAddItemDraft();
  const importImage = useAction(api.webImport.importImage);
  const [selected, setSelected] = useState(0);
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // A step with no parse behind it is a dead screen — reached by a deep link, or
  // by Back after the record was dropped — so it bounces rather than rendering
  // an empty frame (§5.8).
  if (imported === null || imported.candidates.length === 0) return <Navigate to="/" replace />;

  // Re-bound after the guard so the narrowing survives into the handler below.
  const page = imported;
  const { candidates } = page;

  async function useThisImage() {
    if (importing) return;
    setImporting(true);
    setFailed(null);

    let outcome;
    try {
      outcome = await importImage({ url: candidates[selected] });
    } catch {
      setImporting(false);
      setFailed("Couldn't reach that image. Try again.");
      return;
    }

    if (outcome.status === 'retryable') {
      setImporting(false);
      setFailed(outcome.message);
      return;
    }
    if (outcome.status === 'dead-end') {
      // Reached again by Back after another candidate was already stored, so the
      // slot has to be emptied or Review shows that one and never says why this
      // one failed.
      clearImage();
      setImported({ ...page, message: outcome.message });
      navigate('/add/review');
      return;
    }

    setStoredImage(outcome);
    navigate('/add/review');
  }

  return (
    <div className="wizard__body" data-surface="add-confirm-image">
      <h1 className="wizard__title">Confirm image</h1>

      <img className="wizard__preview" src={candidates[selected]} alt="The image we found" />

      {candidates.length > 1 && (
        <div className="confirm-image__row">
          {candidates.map((candidate, index) => (
            <button
              aria-label={`Image ${index + 1}`}
              aria-pressed={index === selected}
              className="confirm-image__thumb"
              key={candidate}
              onClick={() => setSelected(index)}
              type="button"
            >
              <img alt="" src={candidate} />
            </button>
          ))}
        </div>
      )}

      {failed !== null && (
        <p className="wizard__error" role="alert">
          {failed}
        </p>
      )}

      <button className="wizard__cta" disabled={importing} onClick={useThisImage} type="button">
        {importing ? 'Getting the image…' : 'Use this image'}
      </button>

      <button
        className="wizard__cta wizard__cta--secondary"
        onClick={() => {
          // Reached again by Back after an image was already stored, so the slot
          // has to be emptied or the bail-out lands on one of "these".
          clearImage();
          navigate('/add/review');
        }}
        type="button"
      >
        None of these — use my own image
      </button>
    </div>
  );
}
