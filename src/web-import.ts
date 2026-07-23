/**
 * §5.3 — the web-import parse. RN's `fetch` enforces no CORS (native apps have
 * none), so brand pages are fetched directly — **no proxy, no backend**. The
 * page HTML is parsed for an image in a fixed priority order:
 *
 *   `og:image` → `twitter:image` → JSON-LD → largest `<img>`
 *
 * The first candidate is what step 3 auto-picks; the rest fill the thumbnail row
 * to swap among. Reliability is site-dependent (SPAs and anti-bot 403s can
 * fail), which is exactly why step 3's manual fallback is mandatory — the
 * failure states themselves are their own ticket; this module is the happy path.
 *
 * Parsing is deliberately regex-based: RN ships no DOM parser, and meta/JSON-LD
 * extraction from server-rendered retail HTML doesn't need one. It is also kept
 * free of native imports so the whole parse is a pure function pinned by tests,
 * with only `fetchProductPage` reaching for the (mockable) global `fetch`.
 */

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

/** Fetch a page and parse it, storing the post-redirect URL as `sourceUrl`. */
export async function fetchProductPage(pastedUrl: string): Promise<WebImportResult> {
  const response = await fetch(pastedUrl.trim(), { headers: BROWSER_HEADERS });
  const html = await response.text();
  // `Response.url` is the final URL after redirects, so a shortener resolves to
  // the durable product page. Fall back to the pasted string if it's absent.
  return parsePage(html, response.url || pastedUrl.trim());
}

/** The pure parse: HTML + the resolved page URL in, candidates + metadata out. */
export function parsePage(html: string, resolvedUrl: string): WebImportResult {
  const candidates = dedupe(
    [...imageCandidates(html)].map((raw) => absolutize(raw, resolvedUrl)).filter(nonEmpty),
  );

  const title = decodeEntities(metaContent(html, ['og:title', 'twitter:title']));
  const siteName = decodeEntities(metaContent(html, ['og:site_name']));

  return {
    candidates,
    sourceUrl: resolvedUrl,
    name: cleanName(title, siteName),
    brand: siteName || null,
  };
}

// A browser-like User-Agent nudges anti-bot pages toward serving us real HTML.
// The dead-end handling for the 403s that get through is a later ticket (§5.3).
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
};

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

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function nonEmpty(value: string): boolean {
  return value.length > 0;
}
