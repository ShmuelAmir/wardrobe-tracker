/**
 * §5.3 — the web-import parse. RN's `fetch` enforces no CORS (native apps have
 * none), so brand pages are fetched directly — **no proxy, no backend**.
 *
 * The candidate list is built in three passes (#41):
 *
 *   1. **Priority extraction** — `og:image` → `twitter:image` → JSON-LD →
 *      largest `<img>`. This still orders the generic/fallback case.
 *   2. **Harvest** — real retail galleries hide in a JSON blob (often with
 *      `/`-escaped slashes) or a `srcset`, not in `<meta>`/`<img src>`, so
 *      #23's parser saw only the 1–2 hero copies and the confirm step showed the
 *      hero **twice**. We additionally scan the (un-escaped) HTML for image URLs.
 *   3. **Filter → scope → collapse → order** — drop junk (favicons, logos,
 *      sprites); on a recognised platform keep only the colour the URL names and
 *      float the clean-background packshot to `[0]`; collapse size/format
 *      variants of one photo to a single candidate; and dedupe by that identity.
 *
 * The first candidate is what step 3 auto-picks; the rest fill the thumbnail row.
 * Reliability is site-dependent (SPAs and anti-bot 403s can fail), which is
 * exactly why step 3's manual fallback is mandatory — the failure states are
 * their own ticket; this module is the happy path.
 *
 * Parsing is deliberately regex-based: RN ships no DOM parser, and meta/JSON-LD
 * extraction from server-rendered retail HTML doesn't need one. It is also kept
 * free of native imports so the whole parse is a pure function pinned by tests
 * (including three real retail pages under `__tests__/fixtures/`), with only
 * `fetchProductPage` reaching for the (mockable) global `fetch` and the
 * connectivity pre-flight.
 */
import * as Network from 'expo-network';

export type WebImportResult = {
  /** Image URLs, best-first and deduplicated; `[0]` is step 3's auto-pick. */
  candidates: string[];
  /** The resolved URL (`Response.url`), or the pasted string if no fetch ran. */
  sourceUrl: string;
  /** Cleaned product name, or null when nothing survives the cleanup. */
  name: string | null;
  /** The site name, used as Brand; null when absent. */
  brand: string | null;
};

/**
 * §5.3 — validation is `http(s)` **syntax only**, just enough to enable Fetch.
 * We never try to detect "is this a product page": a homepage and a product URL
 * differ by nothing a regex should judge, and any rule sharp enough to reject a
 * homepage eventually rejects a real product page. Step 3's confirmation is the
 * real guard.
 */
