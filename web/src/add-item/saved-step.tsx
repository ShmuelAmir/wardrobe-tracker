import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';

/**
 * Step 4 — Saved (§5.1). Reaching it *is* the successful write, so this is where
 * the draft record is dropped (§5.7): dropping it in the submit handler instead
 * would empty the draft while the Review step is still mounted, and its own dead-
 * step guard would race the navigation here.
 *
 * The two exits are the whole point of keeping this step. **Add another** starts
 * a second walk with a clean draft — the one affordance that makes bulk-adding
 * bearable — and **Done** returns to the wardrobe, where the new tile is already
 * live because the grid query is reactive.
 */
export function SavedStep() {
  const navigate = useNavigate();
  const { clear } = useAddItemDraft();

  useEffect(clear, [clear]);

  return (
    <div className="wizard__body wizard__body--centered" data-surface="add-saved">
      <p className="wizard__check" aria-hidden="true">
        ✓
      </p>
      <h1 className="wizard__title">Added to your wardrobe</h1>

      <div className="wizard__actions">
        <button
          className="wizard__cta wizard__cta--secondary"
          type="button"
          onClick={() => navigate('/add', { replace: true })}
        >
          Add another
        </button>
        <button className="wizard__cta" type="button" onClick={() => navigate('/')}>
          Done
        </button>
      </div>
    </div>
  );
}
