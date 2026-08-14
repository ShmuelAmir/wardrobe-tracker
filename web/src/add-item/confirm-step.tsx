import { Navigate, useNavigate } from 'react-router';

import { useAddItemDraft } from './add-item-draft';
import { ImagePreview } from './image-preview';

/**
 * Step 2 on the file path — confirm the photo (§5.2). What it previews is the
 * **normalized** blob, so the screen shows the image that will actually be
 * stored rather than the one that was picked.
 *
 * A step with no draft behind it is a dead screen — reached by a deep link, or
 * by Back from the terminal step after the record was dropped — so it bounces to
 * the wardrobe instead of rendering an empty frame (§5.8).
 */
export function ConfirmStep() {
  const navigate = useNavigate();
  const { image } = useAddItemDraft();

  if (image === null) return <Navigate to="/" replace />;

  return (
    <div className="wizard__body" data-surface="add-confirm">
      <h1 className="wizard__title">Confirm photo</h1>
      <ImagePreview image={image} className="wizard__preview" />
      <button className="wizard__cta" type="button" onClick={() => navigate('/add/review')}>
        Use this photo
      </button>
    </div>
  );
}
