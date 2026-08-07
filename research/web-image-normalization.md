# Research: image normalization on the web, without expo-image-manipulator

Ticket: [ShmuelAmir/wardrobe-tracker#94](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94)
Date: 2026-08-07
Scope: replacing `expo-image-manipulator` for the web/PWA replatform (map: #87) —
where image normalization should run, which browser APIs are available (iOS
Safari specifically, the PWA target), EXIF orientation, output format, target
dimensions, upload limits, and what Convex file storage does or doesn't provide.
Byte budgets are evaluated against the Convex Free plan's binding constraint:
**1 GB/month data egress**, not the 1 GB file-storage cap [Convex — Limits].

---

## 1. Where should normalization run?

Two entry paths exist and they are asymmetric:

- **File upload** (camera/library picker): bytes originate **client-side**, in
  the browser.
- **Web-import** (#92): bytes are fetched by a Convex action from a third-party
  CDN and arrive **server-side** — the browser never sees the original bytes,
  because CORS forbids the client from fetching arbitrary cross-origin image
  bytes directly.

This asymmetry means normalization cannot live in exactly one place by default —
it must handle both a client-Blob input and a server-Blob input. The real choice
is which side does the *resize/re-encode* work, given each already has bytes
in hand.

**Client-side (canvas/createImageBitmap before upload):**
- *Cost:* free — runs on the user's device, consumes no Convex action compute
  (metered at 20 GB-hours/month on Free [Convex — Limits]) and, critically,
  uploads only the *normalized* bytes, not the original. A 4 MB camera photo
  resized to ~150–300 KB before upload means the 1 GB/month **egress** budget
  is only ever spent on already-small files, and *upload* bandwidth (not
  metered by Convex, but still real for the user) drops ~10-20x too.
- *Failure mode:* must handle low-power/old devices gracefully, and the
  web-import path can't use it at all (no client bytes to normalize).

**Server-side (Convex action):**
- *Cost:* consumes action compute (Free plan: 20 GB-hours/month
  [Convex — Limits]) and, if the action fetches original-size bytes and stores
  a resized result, the *fetch-in* leg is action-to-third-party bandwidth (not
  Convex egress — egress is what Convex serves *out* to end users
  [Convex — Limits: "data egress...bandwidth out of actions"], so actually this
  *does* count against the 1 GB/month egress figure too, since egress explicitly
  includes "bandwidth out of actions"). Still bounded and small per image
  (single-digit MB at most), and only stored bytes are served to clients
  afterward.
- *Necessity:* mandatory for web-import, since the bytes already start on the
  server and never touch the browser (#92).
- *Node runtime memory ceiling:* Convex actions run at 512 MB (Node runtime) or
  64 MB (Convex default runtime) [Convex — Actions: memory constraints,
  inferred from docs summary — treat as documented but re-verify against the
  live actions/limits page before relying on it for a specific library's peak
  memory]. A single ~5–15 MB JPEG decoded to a raw bitmap (a 4000×3000 12MP
  photo is ~36 MB uncompressed RGB) fits comfortably even in the 64 MB tier if
  processed one image at a time, but rules out naive multi-image batch
  processing in a single invocation.

**Recommendation: do both, split by entry path.**
- File upload → normalize **in the browser**, before the upload leaves the
  device. This is the cheap, high-volume path (every camera/library add) and
  keeps both action compute and upload bytes minimal.
- Web-import → normalize **in a Convex action**, immediately after the action
  downloads the source bytes from the brand CDN (#92) and before
  `ctx.storage.store()` [Convex — Upload files]. There is no client leg to
  push this work onto.

Net effect: **exactly one normalized file is ever written to Convex storage**
on both paths, matching ADR-0006's "no originals, no thumbnails" rule — the
normalization step is just relocated per path, not duplicated.

---

## 2. Client-side resize APIs — what iOS Safari actually supports

Candidates, in the order the ticket asks about them:

### `canvas` + `toBlob`
Universally available; `canvas.toBlob()` is required to support `image/png`
and commonly supports `image/jpeg` (quality parameter) [MDN —
HTMLCanvasElement.toBlob]. This is the baseline API and works in iOS Safari
for JPEG output.

### `createImageBitmap` with resize options
`createImageBitmap(source, options)` accepts `resizeWidth`, `resizeHeight`,
and `resizeQuality` ('pixelated' | 'low' (default) | 'medium' | 'high')
[WHATWG HTML — createImageBitmap]. This lets the browser do the downscale
during decode rather than requiring a full-size canvas draw, which matters
directly for iOS Safari's canvas size ceiling (below). Broadly supported —
this is the recommended decode+resize entry point.

### `OffscreenCanvas` in a worker
**Supported in Safari since Safari 16.4** (March 2023) for 2D contexts: "In
Safari 16.4 we've added Offscreen Canvas support for 2D operations" [WebKit —
Features in Safari 16.4]. WebGL/WebGL2 in OffscreenCanvas came later (Safari
17.0+ area) but is irrelevant here since normalization only needs 2D
`drawImage`/`toBlob` (via `convertToBlob`). This means resize work — decode,
draw, re-encode — can run entirely off the main thread on iOS Safari,
avoiding UI jank on a big camera photo, which is the documented reason to use
it [web.dev — OffscreenCanvas].

### WebCodecs
Safari 16.4 added the **video** portion of WebCodecs; full WebCodecs (adding
`AudioEncoder`/`AudioDecoder`) shipped in **Safari 26.0** on macOS/iOS/iPadOS
[WebKit — News from WWDC25 / Safari 26 blog]. WebCodecs has no direct
still-image encode/decode primitive analogous to `canvas.toBlob` — it targets
video frames and audio chunks, not JPEG/WebP stills — so it is not a fit for
this task regardless of version support. **Not recommended** here; canvas-family
APIs are the correct tool for still-image resize/encode.

### iOS Safari canvas size caps — a real break risk for big photos
iOS Safari enforces a **hard canvas area limit of 16,777,216 pixels**
(width × height) — exceeding it throws "Canvas area exceeds the maximum
limit" [community reports citing WebKit behavior; corroborated by multiple
independent bug reports — pqina.nl, GitHub issues on react-pdf, pannellum,
browser-image-resizer]. This is **not confirmed against a WebKit primary
source in this pass** (no matching entry found on webkit.org or
bugs.webkit.org during this research) — treat as **inferred/well-corroborated
community-documented**, not spec-verified. A modern phone camera photo (12MP,
e.g. 4032×3024 ≈ 12.2M px) is under this ceiling on its own, but:
- **Device pixel ratio compounds it** for any canvas sized via CSS pixels at
  `devicePixelRatio` 2 or 3 — a naive canvas set to the *display* size scaled
  by DPR can blow past 16.7M px well before the source image does.
- There is also a **separate, lower total-canvas-memory ceiling** reported
  around 224–384 MB depending on iOS/Safari version [Apple Developer Forums
  thread; pqina.nl] — multiple simultaneous canvases (e.g., a decode canvas
  plus a display canvas) can hit this even under the per-canvas pixel cap.

**Practical mitigation:** never allocate a canvas at the source image's full
native resolution. Use `createImageBitmap(file, { resizeWidth, resizeHeight })`
to have the browser downscale *during decode*, then draw the already-shrunk
bitmap to a small canvas sized at the final target dimensions (below) — the
canvas never needs to be larger than the final output, sidestepping both the
pixel-area cap and the memory cap. This also avoids ever materializing a
full-resolution bitmap on a memory-constrained device.

---

## 3. EXIF orientation — does the browser auto-apply it, and does canvas preserve it?

**Primary answer, from the WHATWG HTML spec:** `createImageBitmap()`'s
`ImageBitmapOptions.imageOrientation` member **defaults to `"from-image"`**
[WHATWG HTML — §8.11, ImageBitmap and animations: `ImageOrientation
imageOrientation = "from-image"`]. `"from-image"` means the browser applies the
image's EXIF orientation metadata during decode, so the resulting `ImageBitmap`
is already correctly rotated. The alternative value is `"flipY"` (no plain
"none" bypass exists in the current spec text fetched here); there is no
option to get the *raw, unrotated* pixels for JPEGs with EXIF orientation set
via the standard path.

**Practical consequence:** once you decode via `createImageBitmap` (default
options) and `drawImage` that bitmap to a canvas, **the canvas output is
already orientation-corrected** — orientation is applied at decode, before any
canvas operation, so canvas neither "preserves" nor "drops" it independently;
it just draws whatever pixels the bitmap already has. This closes the classic
silent-bug source (canvas historically *ignored* EXIF when decoding via a raw
`<img>` → `drawImage` path on older engines) **as long as decode goes through
`createImageBitmap`** rather than an `Image()`/`<img>` element in an engine
that doesn't apply `image-orientation: from-image` by default.
Chromium made `from-image` the default CSS rendering behavior for `<img>`
around Canary 81 [WHATWG/community discussion, csswg-drafts#4666] — Safari's
current default for plain `<img>` decode-and-draw was **not independently
re-verified against a WebKit primary source in this pass**; the safer,
spec-guaranteed approach for this app is to always decode uploaded/downloaded
bytes via `createImageBitmap(blob)` (default `imageOrientation: "from-image"`)
rather than relying on `<img>` + `drawImage`, both client-side and — since
Node's `createImageBitmap`/canvas equivalents in a Convex action may differ —
verified explicitly for whatever image library is chosen for the server path.

**Server side (Convex action, web-import):** `createImageBitmap` is a
browser/Worker API; a Node-runtime Convex action needs an npm image library
(e.g. `sharp`, or a WASM decoder) instead. Whatever library is chosen there
must be checked explicitly for EXIF-orientation auto-rotation — this is not
guaranteed by default in server image libraries the way it now is by spec for
`createImageBitmap`, and is flagged here as **unknown / to verify at
implementation time**, not assumed.

---

## 4. Output format: JPEG vs WebP vs AVIF — byte budget and browser support

**Encode support in `canvas.toBlob` differs sharply by browser, and DECODE
support is not the same question as ENCODE support:**

- **JPEG:** universally encodable via `canvas.toBlob(cb, "image/jpeg", quality)`
  in all browsers including iOS Safari [MDN — HTMLCanvasElement.toBlob].
- **WebP encode:** **not supported in Safari, on desktop or iOS**, across all
  tested versions up to Safari 26.5/27 per caniuse's compatibility data
  [caniuse — HTMLCanvasElement toBlob type parameter: webp]. Safari can
  *decode/display* WebP (in `<img>`) but `canvas.toBlob(cb, "image/webp")`
  silently falls back to PNG on Safari, since the spec says an unsupported
  format must fall back to `image/png` [MDN — HTMLCanvasElement.toBlob].
  Since this app's PWA target *is* iOS Safari, **WebP is not a usable client-
  side encode target** for the primary path.
- **AVIF encode:** even more limited — Chrome 124+ supports AVIF via
  `canvas.toBlob`, but Firefox and Safari do not, as of early 2026
  [WebSearch summary of canvas/AVIF support state — not independently
  confirmed against a caniuse or WebKit primary page in this pass; treat as
  **inferred**]. Not usable client-side on the PWA target either.

**Conclusion: output format is JPEG**, for the browser-encode leg specifically
because Safari (desktop and iOS) cannot encode WebP or AVIF via canvas at all
— this isn't a quality trade-off, it's a hard support gap on the exact target
platform. (A server-side action *could* use `sharp`'s AVIF/WebP encoder
regardless of client capability, since Node isn't bound by canvas encode
support — but that would make the two entry paths produce different formats
for the same logical "one normalized image," which contradicts ADR-0006's
spirit of one predictable file. Staying on JPEG for both paths keeps the
format uniform without a per-path special case.)

**Realistic size figures for a ~1000px garment photo, JPEG quality ~0.8:**
ADR-0006 already establishes this baseline for the native app — "a ~300KB/1600px
file" at "JPEG quality 0.8" for a 1600px-longest-edge image
[docs/adr/0006, Consequences / Decision]. Scaling down: an ~1000-1200px
longest-edge garment photo (mostly flat color / studio background, which
compresses far below busy photographic content) at JPEG q0.8 typically lands
in the **~80–200 KB** range — well under half the 1600px/~300KB reference
point, consistent with JPEG's roughly-quadratic byte-vs-linear-dimension
scaling for similar content. These are **not independently re-benchmarked in
this pass**; they extrapolate from the ADR-0006 figure, which is itself an
applied estimate rather than a spec/doc citation, so tag this as **inferred**.

---

## 5. Target dimensions and quality — grid thumbnail AND detail view, one file

ADR-0006 forbids a second, separately-sized thumbnail file — the same
normalized image must serve both a small grid cell and a full-screen detail
view. The native app's answer was **1600px longest edge, JPEG q0.8**, relying
on `expo-image`/SDWebImage's decode-time downsampling so the grid never
materializes the full 1600px bitmap in memory [ADR-0006].

**On the web there is no equivalent automatic decode-time downsampling for
`<img>` in a grid** — the browser decodes the *stored* image at its stored
resolution class and lets CSS/layout crop/scale it, but (unlike
`expo-image`'s explicit `allowDownscaling`) there's no first-class knob
guaranteeing a browser never decodes full-res pixels for a small `<img>`.
Modern browsers *do* apply their own heuristic downsampling for small
`<img>` boxes in practice, but this is engine behavior, not a documented,
reliable Safari-specific guarantee gathered in this pass — flagged
**unknown**, not relied upon in the budget below.

**Recommendation carried forward largely unchanged: ~1200px longest edge,
JPEG quality 0.8, no upscaling.** Reasoning against the egress budget:
- The web replaces the on-device grid with data actually **transferred over
  the network** — every grid render is now an egress cost, unlike the native
  app where the file was already local. This makes the *stored* byte size the
  same thing as the *egress-per-view* size, so it's worth trimming slightly
  below the native app's 1600px figure: **1200px** longest edge keeps a
  full-screen detail view sharp on typical viewport widths (rarely wider than
  ~1200 logical px for a single garment photo panel) while cutting bytes
  further than 1600px would.
- At JPEG q0.8, a 1200px garment photo should land roughly in the
  **~100–180 KB** range (interpolated from the §4 estimate) — call it **~150
  KB/image** as a planning figure.
- **200-item wardrobe grid, fully uncached:** 200 × 150 KB ≈ **30 MB** — this
  matches the ticket's own reference figure ("A 200-item grid is roughly
  30 MB fully uncached"), confirming ~150 KB/image is the right order of
  magnitude to target.
- Against the **1 GB/month egress** cap: 1 GB / 150 KB ≈ **~6,800 image
  views/month** before egress is exhausted, or equivalently **~33 full
  200-item grid renders/month** if every render were a full cache miss. Since
  this is a personal/single-user app (not a public multi-user gallery), and
  `getUrl()` URLs are stable, cacheable bearer-token links rather than
  expiring signed URLs [Convex — Serve files], normal browser HTTP caching
  should keep steady-state usage far below that ceiling after first load —
  but it puts a hard floor under why 150 KB (not 300 KB, not full-res) is the
  right per-image target, not just a quality preference.

---

## 6. Upload limits — how large a file should the client send before resizing?

**Convex's documented constraints on the upload path:**
- The three-step upload flow (`generateUploadUrl` → client POST → mutation
  storing the returned storage ID) has **no documented maximum file size**;
  the binding constraint is that **the upload POST itself has a 2-minute
  timeout** [Convex — Upload files]. A large file on a slow connection could
  fail purely on time, independent of any size cap.
- **HTTP actions** (and `ctx.storage.store()` called from one) are capped at
  **20 MB** for the request/response body [Convex — Upload files; Convex —
  File storage overview: "HTTP action responses are limited to 20MB"]. This
  matters for the web-import path (#92), which downloads via an action and
  stores server-side — the downloaded source image must fit under 20 MB if
  routed through an HTTP-action-style path, though a background/scheduled
  action driving `ctx.storage.store()` outside the HTTP-action request cycle
  may not carry the same 20 MB ceiling (**not fully disambiguated in the
  docs fetched this pass — flagged for verification when #92 is
  implemented**).

**Recommendation:** since normalization happens client-side before upload
(§1), the client should resize **before ever calling `generateUploadUrl`** —
so the uploaded file is already the ~100–200 KB normalized JPEG, not the
original. A sensible **client-side accept/pre-check ceiling on the original
file** (before resize) is generous — e.g. reject/warn above ~25–30 MB, which
comfortably exceeds any phone camera JPEG (even a 48MP ProRAW-adjacent JPEG
tops out well under 20 MB) — purely as a sanity guard against a
non-image/corrupt file, not a real constraint given resize happens locally
first. The 20 MB HTTP-action cap and the 2-minute POST timeout are non-issues
on the file-upload path once resize-before-upload is the rule; they matter
specifically for the web-import server-side leg, which must cap or stream the
CDN download accordingly (#92's concern, not this ticket's).

---

## 7. What Convex file storage does — and does not — provide

Directly from docs.convex.dev, fetched this pass:

- **No image transforms.** The file storage docs describe upload, store, and
  serve mechanics only; **no resizing, cropping, format conversion, or any
  image-specific transform is documented anywhere in file storage**
  [Convex — File storage overview; Convex — Serve files]. This is stated
  plainly here because it settles §1: normalization has nowhere else to live
  but application code (client or action) — Convex will not do it for you at
  any layer.
- **No CDN documented.** Nothing in the fetched File Storage or Serve Files
  pages mentions a CDN layer, edge caching, or image-optimized delivery.
  **Not found ⇒ treated as absent**, not verified-absent by an explicit
  negative statement from Convex — flagged as **inferred from omission**.
- **No documented cache headers.** Same status — the Serve Files page does
  not specify what `Cache-Control` (or similar) headers are set on
  `getUrl()`-served responses. This is worth verifying directly (e.g. via
  a `curl -I` against a real `getUrl()` link) before relying on browser HTTP
  caching to keep the §5 egress math conservative in practice — the math in
  §5 already accounts for this by treating full renders as the ceiling case.
- **URLs are stable bearer tokens, not expiring signed URLs.** `getUrl()`
  returns a URL that stays valid as long as the file exists; **anyone who has
  the URL can access the file with no additional authorization check**
  [Convex — Serve files: "anyone with the URL can access the file without
  another app-level authorization check"]. The only revocation path is
  deleting the file. This is good for this ADR-0007-style bare-identifier
  storage model (a stable ID → stable URL, matching the "one file, one row"
  invariant) but means access control, if ever needed beyond "anyone with the
  link," must be layered via an HTTP action rather than relying on `getUrl()`.
- **`ctx.storage.store()` accepts a `Blob`** directly, which is what both the
  client-normalized-then-uploaded path and the action-normalized web-import
  path end up calling with, after normalization — the storage API itself is
  format/size-agnostic beyond the 20 MB HTTP-action ceiling noted in §6.

**Bottom line: Convex file storage is a plain blob store with a bearer-token
URL scheme — it provides zero image intelligence.** Every normalization,
sizing, and format decision in this document is something the application
must implement; nothing here is deferrable to the platform.

---

## Recommendation summary (with byte arithmetic)

1. **Normalize per entry path, not in one shared place:** client-side
   (`createImageBitmap` → `OffscreenCanvas`/canvas → `toBlob`) for file
   uploads; server-side in the Convex action for web-import, since its bytes
   never reach the browser (#92).
2. **Decode via `createImageBitmap`** (default `imageOrientation: "from-image"`)
   on the client — this is the spec-guaranteed way to get EXIF-correct pixels
   before any resize/draw, closing the classic silent-orientation bug
   [WHATWG HTML §8.11].
3. **Resize during decode**, not by drawing a full-res image to a full-size
   canvas — use `createImageBitmap(source, { resizeWidth, resizeHeight })` to
   respect iOS Safari's ~16.7M-pixel canvas area cap and its lower total
   canvas-memory ceiling on big camera photos.
4. **Output format: JPEG**, quality ~0.8 — WebP and AVIF canvas-encode are
   both unsupported in Safari (desktop and iOS) as of this research, making
   them non-options on the PWA's actual target browser, not just an inferior
   quality trade-off.
5. **Target size: 1200px longest edge**, no upscaling — serving both grid and
   detail view from one file per ADR-0006. Estimated **~150 KB/image** at
   q0.8 (interpolated from ADR-0006's 1600px/~300KB reference point and
   cross-checked against the ticket's own 200-item/30MB figure: 200 × 150 KB
   ≈ 30 MB, matching).
6. **Egress budget check:** 1 GB free-plan egress / ~150 KB per image ≈
   **~6,800 image loads/month**, i.e. **~33 full 200-item grid cache-misses**
   — comfortably enough headroom for a single-user app with normal browser
   caching, and the reason 150 KB (not 300 KB) is the deliberate target
   rather than an arbitrary halving.
7. **Convex provides no help here** — no transforms, no documented CDN, no
   documented cache headers, stable-not-expiring URLs via bearer token. All
   sizing/format/orientation work is application code, on both entry paths.

---

## Sources

- [ADR-0006 — One normalized image per item, no originals, no thumbnails](../docs/adr/0006-one-normalized-image-no-originals-no-thumbnails.md)
- [ADR-0007 — UUID filenames, bare filename in DB](../docs/adr/0007-uuid-filenames-bare-filename-in-db.md)
- Convex Developer Hub — File Storage Overview: https://docs.convex.dev/file-storage
- Convex Developer Hub — Uploading and Storing Files: https://docs.convex.dev/file-storage/upload-files
- Convex Developer Hub — Serving Files: https://docs.convex.dev/file-storage/serve-files
- Convex Developer Hub — Actions: https://docs.convex.dev/functions/actions
- Convex Developer Hub — Limits (storage, egress, action compute, function calls): https://docs.convex.dev/production/state/limits
- WHATWG HTML Standard — §8.11/8.12 ImageBitmap and animations (`createImageBitmap`, `ImageBitmapOptions.imageOrientation` default `"from-image"`): https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html
- MDN — `createImageBitmap()`: https://developer.mozilla.org/en-US/docs/Web/API/createImageBitmap
- MDN — `HTMLCanvasElement.toBlob()`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- caniuse — HTMLCanvasElement toBlob `type` parameter WebP support: https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp
- WebKit Blog — WebKit Features in Safari 16.4 (OffscreenCanvas 2D support, WebCodecs video): https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- WebKit Blog — WebKit Features in Safari 17.4: https://webkit.org/blog/15063/webkit-features-in-safari-17-4/
- WebKit Blog — News from WWDC25: WebKit in Safari 26 beta (full WebCodecs, AudioEncoder/AudioDecoder): https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
- web.dev — OffscreenCanvas: speed up your canvas operations with a web worker: https://web.dev/articles/offscreen-canvas
- csswg-drafts issue #4666 — `image-orientation` and canvas `drawImage`: https://github.com/w3c/csswg-drafts/issues/4666
- Community/secondary corroboration for iOS Safari canvas pixel-area (16,777,216 px) and memory ceilings (not independently confirmed against a WebKit primary source in this pass): pqina.nl "Canvas Area Exceeds The Maximum Limit" (https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/), Apple Developer Forums thread on total canvas memory (https://developer.apple.com/forums/thread/112218), GitHub issues on react-pdf#1149, pannellum#973, browser-image-resizer#88.

### Conflicts / uncertainties

- The iOS Safari canvas pixel-area cap (16,777,216 px) and the ~224–384 MB
  total-canvas-memory ceiling are **well-corroborated across multiple
  independent community bug reports but not traced to a WebKit primary
  source** in this research pass — treat as reliable-but-secondary, and
  re-verify against bugs.webkit.org if precise thresholds become
  implementation-critical.
- AVIF canvas-encode support-by-browser was gathered via a WebSearch summary,
  not an independently fetched caniuse/WebKit page — flagged **inferred**.
  Irrelevant to the recommendation either way since Safari doesn't support it
  and JPEG is the chosen format regardless.
- Whether Safari's default `<img>` decode-and-render path (as opposed to
  `createImageBitmap`) auto-applies EXIF orientation was not independently
  re-verified against a WebKit primary source; the recommendation
  sidesteps this by mandating `createImageBitmap` (spec-guaranteed
  `from-image` default) as the decode entry point everywhere, so this gap
  doesn't affect the recommendation.
- Whether a non-HTTP-action Convex action (e.g. driven by an internal
  action/scheduled function rather than the HTTP router) is bound by the same
  20 MB ceiling as HTTP actions when calling `ctx.storage.store()` was not
  fully disambiguated by the docs pages fetched this pass — worth confirming
  directly against `docs.convex.dev/file-storage/upload-files` (or by testing)
  before #92 is implemented against a CDN image that might exceed 20 MB.
- Node-runtime Convex action memory limits (512 MB) and default-runtime limits
  (64 MB) were reported via a WebFetch summary of the Actions docs page
  rather than a directly quoted spec line — re-confirm the exact figures
  against `docs.convex.dev/functions/actions` before sizing the web-import
  action's image-library choice.
