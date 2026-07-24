/**
 * §8.1 Source field — the one field in the app that leaves it. A web-imported
 * item's `source_url` is the resolved product page (§5.1); the detail screen
 * shows only its hostname, because that is what a person recognises, and links
 * the raw URL out.
 *
 * The host is pulled with a regex rather than `new URL()`: React Native's `URL`
 * is a partial polyfill, and a `source_url` can also be the pasted fallback
 * string when no fetch ever resolved (§5.1), which may not parse. On no match we
 * return the string unchanged so the field still renders something real. A
 * leading `www.` is dropped as noise.
 */
export function sourceHostname(url: string): string {
  const match = url.match(/^[a-z]+:\/\/([^/?#]+)/i);
  if (!match) return url;
  return match[1].replace(/^www\./i, '');
}
