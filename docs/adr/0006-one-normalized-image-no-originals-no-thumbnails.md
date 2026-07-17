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
