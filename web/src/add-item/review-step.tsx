import { sourceHostname } from '@/source-url';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAddItemDraft, type DraftImage } from './add-item-draft';
import { ImageDropZone } from './image-drop-zone';
import { ImagePreview } from './image-preview';
import { ReviewFields, useReviewForm } from './review-form';
import { uploadImage } from './upload-image';

/**
 * Step 4 — Review & fill (§5.6) in Create mode: an image plus the shared field
 * set, committed as an insert. On the web-import path the fields arrive
 * pre-filled from the page and `sourceUrl` rides along (§5.1).
 *
 * **The image slot is a drop zone when there is nothing in it** — the §5.5 dead
 * end, where a page was read but its image could not be. Everything else the
 * parse found is already here, and the source URL is a link, so the page you
 * were looking at is one click away.
 *
 * Image and fields commit separately on purpose (§4.4). An uploaded file is
 * stored **here, on submit** — not at file pick — and its storage id goes into
 * the draft, so a failed insert retries against the file already stored. A web
 * import is stored already, and skips the upload entirely. The user is never
 * sent back through the walk to recover from any of it (invariant #6).
 */
export function ReviewStep() {
  const navigate = useNavigate();
  const { image, storageId, imported, setImage, setStorageId } = useAddItemDraft();
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const create = useMutation(api.items.create);
  const state = useReviewForm({ name: imported?.name, brand: imported?.brand });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // A walk with neither an image nor a parse behind it has nothing to review
  // (§5.8) — a dead end still has the parse, so it renders.
  if (image === null && imported === null) return <Navigate to="/" replace />;

  /**
   * The id of the file this image occupies in storage, uploading it first only
   * if that has not happened yet. A web import was stored by the action before
   * this screen rendered; a local file is stored here, once, and the id is kept
   * so a retried insert costs no second upload (§4.4).
   */
  async function storedFile(picked: DraftImage): Promise<Id<'_storage'>> {
    if (picked.kind === 'stored') return picked.storageId;
    if (storageId !== null) return storageId;

    const uploaded = await uploadImage(await generateUploadUrl(), picked.blob);
    setStorageId(uploaded);
    return uploaded;
  }

  async function save() {
    const submission = state.build();
    if (submission === null || image === null || saving) return;

    setSaving(true);
    setFailed(false);
    try {
      await create({ image: await storedFile(image), ...submission, sourceUrl: imported?.sourceUrl });
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

      {image === null ? (
        <ImageDropZone message={imported?.message ?? null} onImage={setImage} />
      ) : (
        <ImagePreview image={image} className="review__image" />
      )}

      {imported !== null && (
        <p className="review__source">
          From{' '}
          <a href={imported.sourceUrl} rel="noreferrer" target="_blank">
            {sourceHostname(imported.sourceUrl)}
          </a>
        </p>
      )}

      <ReviewFields state={state} />

      {failed && (
        <p className="wizard__error" role="alert">
          Couldn’t save this item. Your details are still here — try again.
        </p>
      )}

      <button
        className="wizard__cta"
        type="button"
        disabled={state.category === null || image === null || saving}
        onClick={save}
      >
        Save
      </button>
    </div>
  );
}
