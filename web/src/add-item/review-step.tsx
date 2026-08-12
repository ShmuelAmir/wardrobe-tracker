import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';
import { ImagePreview } from './image-preview';
import { ReviewFields, useReviewForm } from './review-form';
import { uploadImage } from './upload-image';

/**
 * Step 3 — Review & fill (§5.6) in Create mode: the confirmed image plus the
 * shared field set, committed as an upload and an insert.
 *
 * The two halves are separate on purpose (§4.4). The upload runs **here, on
 * submit** — not at file pick — and its storage id goes into the draft, so a
 * failed insert leaves a Save that retries against the file already stored. The
 * user is never sent back through the walk to recover from it (invariant #6).
 */
export function ReviewStep() {
  const navigate = useNavigate();
  const { image, storageId, setStorageId } = useAddItemDraft();
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const create = useMutation(api.items.create);
  const state = useReviewForm();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (image === null) return <Navigate to="/" replace />;

  async function save() {
    const submission = state.build();
    if (submission === null || image === null || saving) return;

    setSaving(true);
    setFailed(false);
    try {
      let stored = storageId;
      if (stored === null) {
        stored = await uploadImage(await generateUploadUrl(), image.blob);
        setStorageId(stored);
      }

      await create({ image: stored, ...submission });
      // `replace`, so the terminal step consumes this one's history entry and
      // Back can never land on a form that has already been submitted (§5.8).
      navigate('/add/saved', { replace: true });
    } catch {
      setSaving(false);
      setFailed(true);
    }
  }

  return (
    <div className="wizard__body" data-surface="add-review">
      <h1 className="wizard__title">Review</h1>
      <ImagePreview blob={image.blob} className="review__image" />

      <ReviewFields state={state} />

      {failed && (
        <p className="wizard__error" role="alert">
          Couldn’t save this item. Your details are still here — try again.
        </p>
      )}

      <button
        className="wizard__cta"
        type="button"
        disabled={state.category === null || saving}
        onClick={save}
      >
        Save
      </button>
    </div>
  );
}