export function isFetchableUrl(input: string): boolean {
  try {
    const { protocol } = new URL(input.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A browser-like User-Agent nudges anti-bot pages toward serving us real HTML,
 * and the image download (§5.4) must send the **same** UA so a CDN that gates on
 * it hands back the bytes too — hence one shared constant rather than a copy per
 * caller. The dead-end handling for the 403s that still get through is a later
 * ticket (§5.3).
 */
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
};

/** §5.3 — the retryable copy shown when we couldn't even reach a page. */
export const OFFLINE_MESSAGE = "You're offline. Reconnect and try again.";
export const UNREACHABLE_MESSAGE = "Couldn't reach that page. Check your connection.";
/** §5.3 — the dead-end copy: a page answered, but held no image we could use. */
export const NO_IMAGE_MESSAGE = "Couldn't get an image from that page.";

/** §5.3 — long enough for a slow retail page on cellular, short enough not to hang. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * §5.3 — the outcome of a fetch, split on **the user's next action**, not on the
 * diagnosis they can't act on:
 *
 * - `ok` — a page we parsed into at least one candidate; step 3 confirms it.
 * - `retryable` — offline, a timeout, a network failure, or a 5xx/429. The page
 *   is unreachable *right now*, so the promoted action is Retry.
 * - `dead-end` — a 401/403/404, or a 200 with no usable image. Retrying the
 *   parser can't help, so the escape hatch is a photo. `sourceUrl` is carried
 *   **always** (the user typed it; it's true of the item regardless), and
 *   `name`/`brand` **only when a page was actually parsed** (the no-image case) —
 *   null on the status dead-ends, where there was no product page to read.
 * - `cancelled` — the caller aborted; not an error, just restore the field.
 */
export type FetchOutcome =
  | { status: 'ok'; result: WebImportResult }
  | { status: 'retryable'; message: string }
  | {
      status: 'dead-end';
      message: string;
      sourceUrl: string;
      name: string | null;
      brand: string | null;
    }
  | { status: 'cancelled' };

/**
 * §5.3 — "would trying again plausibly help?" as one rule, not a case-by-case
 * table: 2xx is a page to parse, 5xx/429 are transient (retryable), and every
 * other status (401/403/404 and any stray 4xx) is a dead-end the parser can't
 * get past however many times it re-runs.
 */
export function classifyStatus(status: number): 'ok' | 'retryable' | 'dead-end' {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429 || status >= 500) return 'retryable';
  return 'dead-end';
}

/**
 * §5.3 — fetch a page and classify the result. An **offline pre-flight** fires
 * the retryable error immediately rather than waiting out the timeout; a **10s
 * abort** caps a slow page into the same retryable error; and an external
 * `signal` lets step 2's Cancel abort the very same request — distinguished from
 * the timeout because a caller abort reports `cancelled`, not an error.
 *
 * `Response.url` (the post-redirect URL) becomes `sourceUrl` so a shortener
 * resolves to the durable product page; the pasted string is the fallback.
 */
export async function fetchProductPage(
  pastedUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<FetchOutcome> {
  const url = pastedUrl.trim();

  // The pre-flight only rules out the certain-offline case; captive portals and
  // stale state are why it never gates step 1 and why a "reachable" verdict still
  // goes through the real fetch (and its timeout).
  const network = await Network.getNetworkStateAsync();
  if (network.isConnected === false || network.isInternetReachable === false) {
    return { status: 'retryable', message: OFFLINE_MESSAGE };
  }

  // One internal controller aborts on **either** the 10s timer or the caller's
  // Cancel, so a single `signal` drives the fetch; we read the caller's signal
  // afterward to tell the two aborts apart.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
  } catch {
    if (options.signal?.aborted) return { status: 'cancelled' };
    return { status: 'retryable', message: UNREACHABLE_MESSAGE };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }

  const category = classifyStatus(response.status);
  if (category === 'retryable') {
    return { status: 'retryable', message: UNREACHABLE_MESSAGE };
  }
  if (category === 'dead-end') {
    // A status dead-end (403/404) has no product page to read, so no name/brand.
    return { status: 'dead-end', message: NO_IMAGE_MESSAGE, sourceUrl: response.url || url, name: null, brand: null };
  }

  const result = parsePage(await response.text(), response.url || url);
  if (result.candidates.length === 0) {
    // The no-image dead-end: a 200 we *did* parse, so name/brand carry through.
    return {
      status: 'dead-end',
      message: NO_IMAGE_MESSAGE,
      sourceUrl: result.sourceUrl,
      name: result.name,
      brand: result.brand,
    };
  }
  return { status: 'ok', result };
}

/** The pure parse: HTML + the resolved page URL in, candidates + metadata out. */
export function parsePage(html: string, resolvedUrl: string): WebImportResult {
  const candidates = galleryCandidates(html, resolvedUrl);

  const title = decodeEntities(metaContent(html, ['og:title', 'twitter:title']));
  const siteName = decodeEntities(metaContent(html, ['og:site_name']));

  return {
    candidates,
    sourceUrl: resolvedUrl,
    name: cleanName(title, siteName),
    brand: siteName || null,
  };
}

/**
 * The full candidate pipeline (#41): priority extraction + harvest, absolutized
 * and de-junked, then narrowed by the page's platform, collapsed to one URL per
 * distinct photo, and finally ordered so the clean-background packshot leads.
 */
function galleryCandidates(html: string, resolvedUrl: string): string[] {
  const platform = detectPlatform(html, resolvedUrl);
  const raw = [...imageCandidates(html), ...harvestImages(html)];

  const usable = raw
    .map((candidate) => absolutize(candidate, resolvedUrl))
    .filter(nonEmpty)
    .filter((url) => !isJunkImage(url));

  return platform.order(dedupeByIdentity(platform.scope(usable)));
}

/**
 * The extra pass #23 lacked: image URLs living in a JSON blob or `srcset` rather
 * than a `<meta>`/`<img src>`. Retail SPAs commonly serialise the gallery as
 * JSON with `/`-escaped slashes (`https://…`), so we un-escape first,
 * then scrape every absolute image URL plus Demandware's root-relative statics.
 * Everything is deduped downstream by identity, so over-collecting here is safe.
 */
function harvestImages(html: string): string[] {
  const unescaped = html
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&');
  const absolute = unescaped.match(ABSOLUTE_IMAGE_URL) ?? [];
  const demandwareRelative = unescaped.match(DEMANDWARE_STATIC_URL) ?? [];
  return [...absolute, ...demandwareRelative].map(decodeEntities);
}

const IMAGE_EXT = String.raw`\.(?:jpe?g|png|webp|avif)(?:\?[^"'\\\s)]*)?`;
const ABSOLUTE_IMAGE_URL = new RegExp(String.raw`https?:\/\/[^"'\\\s)]+${IMAGE_EXT}`, 'gi');
const DEMANDWARE_STATIC_URL = new RegExp(
  String.raw`(?:\/on\/demandware\.static|\/dw\/image)[^"'\\\s)]+${IMAGE_EXT}`,
  'gi',
);

/**
 * Drop URLs that are never the product: favicons, logos, sprites, UI icons,
 * `data:` URIs and `.svg` chrome. The bias is deliberately **over-include** — we
 * only reject what is clearly not a product photo, because the confirm step's
 * swap row is the real safety net and a missing shot can't be recovered there.
 * (This is also what stops factory54's favicon `og:image` from being auto-picked.)
 */
function isJunkImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:')) return true;
  if (/\.svg(\?|$)/.test(lower)) return true;
  if (
    /favicon|sprite|(?:^|[/_-])logo(?:[/_.-]|$)|apple-touch|\bplaceholder\b|[/_-]icons?[/_-]|payment|\bflags?\b/.test(
      lower,
    )
  ) {
    return true;
  }
  // Share buttons and carousel chrome (factory54 serves these from the same dir
  // as its product shots), matched only as a delimited token in the *basename*
  // so a product filename that merely contains the letters isn't caught.
  return /(?:^|[/_-])(?:left-arrow|right-arrow|arrow|chevron|prev|next|pinterest|twitter|facebook|instagram|whatsapp|youtube|tiktok|linkedin|share|wishlist|cart|bag|search|menu|close|play|badge|spinner|loader)[0-9]*(?:[/_.-]|$)/.test(
    basename(lower),
  );
}

