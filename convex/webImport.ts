import { v } from 'convex/values';

import {
  BROWSER_HEADERS,
  classifyStatus,
  isFetchableUrl,
  NO_IMAGE_MESSAGE,
  parsePage,
  UNREACHABLE_MESSAGE,
  type WebImportOutcome,
} from '../src/web-import';
import type { Id } from './_generated/dataModel';
import { action } from './_generated/server';
import { normalizeJpeg } from './normalizeImage';
import { requireOwner } from './owner';

/**
 * §5.3 — web import's server leg (ADR-0019). The fetch runs here rather than in
 * the browser for one reason: **no browser is enforcing CORS in an action**, so
 * there is no proxy to build and no permissive header to wait on a retailer to
 * send. The default runtime is enough — `parsePage` is pure regex and the image
 * codec is pure JavaScript, so nothing here needs `"use node"`.
 *
 * **Neither action ever throws at the client** (invariant #7). A thrown error
 * carries no `sourceUrl` and no metadata, so it is exactly the flow-restart
 * ADR-0010 bans; every reachable failure comes back as a value the wizard can
 * carry into Review instead. Signing out is the one exception, and it is not a
 * failure of the import — an unauthenticated caller has no wizard to strand.
 */

/** §5.3 — long enough for a slow retail page, short enough not to hang a step. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * A ceiling on what we will pull down before decoding. The default runtime has
 * 64 MiB and a decoded frame is 4 bytes a pixel, so the guard has to bite on the
 * compressed bytes, before the frame exists.
 */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** §5.4 — the dead-end copy when a page answered but its image is unusable. */
const IMAGE_UNUSABLE_MESSAGE = "Couldn't use that image. Add your own instead.";

/**
 * Fetch and parse a product page. `Response.url` — the URL *after* redirects —
 * becomes `sourceUrl`, so a shortened link resolves to the durable product page
 * rather than a shortener that rots.
 */
export const importPage = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<WebImportOutcome> => {
    await requireOwner(ctx);
    const url = args.url.trim();

    // §5.3 — `http(s)` **syntax only**. We never ask "is this a product page":
    // any rule sharp enough to reject a homepage eventually rejects a real
    // product page, and the confirm-image step is the validation that matters.
    if (!isFetchableUrl(url)) {
      return { status: 'dead-end', message: NO_IMAGE_MESSAGE, sourceUrl: url, name: null, brand: null };
    }

    const first = await fetchPage(url);
    if (first !== REJECTED) return first;

    // §5.4's ⚠️ — a connection-level anti-bot reject throws instead of answering
    // with a status, and calling every throw retryable is what produces a Retry
    // button that can never work. One invisible retry is the whole
    // disambiguation: a transient blip survives it, a fingerprint reject
    // reproduces in ~50ms and lands on the dead end, which at least carries the
    // URL into Review.
    const second = await fetchPage(url);
    if (second !== REJECTED) return second;

    return { status: 'dead-end', message: NO_IMAGE_MESSAGE, sourceUrl: url, name: null, brand: null };
  },
});

/** Download the confirmed candidate, normalize it, and store the one file. */
export const importImage = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<ImageImportOutcome> => {
    await requireOwner(ctx);

    let bytes: Uint8Array;
    try {
      const response = await fetch(args.url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const category = classifyStatus(response.status);
      if (category === 'retryable') return { status: 'retryable', message: UNREACHABLE_MESSAGE };
      if (category === 'dead-end') return { status: 'dead-end', message: IMAGE_UNUSABLE_MESSAGE };

      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      // Unlike the page fetch, a throw here needs no auto-retry to classify: the
      // page already answered, so the URL and metadata are in the wizard's hands
      // and Retry is a real offer rather than a dead control.
      return { status: 'retryable', message: UNREACHABLE_MESSAGE };
    }

    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { status: 'dead-end', message: IMAGE_UNUSABLE_MESSAGE };
    }

    let normalized;
    try {
      normalized = normalizeJpeg(bytes);
    } catch {
      // Bytes we cannot decode — an error page served as the image, or a format
      // the runtime's pure-JS codec does not read (§4.2). Either way retrying
      // re-downloads the same bytes, so this is a dead end and the escape hatch
      // is Review's drop zone (§5.5).
      return { status: 'dead-end', message: IMAGE_UNUSABLE_MESSAGE };
    }

    const storageId = await ctx.storage.store(
      new Blob([normalized.bytes as BlobPart], { type: 'image/jpeg' }),
    );
    const url = await ctx.storage.getUrl(storageId);
    if (url === null) return { status: 'dead-end', message: IMAGE_UNUSABLE_MESSAGE };

    return { status: 'ok', storageId, url, width: normalized.width, height: normalized.height };
  },
});

/**
 * §5.4 — what step 3 can hear back. `ok` carries the serving URL as well as the
 * id, because Review previews the stored file rather than bytes it holds — on
 * this path the browser never sees the image before it is stored.
 */
export type ImageImportOutcome =
  | { status: 'ok'; storageId: Id<'_storage'>; url: string; width: number; height: number }
  | { status: 'retryable'; message: string }
  | { status: 'dead-end'; message: string };

/**
 * The sentinel for "the request was rejected at the connection, so there is no
 * status to classify" — distinct from every outcome, because it is the one case
 * the caller answers by trying again rather than by reporting.
 */
const REJECTED = Symbol('connection rejected');

async function fetchPage(url: string): Promise<WebImportOutcome | typeof REJECTED> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // A timeout is an abort *we* fired, so it says nothing about the far end and
    // is retryable on its face. Only an unexplained reject earns the retry.
    if (isTimeout(error)) return { status: 'retryable', message: UNREACHABLE_MESSAGE };
    return REJECTED;
  }

  const category = classifyStatus(response.status);
  if (category === 'retryable') return { status: 'retryable', message: UNREACHABLE_MESSAGE };

  const resolved = response.url || url;
  if (category === 'dead-end') {
    // A status dead-end (403/404) served no product page, so there is nothing to
    // read a name or brand off — only the URL the user typed survives.
    return { status: 'dead-end', message: NO_IMAGE_MESSAGE, sourceUrl: resolved, name: null, brand: null };
  }

  let result;
  try {
    result = parsePage(await response.text(), resolved);
  } catch {
    // A body that never lands is the same shrug as a network failure.
    return { status: 'retryable', message: UNREACHABLE_MESSAGE };
  }

  if (result.candidates.length === 0) {
    // The no-image dead end: a 200 we *did* parse, so name and brand carry.
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

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
