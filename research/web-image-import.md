# Research: Web image import from a brand product page in Expo

Ticket: [ShmuelAmir/wardrobe-tracker#3](https://github.com/ShmuelAmir/wardrobe-tracker/issues/3)
Context: In v1 the **primary** way to add a wardrobe item is importing the brand's high-quality product image from a brand's website. No background removal in v1. App is Expo / React Native / TypeScript, on-device iOS only.

Date: 2026-07-16. Sources are 2025–2026 primary docs where available; community sources flagged inline.

---

## 1. Direct image URL → download into app storage (expo-file-system)

**Feasibility: fully supported and the simplest path.** Given a direct image URL (e.g. `https://cdn.brand.com/.../shirt.jpg`), expo-file-system downloads the bytes straight to on-device storage.

**API (SDK 54+ / current SDK 57 modern class API):** use the static `File.downloadFileAsync`:

```typescript
import { File, Directory, Paths } from 'expo-file-system';

const dest = new Directory(Paths.document, 'wardrobe');
dest.create({ intermediates: true }); // no-op if it already exists
const file = await File.downloadFileAsync(imageUrl, dest, {
  headers: { /* e.g. Referer / User-Agent if a CDN requires them */ },
  onProgress: ({ bytesWritten, totalBytes }) => { /* progress UI */ },
  // signal: abortController.signal,
});
console.log(file.uri); // file:// path to persist in SQLite
```

Signature: `static downloadFileAsync(url: string, destination: File | Directory, options?: DownloadTaskOptions): Promise<File>`. When `destination` is a `Directory`, the filename is derived from response headers or the URL. Options include `headers`, `onProgress` (`{ bytesWritten, totalBytes }`), `signal` (`AbortSignal`), and `sessionType`. Source: [Expo FileSystem docs](https://docs.expo.dev/versions/latest/sdk/filesystem/).

**Storage location:** use `Paths.document` for images you want to keep (persisted, backed up); `Paths.cache` for scratch. Persist the returned `file.uri` in the expo-sqlite/Drizzle row. Source: [Expo FileSystem docs](https://docs.expo.dev/versions/latest/sdk/filesystem/).

**Formats:** the download is byte-for-byte and format-agnostic — whatever the server returns (JPEG, PNG, WebP, AVIF) lands on disk unchanged. The constraint is *display*: React Native's `<Image>` renders JPEG/PNG/GIF/WebP reliably; **AVIF and some WebP variants may not render** on older iOS. If a brand CDN serves AVIF/WebP you may need to (a) request a JPEG variant via URL params many CDNs support, or (b) transcode with `expo-image-manipulator`. Flag: this is a display concern, not a download concern.

**Legacy note:** the old `FileSystem.downloadAsync` API still exists under `expo-file-system/legacy` but is deprecated; use the class-based API above. Source: [Expo FileSystem docs](https://docs.expo.dev/versions/latest/sdk/filesystem/), [CHANGELOG](https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md).

**iOS ATS caveat:** iOS App Transport Security requires HTTPS by default. Brand CDNs are HTTPS, so this is a non-issue in practice. Source: [React Native Networking](https://reactnative.dev/docs/network).

---

## 2. Product-page URL → main product image (fetch HTML + parse og:image)

The realistic user flow is pasting a **product page** URL, not a direct image URL. Approach: `fetch(pageUrl)` → get HTML string → parse `og:image` (and fallbacks).

### CORS / same-origin behavior in React Native — the key finding

**RN's `fetch` does NOT enforce CORS.** The native networking layer has no browser same-origin policy:

> "The security model for XMLHttpRequest is different than on web as there is no concept of CORS in native apps."
> — [React Native Networking docs](https://reactnative.dev/docs/network)

This is decisive: unlike a web app (which would be blocked fetching cross-origin brand HTML without `Access-Control-Allow-Origin`), an RN app can fetch arbitrary brand pages directly, no proxy server required. **Note:** this only holds for RN's native `fetch`/`XMLHttpRequest`. If the HTML is loaded inside a `react-native-webview`, browser CORS *does* apply inside the WebView. Source: [react-native-webview#570](https://github.com/react-native-webview/react-native-webview/issues/570).

### Parsing

`og:image` is a **required** Open Graph property (`og:title`, `og:type`, `og:image`, `og:url`), so most e-commerce product pages expose it. Fallback chain: `og:image` → `twitter:image` → schema.org `Product.image` (JSON-LD) → first large `<img>`. Source: [ogp.me](https://ogp.me/). A lightweight regex/DOM scan over the meta tags is enough; community RN packages exist (`react-native-opengraph-kit`, `@sleiv/react-native-opengraph-parser`) but a small hand-rolled parser avoids a dependency. Sources: [react-native-opengraph-kit](https://github.com/Osedea/react-native-opengraph-kit), [npm @sleiv/react-native-opengraph-parser](https://www.npmjs.com/package/@sleiv/react-native-opengraph-parser).

### Reliability across typical brand e-commerce sites — the main risk

- **Server-rendered / SSR sites (most large retailers):** og:image is present in the initial HTML → static `fetch` + parse works well.
- **Client-rendered SPAs (React/Vue/Angular storefronts):** meta tags are sometimes injected *after* JS runs, so raw HTML from `fetch` may lack them. A plain HTTP request only sees pre-JS HTML. Mitigation: most modern e-commerce SSRs its meta for SEO/social sharing (they *want* correct link previews), so og:image is usually in the initial HTML anyway. Source: [Fastio metadata extraction](https://fast.io/resources/metadata-extraction-from-web-pages-open-graph/), [Vladimir Siedykh meta tags guide](https://vladimirsiedykh.com/blog/meta-tags-open-graph-complete-implementation-guide-nextjs-react-helmet).
- **Bot/anti-scraping defenses:** some sites (Cloudflare challenges, 403 on non-browser User-Agent) block bare `fetch`. Mitigation: send a browser-like `User-Agent` header. Cannot be fully guaranteed. **Flag: uncertainty — reliability is site-dependent and cannot be promised 100% across all brands.**

**Verdict:** works for the majority of brand sites, but a fraction will return no og:image or block the request. The UX must handle failure gracefully (fall back to manual image-URL paste or photo capture).

---

## 3. iOS Share Extension (share from Safari into the app)

**Feasible in Expo — via a config plugin + development build (EAS Build / prebuild); NOT possible in Expo Go.** A Share Extension is a separate native iOS target, so it requires custom native code that config plugins generate at prebuild time.

Two mature community plugins (no first-party Expo share-extension API exists — Expo's own `expo-sharing` is *outbound* share only):

- **`expo-share-intent`** (achorein) — receives shared **URL, text, images, video, files** on **both iOS and Android**, redirects straight into the main app (no custom extension UI). SDK 57 → v8.0+. Config-plugin based; also needs `expo-linking`. This is the better fit for "share a page/image into the app and let the app handle it." Source: [expo-share-intent README](https://github.com/achorein/expo-share-intent), [npm](https://www.npmjs.com/package/expo-share-intent).
- **`expo-share-extension`** (MaxAst, v5.0.6, SDK 54+) — iOS-only, renders a **custom React view inside the share sheet** (Pinterest-style mini UI). Activation rules: `url`, `text`, `image`, `video`, `file`. Shared data arrives as `InitialProps`. More capable but more setup (separate `index.share.js` entry, Metro `withShareExtension` wrapper, privacy manifest for images). Source: [expo-share-extension README](https://github.com/MaxAst/expo-share-extension).

**Effort estimate:** Moderate. Roughly: add the plugin, declare activation rules in `app.json`, move off Expo Go to a dev/EAS build, wire a handler that reads the shared URL/image and runs the section-1/section-2 import logic. For `expo-share-intent` the app just receives the payload (low-moderate); for `expo-share-extension` add custom-view plumbing (moderate). Both require the one-time switch to a development build — which this app will likely need anyway (expo-sqlite native module already pushes it past Expo Go for some workflows, though expo-sqlite itself is supported in dev builds).

**UX payoff:** highest-quality path — user taps Share on the brand page/image in Safari, picks the app, done. When Safari shares an *image* directly, you get the image; when it shares the *page URL*, you still run section-2 parsing.

---

## 4. Multiple candidate images / size & quality selection

- **Open Graph supports multiple images** via repeated `<meta property="og:image">` tags, each optionally followed by `og:image:width` / `og:image:height` (structured properties bind to the immediately preceding image). So when multiple are present you can pick the largest by declared dimensions. Source: [ogp.me](https://ogp.me/).
- **Practical selection heuristics when dimensions aren't declared:**
  1. Prefer `og:image` / `twitter:image` (curated "hero" product shot) over scraped `<img>` tags.
  2. Among `<img>` candidates, prefer those with the largest `srcset` descriptor or width/height attributes; brand CDNs often encode size in the URL (`?w=2000`, `_2000x`, `/large/`) — request the largest variant.
  3. De-dupe by base URL (same image at different sizes).
- **Let the user confirm.** Since a page can yield several plausible images (front/back/model/detail), present the candidates in a small picker and let the user tap the right one rather than auto-guessing. This also gracefully covers the case where og:image is a logo/placeholder rather than the product.
- After selection, optionally normalize with `expo-image-manipulator` (resize/re-encode to JPEG) for consistent storage — but per ticket, no background removal in v1.

---

## 5. Recommendation for v1

Support **two complementary mechanisms**, in this priority order:

1. **Paste-a-URL importer (build first — core of v1).** A single input that accepts either a direct image URL *or* a product-page URL:
   - If it looks like/returns an image content-type → download directly (section 1).
   - Else `fetch` the HTML and parse og:image → twitter:image → JSON-LD → largest `<img>` (section 2), show candidate(s) in a confirm/picker (section 4), then download the chosen one (section 1).
   - This is entirely doable with only `expo-file-system` + native `fetch`, **no backend/proxy** (RN has no CORS), and no extra native modules — so it works in Expo Go during development. This is the lowest-risk, highest-coverage baseline and directly serves the "import brand product image" primary flow.

2. **iOS Share Extension via `expo-share-intent` (fast-follow, once on a dev/EAS build).** This is the nicest UX — share a product page or image straight from Safari — and reuses the exact same parse+download pipeline from mechanism 1. Defer only because it forces the move to a development build and adds moderate setup; it is not a throwaway, it wraps the same core logic.

**Why not rely on a headless-browser/scraping service:** adds a backend, breaks the on-device/no-cloud product principle, and most brand SSR pages expose og:image in raw HTML anyway.

**Key risks to design around:** (a) a minority of SPA/anti-bot brand sites won't yield og:image via bare `fetch` — always provide manual fallback (paste direct image URL, or camera/photo-library which the app already supports); (b) WebP/AVIF display compatibility — transcode to JPEG if `<Image>` fails to render.

---

## Uncertainty / conflicting sources

- **Parse reliability is genuinely site-dependent** — no source guarantees og:image extraction across *all* e-commerce sites; SPA rendering and anti-bot defenses are real failure modes. Treat manual fallback as mandatory, not optional.
- **`File.downloadFileAsync` option names** (`onProgress` shape, `sessionType`) are drawn from the current SDK 57 docs summary; confirm exact field names against the installed SDK version before coding, as the modern FileSystem API has changed across SDK 54→57. Source: [Expo FileSystem docs](https://docs.expo.dev/versions/latest/sdk/filesystem/).
- **Share-extension plugins are community-maintained**, not first-party Expo. `expo-share-intent` (cross-platform, redirect-to-app) vs `expo-share-extension` (iOS-only, custom in-sheet UI) is a real design choice; `expo-share-intent` is recommended for this app's simpler "hand the payload to the app" need.

## Primary sources

- [Expo FileSystem (SDK 57) docs](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Expo FileSystem legacy docs](https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/)
- [expo-file-system CHANGELOG](https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md)
- [React Native Networking docs (CORS statement)](https://reactnative.dev/docs/network)
- [react-native-webview#570 (CORS inside WebView)](https://github.com/react-native-webview/react-native-webview/issues/570)
- [Open Graph protocol spec (ogp.me)](https://ogp.me/)
- [expo-share-intent (achorein)](https://github.com/achorein/expo-share-intent) · [npm](https://www.npmjs.com/package/expo-share-intent)
- [expo-share-extension (MaxAst)](https://github.com/MaxAst/expo-share-extension)
- [Expo Sharing (outbound) docs](https://docs.expo.dev/versions/latest/sdk/sharing/)
- Community (parsing reliability): [Fastio metadata extraction](https://fast.io/resources/metadata-extraction-from-web-pages-open-graph/), [react-native-opengraph-kit](https://github.com/Osedea/react-native-opengraph-kit)