/**
 * A platform adapter narrows and orders the harvested URLs. The generic case is
 * identity on both; the Demandware and Shopify cases add the boosts that let us
 * show only the chosen colour and lead with the clean-background shot.
 */
type Platform = {
  /** Keep only the images that belong to the item the URL actually points at. */
  scope(urls: string[]): string[];
  /** Reorder so the clean-background packshot, when known, is candidate `[0]`. */
  order(urls: string[]): string[];
};

const GENERIC_PLATFORM: Platform = {
  scope: (urls) => urls,
  order: (urls) => urls,
};

function detectPlatform(html: string, resolvedUrl: string): Platform {
  if (/demandware\.static|\/dw\/image\/|dwvar_/i.test(html) || /\/dw\/image\//i.test(resolvedUrl)) {
    return demandwarePlatform(resolvedUrl);
  }
  if (/cdn\/shop\/|cdn\.shopify\.com|myshopify|Shopify\.theme|window\.Shopify/i.test(html)) {
    return shopifyPlatform(html, resolvedUrl);
  }
  return GENERIC_PLATFORM;
}

/**
 * Salesforce Commerce Cloud (Hackett, factory54). Image filenames encode both
 * the colour (`…_816_…`) and the shot type — `_MO` on-model / `_FL` flat-lay for
 * Hackett, `_L_` look / `_P_` packshot for factory54. So we filter to the colour
 * the URL names and float the clean-background packshot to the front. When the
 * named colour matches no filename (factory54 names `KHAKI`, but its lone-colour
 * page encodes no colour in the filename) the filter no-ops rather than empties.
 */
