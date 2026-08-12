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
 * Two problems are solved by this shape and must not be re-solved:
 *
 *  - **EXIF orientation** — `createImageBitmap`'s `imageOrientation` defaults to
 *    `"from-image"`, so a phone photo arrives already upright and no rotation
 *    step belongs here.
 *  - **iOS canvas dimension caps** — the resize happens *during* decode, so the
 *    canvas is only ever the target size. Decoding at full size and scaling on
 *    the canvas is what trips the cap.
 */
export async function normalizeImage(file: Blob): Promise<NormalizedImage> {
  const source = await createImageBitmap(file);
  const { width, height } = resizePlan(source.width, source.height);

  const bitmap =
    width === source.width && height === source.height
      ? source
      : await createImageBitmap(source, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: 'high',
        });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error("This browser can't process that image");
  context.drawImage(bitmap, 0, 0);

  // Both handles hold decoded pixels until GC otherwise, and the source one can
  // be the full-size decode.
  source.close();
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, STORED_TYPE, STORED_QUALITY),
  );
  if (blob === null) throw new Error("This browser can't process that image");

  return { blob, width, height };
}
