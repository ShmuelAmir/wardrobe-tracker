import { useEffect, useState } from 'react';

import type { DraftImage } from './add-item-draft';

/**
 * The draft's image, from whichever end of §4.2's split it came: an uploaded
 * file is still a blob in the browser and previews from an object URL — which is
 * why Review needs no upload to show what it is about to store (§4.4) — while a
 * web import is already a stored file and previews from its serving URL.
 *
 * The object URL is revoked when the blob changes or the screen leaves, so a
 * wizard walked several times over doesn't leak a decoded image per walk.
 */
export function ImagePreview({ image, className }: { image: DraftImage; className: string }) {
  const blob = image.kind === 'local' ? image.blob : null;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (blob === null) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const src = image.kind === 'stored' ? image.url : objectUrl;

  return src === null ? null : <img className={className} src={src} alt="The item you picked" />;
}
