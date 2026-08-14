import { useEffect, useState } from 'react';

/**
 * The picked image, shown from an object URL — which is why the Review step
 * needs no upload to preview what it is about to store (§4.4). The URL is
 * revoked when the blob changes or the screen leaves, so a wizard walked several
 * times over doesn't leak a decoded image per walk.
 */
export function ImagePreview({ blob, className }: { blob: Blob; className: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url === null ? null : <img className={className} src={url} alt="The item you picked" />;
}
