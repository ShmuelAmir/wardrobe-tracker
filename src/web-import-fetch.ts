/**
 * §5.3 — the native app's leg of web import: the fetch, its connectivity
 * pre-flight and its timeout, wrapped around `web-import.ts`'s pure parse. The
 * web app has no counterpart — there the same fetch is a Convex action, because
 * a browser enforces CORS and an action has no browser (ADR-0019).
 */
import * as Network from 'expo-network';

import {
  BROWSER_HEADERS,
  classifyStatus,
  NO_IMAGE_MESSAGE,
  OFFLINE_MESSAGE,
  parsePage,
  UNREACHABLE_MESSAGE,
  type WebImportOutcome,
} from './web-import';

/** §5.3 — long enough for a slow retail page on cellular, short enough not to hang. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * The importer's outcomes plus the one only a client can produce: `cancelled`,
 * the caller's own abort, which is not an error but a cue to restore the field.
 */
export type FetchOutcome = WebImportOutcome | { status: 'cancelled' };

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
  // Cancel, so a single `signal` drives the request; we read the caller's signal
  // afterward to tell the two aborts apart. The whole fetch **and body read**
  // sit inside the try so a Cancel mid-download still aborts and a parse throw
  // can't escape as an unhandled rejection that strands step 2's spinner.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });

    const category = classifyStatus(response.status);
    if (category === 'retryable') {
      return { status: 'retryable', message: UNREACHABLE_MESSAGE };
    }
    if (category === 'dead-end') {
      // A status dead-end (403/404) has no product page to read, so no name/brand.
      return {
        status: 'dead-end',
        message: NO_IMAGE_MESSAGE,
        sourceUrl: response.url || url,
        name: null,
        brand: null,
      };
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
  } catch {
    // A caller abort is a Cancel, not an error; the 10s timeout and any other
    // failure (network drop, a body read that never lands) are retryable.
    if (options.signal?.aborted) return { status: 'cancelled' };
    return { status: 'retryable', message: UNREACHABLE_MESSAGE };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}
