import { decode, encode } from 'jpeg-js';

import { resizePlan, STORED_QUALITY, type ImageSize } from '../src/image-normalize';

/**
 * §4.2 — the server half of the image pipeline, for the one path whose bytes
 * never reach a browser: a web import is fetched by the action from a brand CDN,
 * so there is no client leg to push the resize onto. It works to the same cap,
 * format and quality as the upload path (`@/image-normalize`), and stores the
 * same single file (ADR-0006).
 *
 * Pure JavaScript, in Convex's **default runtime** — no `"use node"`, and so no
 * `sharp` and no canvas. Two consequences are real and bound anything built on
 * top of this:
 *
 *  - **JPEG in, JPEG out.** A PNG/WebP/AVIF product image is not decodable here
 *    and raises, which the caller turns into §5.5's dead end — Review with a drop
 *    zone — rather than a failure the user cannot act on.
 *  - **No EXIF auto-rotation**, unlike `createImageBitmap`'s `"from-image"`
 *    default on the upload path. Retail CDN images are server-processed and
 *    carry no orientation tag; the photos that do carry one arrive through the
 *    upload path, which handles it.
 */

/**
 * The decode guards, both sized against the default runtime's **64 MiB**. A
 * decoded frame is 4 bytes a pixel, so 30 MP is already ~120 MB of RGBA and has
 * to be refused before it is allocated rather than after.
 */
const MAX_SOURCE_MEGAPIXELS = 12;
const MAX_SOURCE_MEMORY_MB = 48;

/** The stored bytes plus the size they decode at, for the row that names them. */
export type NormalizedBytes = ImageSize & { bytes: Uint8Array };

/**
 * `jpeg-js`'s encoder returns `Buffer.from(byteout)` whenever it is loaded as
 * CommonJS, and Convex's default runtime defines no `Buffer` — the encode would
 * throw a `ReferenceError` on the only runtime it has to work on. `Buffer.from`
 * is reached there purely as a byte container, so a `Uint8Array` is an exact
 * stand-in. Guarded, so a runtime that has a real `Buffer` keeps it.
 */
function ensureByteContainer(): void {
  const scope = globalThis as { Buffer?: { from(bytes: number[]): Uint8Array } };
  scope.Buffer ??= { from: (bytes) => Uint8Array.from(bytes) };
}

/** Decode → cap the long edge → re-encode. Raises on bytes it cannot decode. */
export function normalizeJpeg(source: Uint8Array): NormalizedBytes {
  // `useTArray` keeps the *decode* off `Buffer` too — that path has its own
  // `Buffer.alloc`, and unlike the encoder it offers a way out.
  const decoded = decode(source, {
    useTArray: true,
    maxResolutionInMP: MAX_SOURCE_MEGAPIXELS,
    maxMemoryUsageInMB: MAX_SOURCE_MEMORY_MB,
  });

  const target = resizePlan(decoded.width, decoded.height);
  const pixels =
    target.width === decoded.width && target.height === decoded.height
      ? decoded.data
      : downscale(decoded.data, decoded, target);

  ensureByteContainer();
  const encoded = encode({ ...target, data: pixels }, Math.round(STORED_QUALITY * 100));

  return { ...target, bytes: new Uint8Array(encoded.data) };
}

/**
 * Box-average downscale over RGBA. Averaging the whole source box, rather than
 * sampling one pixel of it, is what keeps a 4× reduction from aliasing a
 * pinstripe or a knit into moiré — the artefact a garment photo shows first.
 */
function downscale(pixels: Uint8Array, source: ImageSize, target: ImageSize): Uint8Array {
  const out = new Uint8Array(target.width * target.height * 4);
  const xRatio = source.width / target.width;
  const yRatio = source.height / target.height;

  for (let y = 0; y < target.height; y += 1) {
    const top = Math.floor(y * yRatio);
    // At least one row even where the ratio rounds the box empty, so a target
    // pixel always averages something.
    const bottom = Math.max(top + 1, Math.floor((y + 1) * yRatio));

    for (let x = 0; x < target.width; x += 1) {
      const left = Math.floor(x * xRatio);
      const right = Math.max(left + 1, Math.floor((x + 1) * xRatio));

      let red = 0;
      let green = 0;
      let blue = 0;
      let counted = 0;

      for (let sourceY = top; sourceY < bottom; sourceY += 1) {
        for (let sourceX = left; sourceX < right; sourceX += 1) {
          const at = (sourceY * source.width + sourceX) * 4;
          red += pixels[at];
          green += pixels[at + 1];
          blue += pixels[at + 2];
          counted += 1;
        }
      }

      const to = (y * target.width + x) * 4;
      out[to] = red / counted;
      out[to + 1] = green / counted;
      out[to + 2] = blue / counted;
      // JPEG carries no alpha; the encoder still reads the channel, so it has to
      // be opaque rather than the zero the array arrives at.
      out[to + 3] = 255;
    }
  }

  return out;
}
