/**
 * §4.1/§4.2 — the client half of the image pipeline: decode → resize → JPEG.
 * One normalized file per item, no original and no thumbnail, because Convex
 * storage offers no transforms and every grid render is billed egress (§2.2).
 */

/** The long edge, in CSS pixels. A source already inside it is left alone. */
const MAX_EDGE = 1200;

/**
 * **JPEG is forced, not chosen.** Safari decodes WebP and AVIF but cannot
 * *encode* either through `canvas.toBlob`, so offering a format choice would
 * produce a silent `image/png` fallback — several times the bytes — on the one
 * browser this app is aimed at.
 */
const STORED_TYPE = 'image/jpeg';
const STORED_QUALITY = 0.8;

export type ImageSize = { width: number; height: number };

/** The normalized bytes plus the size they actually decode at. */
export type NormalizedImage = ImageSize & { blob: Blob };

/**
 * The target size for a source of these dimensions: the long edge capped at
 * `MAX_EDGE`, the other axis scaled with it, and **never an upscale** — a 400px
 * product photo is stored at 400px, because inventing pixels costs bytes and
 * adds nothing.
 */
export function resizePlan(width: number, height: number): ImageSize {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };

  const scale = MAX_EDGE / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * The cap, in the shape `createImageBitmap` takes it. **Only the long edge is
 * named**: the decoder derives the other axis from the source's own ratio, so
 * nothing here can stretch an image, and a source already inside the cap is
 * decoded with no resize at all rather than at a size it has to be talked into.
 */
function decodeCap({ width, height }: ImageSize): ImageBitmapOptions {
  const target = resizePlan(width, height);
  // Both axes, because either one alone can round back to its source: a 1×2000
  // sliver scales to 0.6px wide and rounds to the 1px it started at, which a
  // width-only test reads as "already in bounds".
  if (target.width === width && target.height === height) return {};

  return width >= height ? { resizeWidth: target.width } : { resizeHeight: target.height };
}

/**
 * The source's dimensions, read off an `<img>` rather than a decoded bitmap:
 * they are needed to pick the axis to cap, and asking `createImageBitmap` for
 * them first would materialize the full-size decode this exists to avoid. The
 * intrinsic size an `<img>` reports is already EXIF-corrected, so it agrees with
 * what the decode below produces.
 */
function sourceSize(file: Blob): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = new Image();

    probe.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image"));
    };
    probe.src = url;
  });
}

/**
 * Two problems are solved by this shape and must not be re-solved:
 *
 *  - **EXIF orientation** — `createImageBitmap`'s `imageOrientation` defaults to
 *    `"from-image"`, so a phone photo arrives already upright and no rotation
 *    step belongs here.
 *  - **iOS canvas dimension caps** — the resize happens *during* decode, so
 *    neither a full-size bitmap nor an oversized canvas is ever materialized.
 *    Decoding at full size and scaling afterwards is what trips the cap.
 */
export async function normalizeImage(file: Blob): Promise<NormalizedImage> {
  const bitmap = await createImageBitmap(file, {
    ...decodeCap(await sourceSize(file)),
    resizeQuality: 'high',
  });
  const { width, height } = bitmap;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error("This browser can't process that image");
  context.drawImage(bitmap, 0, 0);

  // The handle holds decoded pixels until GC otherwise.
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, STORED_TYPE, STORED_QUALITY),
  );
  if (blob === null) throw new Error("This browser can't process that image");

  return { blob, width, height };
}
