import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';
import { normalizeImage } from './normalize-image';

/**
 * Step 1 — pick a source (§5.1). The file lands normalized (§4.2) and goes into
 * the draft; the upload waits for Save (§4.4), so nothing is stored for an item
 * the user walks away from.
 *
 * A file that cannot be decoded silences **this source in place** rather than
 * ending the flow: the reason sits under the tile, the picker stays live, and
 * the wizard never restarts (invariant #6).
 */
export function SourceStep() {
  const navigate = useNavigate();
  const { setImage } = useAddItemDraft();
  const [failed, setFailed] = useState(false);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (file === undefined) return;

    setFailed(false);
    try {
      setImage(await normalizeImage(file));
      navigate('/add/confirm');
    } catch {
      setFailed(true);
      // Without this the same file re-picked fires no `change` event, and the
      // retry the copy invites would look like a dead control.
      input.value = '';
    }
  }

  return (
    <div className="wizard__body" data-surface="add-source">
      <h1 className="wizard__title">Add an item</h1>

      <label className="wizard__tile">
        <span className="wizard__tile-title">Upload a file</span>
        <span className="wizard__tile-subtitle">Pick a photo you already have</span>
        <input className="wizard__file" type="file" accept="image/*" onChange={pick} />
      </label>

      {failed && (
        <p className="wizard__error" role="alert">
          That file couldn’t be read as an image. Try a different one.
        </p>
      )}
    </div>
  );
}
