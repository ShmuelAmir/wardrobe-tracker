# 6. One normalized image per item — no originals, no thumbnails

- Status: Accepted
- Date: 2026-07-17
- Owner: [#10 — Spec image storage](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10); §4.1 of `SPEC.md`

## Context

Items carry a photo, sourced from camera, library, or web import. A 12MP camera
original (~4MB) across a 200-item wardrobe is ~800MB on disk, feeding an app whose
largest render is a ~400pt detail image (~1200px @3x). The two obvious "quality"
instincts — keep the original, and cache thumbnails — both cost disk and add a
second file that can disagree with the first.

## Decision

**One normalized file per item. No originals, no thumbnails.**

- **Normalize at save:** 1600px longest edge, JPEG quality 0.8. Capped disk is
  ~60MB @ 200 items. **Never upscale** — an 800px product image is stored untouched.
- This is near a no-op on the primary path: web-import images are typically already
  1000–1600px and pass through unresized. It really just brings the camera path in
  line with what web-import already gives.
- **No thumbnails.** expo-image (SDWebImage on iOS) downsamples *at decode* with
  `allowDownscaling` defaulting to `true`, never materializing the full bitmap; its
  memory cache holds the decoded, downscaled result. A stored thumbnail buys almost
  nothing against a ~300KB/1600px file feeding a 120pt cell, while doubling the
  files to name, move, and delete.

## Consequences

- **Implementation constraint:** image grids must use `contentFit: 'cover'` —
  **not** `'none'` or `'fill'`, for which downscaling is disabled. Cross-cutting
  invariant.
- **Accepted cost:** the true original is gone. Re-cropping or background removal
  would only ever have 1600px to work with — both are out of scope, and that's
  better than carrying 800MB against a maybe.
- One file per item keeps the filesystem↔DB relationship one-to-one, which the
  naming (ADR-0007) and orphan handling (ADR-0008) both depend on.

## Amendment (2026-08-07) — same decision, new numbers and a different reason

The pipeline runs **client-side for file uploads** (`createImageBitmap` → canvas →
`toBlob`) and **server-side inside the import action** for web import (ADR-0019).
One file either way, so this ADR's decision holds unchanged.

**The target drops from 1600px to ~1200px, JPEG q0.8, ~150 KB — and the reason
moves.** The original sized for disk (~60 MB at 200 items). Disk is no longer the
constraint: every grid render is now **metered egress** against a 1 GB/month
free-tier ceiling, which is the binding limit rather than the 1 GB file store
(ADR-0018). Since no caching lever exists, image size is the only lever left.

**JPEG is now forced rather than chosen.** Safari cannot *encode* WebP or AVIF via
`canvas.toBlob`, even though it decodes both.

**Two problems solve themselves and must not be re-solved:**

- **EXIF orientation is handled by spec** — `createImageBitmap`'s
  `imageOrientation` defaults to `"from-image"`.
- **iOS canvas dimension caps are dodged by resizing *during* decode** rather than
  after.

**The no-thumbnails half keeps its conclusion but loses its argument.** The original
rested on expo-image / SDWebImage `allowDownscaling`, which is native-specific; the
browser's own decode path replaces it. Cross-cutting invariant #8 restates
accordingly: `contentFit: 'cover'` becomes **`object-fit: cover`**.

Never-upscale survives unchanged. Convex storage offers **no transforms, no CDN and
no cache headers**, so this pipeline is the only normalization there is.
