import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';

import { normalizeImage } from './normalize-image';
import type { NormalizedImage } from './normalize-image';

/**
 * §5.5 — the image slot on a dead-ended Review. The fallback is **paste or drag
 * an image**, not take a photo: the mandatory-photo fallback assumed you were
 * holding the garment, which web import contradicts by design — the user has the
 * product page open in another tab, and the image is one copy away.
 *
 * All three affordances land on the same normalize (§4.2), and a file that
 * cannot be decoded silences itself in place rather than ending the walk
 * (invariant #6).
 */
export function ImageDropZone({
  message,
  onImage,
}: {
  /** Why there is no image yet — the outcome's own words, not a rewrite. */
  message: string | null;
  onImage: (image: NormalizedImage) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [over, setOver] = useState(false);

  async function accept(file: Blob | undefined | null) {
    if (file === undefined || file === null) return false;

    setFailed(false);
    try {
      onImage(await normalizeImage(file));
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }

  // Paste is bound to the document rather than to this element: a clipboard
  // paste has no target until something is focused, and demanding a click first
  // would make the affordance the copy promises quietly conditional.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.items ?? [])].find((item) =>
        item.type.startsWith('image/'),
      );
      if (image !== undefined) void accept(image.getAsFile());
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // `onImage` is the draft's stable writer, so the listener is bound once.
  }, [onImage]);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    void accept(event.dataTransfer.files[0]);
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    // Without this the same file re-picked fires no `change` event, and the
    // retry the copy invites would look like a dead control.
    if (!(await accept(input.files?.[0]))) input.value = '';
  }

  return (
    <div
      className={`drop-zone${over ? ' drop-zone--over' : ''}`}
      data-surface="image-drop-zone"
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDrop={onDrop}
    >
      {message !== null && <p className="drop-zone__reason">{message}</p>}

      <label className="drop-zone__pick">
        <span>Add your own image — paste, drag one here, or choose a file</span>
        <input accept="image/*" className="wizard__file" onChange={onPick} type="file" />
      </label>

      {failed && (
        <p className="wizard__error" role="alert">
          That file couldn’t be read as an image. Try a different one.
        </p>
      )}
    </div>
  );
}
