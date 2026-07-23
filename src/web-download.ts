import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

import type { CapturedImage } from './item-save';
import { BROWSER_HEADERS } from './web-import';

/**
 * §5.4 — download the chosen image at "Use this image" (step 3 → 4), **not** at
 * Save. It lands in the **cache** dir under its UUID name, which is what upholds
 * the invariant that by Review a local file exists under our UUID for every
 * source (§4.3) while the document dir still receives bytes only at Save — so an
 * abandoned wizard leaves nothing behind the OS won't reclaim.
 *
 * The result is the same `CapturedImage` the camera/library paths produce, so
 * Save (§4.4) treats a web import identically. Dimensions come from decoding the
 * downloaded file: Save's resize decision needs them, and a web image may be any
 * size (most are 1000–1600px and pass through untouched, but not all).
 */
export async function downloadCandidate(url: string, uuid: string): Promise<CapturedImage> {
  const destination = new File(Paths.cache, `${uuid}.jpg`);
  // The UUID is minted fresh at each "Use this image" tap, so the target is
  // always new; `idempotent` (a valid DownloadOptions field in expo-file-system
  // 57) just keeps the download from throwing should the OS ever hand back a
  // cache path that already holds a file.
  const file = await File.downloadFileAsync(url, destination, {
    idempotent: true,
    headers: BROWSER_HEADERS,
  });

  const ref = await Image.loadAsync(file.uri);
  return { uri: file.uri, width: ref.width, height: ref.height, uuid };
}
