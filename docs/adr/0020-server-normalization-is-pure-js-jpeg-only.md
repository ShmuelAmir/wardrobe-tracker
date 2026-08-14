# 20. Server-side normalization is pure JavaScript, and therefore JPEG-only

- Status: Accepted
- Date: 2026-08-14
- Extends: [ADR-0019](./0019-web-import-convex-action.md), [ADR-0006](./0006-one-normalized-image-no-originals-no-thumbnails.md)
- Owner: [#114 — Add an item by pasting a product link](https://github.com/ShmuelAmir/wardrobe-tracker/issues/114); §4.2 and §5.3 of `SPEC.md`

## Context

ADR-0019 put the web-import fetch in a Convex action and §4.2 put that path's
**normalization** in the same place: the bytes arrive server-side from a brand
CDN, and CORS means the browser can never hold them, so there is no client leg to
push the resize onto.

It did not say what does the resizing. Convex's default runtime has no
`createImageBitmap`, no canvas and no `sharp` — the three things the upload path
and every server-side image pipeline are normally built out of. The obvious
answer is a `"use node"` action with `sharp`, and that answer costs the thing
ADR-0019 was pleased about: the default runtime, no cold starts, and a function
surface with no native binary in it.

## Decision

**The action normalizes in pure JavaScript, in the default runtime.** `jpeg-js`
decodes, a box-average downscale caps the long edge, and `jpeg-js` re-encodes at
the same quality the browser's `canvas.toBlob` uses. The cap, format and quality
are **one shared set of numbers** (`src/image-normalize.ts`), imported by both
pipelines, so ADR-0006's one-file-per-item cannot drift into two different files.

**The consequence is accepted rather than worked around: the server path decodes
JPEG and nothing else.** A PNG, WebP or AVIF product image raises, and the action
answers with §5.5's dead end — Review, holding the source URL and any parsed
name and brand, with a drop zone in the image slot.

## Consequences

- **The dead end absorbs the format gap, and it is a fallback that already had
  to exist.** ADR-0019 established that roughly one site in eleven dead-ends on
  bot-blocking anyway, and §5.5 established that landing there loses nothing the
  user typed. A non-JPEG image is one more way into a path that is already
  built, tested and reachable — not a new failure mode.
- **`sharp` was not merely deferred, it was priced.** It would decode every
  format and auto-rotate EXIF, and it would cost a `"use node"` runtime, its cold
  start, a native binary in the deployed function set, and a `convex.json`
  external-packages entry — for a gap the dead end already covers on a path that
  is not the common one.
- **EXIF orientation is not handled server-side, and does not need to be.**
  `createImageBitmap`'s `"from-image"` default handles it on the upload path,
  which is where the photos that carry an orientation tag come from. Retail CDN
  images are server-processed and carry none.
- **One live trap.** `jpeg-js`'s encoder ends in `Buffer.from(byteout)` whenever
  it is loaded as CommonJS, and the default runtime defines no `Buffer` — so
  `convex/normalizeImage.ts` installs a minimal stand-in before encoding.
  `convex/normalizeImage.test.ts` pins it by stubbing `Buffer` away, because the
  test runtime *does* have one and would otherwise never exercise the path that
  matters.
- **Memory is guarded at decode, not at the door.** The default runtime has 64
  MiB and a decoded frame is 4 bytes a pixel, so the megapixel and byte ceilings
  have to bite before the frame is allocated.
