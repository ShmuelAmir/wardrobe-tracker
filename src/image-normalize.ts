/**
 * §4.1/§4.2 — the *policy* half of the image pipeline, shared by both places it
 * runs: the browser, where a file upload is decoded through `createImageBitmap`,
 * and the Convex action, where a web import's bytes arrive server-side and never
 * touch a browser. One normalized file per item either way (ADR-0006), so the
 * cap, the format and the quality have to be one set of numbers rather than two
 * that agree today.
 *
 * Only the decision lives here. The two decoders are as different as the
 * runtimes they sit in, and neither belongs in a module the other imports.
 */

/** The long edge, in pixels. A source already inside it is left alone. */
export const MAX_EDGE = 1200;

/**
 * **JPEG is forced, not chosen.** Safari decodes WebP and AVIF but cannot
 * *encode* either through `canvas.toBlob`, so offering a format choice would
 * produce a silent `image/png` fallback — several times the bytes — on the one
 * browser this app is aimed at.
 */
export const STORED_TYPE = 'image/jpeg';

/** 0–1 for `canvas.toBlob`; the server encoder takes the same number ×100. */
export const STORED_QUALITY = 0.8;

export type ImageSize = { width: number; height: number };

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