function demandwarePlatform(resolvedUrl: string): Platform {
  const color = colorFromUrl(resolvedUrl);
  const isCleanBackground = (url: string) => /_fl\.|_p_\d/i.test(basename(url));
  return {
    scope(urls) {
      if (!color) return urls;
      const pattern = new RegExp(`_${escapeRegExp(color)}_`, 'i');
      const forColor = urls.filter((url) => pattern.test(basename(url)));
      return forColor.length > 0 ? forColor : urls;
    },
    order: (urls) =>
      [...urls].sort((a, b) => Number(isCleanBackground(b)) - Number(isCleanBackground(a))),
  };
}

/**
 * Shopify (piniparma). A product page carries hundreds of CDN images — every
 * colour, plus recommended products — with no colour code in the filename. But
 * each product has a handle (`/products/peach-polo-made-in-italy`), and the
 * distinguishing token of that handle (`peach`; `made`/`italy` are site-wide,
 * `polo` is shared) appears in this product's filenames and not the neighbours'.
 * So we keep CDN images whose filename carries the handle's rarest token, which
 * doubles as the colour filter the URL can't otherwise give us on Shopify.
 */
function shopifyPlatform(html: string, resolvedUrl: string): Platform {
  const handle = resolvedUrl.match(/\/products\/([^/?#]+)/i)?.[1]?.toLowerCase();
  const tokens = handle ? distinctiveHandleTokens(handle, html) : [];
  const isCdn = (url: string) => /cdn\/shop\/|cdn\.shopify\.com/i.test(url);
  return {
    scope(urls) {
      if (tokens.length === 0) return urls;
      return urls.filter(
        (url) => !isCdn(url) || tokens.some((token) => url.toLowerCase().includes(token)),
      );
    },
    order: (urls) => urls,
  };
}

/** The rarest (most product-specific) tokens of a Shopify handle, length ≥ 3. */
function distinctiveHandleTokens(handle: string, html: string): string[] {
  const handles = new Set(
    (html.match(/\/products\/[a-z0-9][a-z0-9-]+/gi) ?? []).map((h) =>
      h.replace(/\/products\//i, '').toLowerCase(),
    ),
  );
  handles.add(handle);

  const frequency = new Map<string, number>();
  for (const h of handles) {
    for (const token of new Set(h.split('-'))) {
      if (token.length >= 3) frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const tokens = [...new Set(handle.split('-'))].filter((token) => token.length >= 3);
  if (tokens.length === 0) return [];
  const rarest = Math.min(...tokens.map((token) => frequency.get(token) ?? 1));
  return tokens.filter((token) => (frequency.get(token) ?? 1) === rarest);
}

/** The `color`-ish query value the URL names, or null. */
function colorFromUrl(resolvedUrl: string): string | null {
  try {
    for (const [key, value] of new URL(resolvedUrl).searchParams) {
      if (/color/i.test(key) && value) return value;
    }
  } catch {
    // An unparseable URL simply yields no colour to filter on.
  }
  return null;
}

/**
 * Collapse size/format variants of one photo (`…_small`, `…_grande`, `…_1024x`,
 * `?v=…`, and a CDN's transform path vs its static path) to a single candidate,
 * keyed by the stable filename identity. First-seen order is preserved, and the
 * best variant of each identity (absolute, un-downscaled, longest) is kept.
 */
function dedupeByIdentity(urls: string[]): string[] {
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const id = imageIdentity(url);
    const group = groups.get(id);
    if (group) group.push(url);
    else {
      groups.set(id, [url]);
      order.push(id);
    }
  }
  return order.map((id) => pickBestVariant(groups.get(id) as string[]));
}

const SIZE_SUFFIX = /_(?:small|medium|large|grande|compact|master|pico|icon|thumb|\d+x\d*|x\d+)$/i;

/** A photo's stable identity: its basename, minus query, extension and size tag. */
function imageIdentity(url: string): string {
  const path = url.split(/[?#]/)[0];
  const base = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
  return base.replace(/\.(?:jpe?g|png|webp|avif)$/i, '').replace(SIZE_SUFFIX, '');
}

/** Prefer an absolute, full-size URL among variants of the same photo. */
function pickBestVariant(urls: string[]): string {
  return [...urls].sort((a, b) => variantRank(b) - variantRank(a) || b.length - a.length)[0];
}

function variantRank(url: string): number {
  const base = basename(url).replace(/\.(?:jpe?g|png|webp|avif)$/i, '');
  let rank = 0;
  if (/^https?:\/\//i.test(url)) rank += 2;
  if (!SIZE_SUFFIX.test(base)) rank += 1;
  return rank;
}

/** The last path segment (query stripped), for filename-shaped inspection. */
function basename(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.substring(path.lastIndexOf('/') + 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Image URLs in priority order, before absolutizing/dedup. */
function imageCandidates(html: string): string[] {
  return [
    ...metaContents(html, ['og:image', 'og:image:url', 'og:image:secure_url']),
    ...metaContents(html, ['twitter:image', 'twitter:image:src']),
    ...jsonLdImages(html),
    ...largestImgsFirst(html),
  ].map(decodeEntities);
}

/** First `content` for any of `keys`, across `<meta>` tags in any attr order. */
function metaContent(html: string, keys: string[]): string {
  return metaContents(html, keys)[0] ?? '';
}

/** Every `content` whose `property`/`name` is one of `keys`, in document order. */
function metaContents(html: string, keys: string[]): string[] {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const out: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase();
    if (key && wanted.has(key)) {
      const content = attr(tag, 'content');
      if (content) out.push(content);
    }
  }
  return out;
}

/** `image` values pulled from every JSON-LD block, flattened to URL strings. */
function jsonLdImages(html: string): string[] {
  const blocks =
    html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ??
    [];
  const out: string[] = [];
  for (const block of blocks) {
    const json = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      collectImageUrls(JSON.parse(json), out);
    } catch {
      // A malformed block is skipped, not fatal — the other sources still stand.
    }
  }
  return out;
}

/** Walk a parsed JSON-LD value, pushing any `image` URL (string/array/object). */
function collectImageUrls(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectImageUrls(child, out);
    return;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    pushImageValue(record.image, out);
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') collectImageUrls(value, out);
    }
  }
}

function pushImageValue(image: unknown, out: string[]): void {
  if (typeof image === 'string') out.push(image);
  else if (Array.isArray(image)) {
    for (const entry of image) {
      if (typeof entry === 'string') out.push(entry);
      else if (entry && typeof entry === 'object') {
        const url = (entry as Record<string, unknown>).url;
        if (typeof url === 'string') out.push(url);
      }
    }
  } else if (image && typeof image === 'object') {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string') out.push(url);
  }
}

/** `<img>` srcs ordered largest-first by their `width` attribute (0 if absent). */
function largestImgsFirst(html: string): string[] {
  const imgs: { src: string; width: number }[] = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src');
    if (!src) continue;
    imgs.push({ src, width: Number(attr(tag, 'width')) || 0 });
  }
  return imgs.sort((a, b) => b.width - a.width).map((img) => img.src);
}

/** A single quoted attribute value, matched independent of attribute order. */
function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[2] ?? match[3]) : undefined;
}

/**
 * §5.3 — "blank beats junk". Split `og:title` on `|`, `–`, `—`; drop any segment
 * equal to `og:site_name`; first survivor is the Name. Nothing survives → null,
 * so Review renders an empty field rather than a junk pre-fill to hand-edit.
 */
function cleanName(title: string, siteName: string): string | null {
  const site = siteName.trim().toLowerCase();
  const survivor = title
    .split(/[|–—]/)
    .map((segment) => segment.trim())
    .find((segment) => segment.length > 0 && segment.toLowerCase() !== site);
  return survivor ?? null;
}

/** Resolve a possibly-relative URL against the page; drop anything unparseable. */
function absolutize(raw: string, base: string): string {
  try {
    return new URL(raw, base).href;
  } catch {
    return '';
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function nonEmpty(value: string): boolean {
  return value.length > 0;
}
