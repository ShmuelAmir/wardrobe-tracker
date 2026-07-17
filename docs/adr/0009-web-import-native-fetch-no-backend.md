# 9. Web import via native `fetch` — no proxy, no backend

- Status: Accepted
- Date: 2026-07-17
- Owner: [#3 — Research: web image import](https://github.com/ShmuelAmir/wardrobe-tracker/issues/3) (findings on branch `research/web-image-import`), [#9](https://github.com/ShmuelAmir/wardrobe-tracker/issues/9); §5.3, §5.4 of `SPEC.md`

## Context

The primary, highest-quality add-item path imports a garment from a brand product
page. In a browser this would hit CORS and typically need a proxy/backend to fetch
third-party pages — which would contradict the on-device-only foundation
(ADR-0001).

## Decision

**Fetch the product page directly with RN's native `fetch`; no proxy, no backend.**

> Key finding: RN's `fetch` does not enforce CORS — native apps have no CORS — so
> brand pages can be fetched directly.

- Parse the HTML for an image: `og:image` → `twitter:image` → JSON-LD → largest
  `<img>`. `og:image` is present on most SSR retail pages.
- Reliability is **site-dependent** (client-rendered SPAs, anti-bot 403s can fail),
  which is exactly why the manual photo fallback is **mandatory**, not a nicety.
- **The image downloads at step 3 ("Use this image"), not at Save** — into the
  *cache* dir under its UUID name. Downloading at Save would hide a network
  round-trip behind a button read as instant/local and could fail *after* the form
  is filled, with `image_file` being `notNull` and no escape.
- **URL validation is `http(s)` syntax only** — no attempt to detect "is this a
  product page". Any rule sharp enough to reject a homepage will eventually reject a
  real product page. A wrong image from a non-product URL is guarded by
  **confirmation** (step 3), not validation.
- **Store `Response.url`** (final URL after redirects) as `source_url`, so shortened
  links resolve to the durable product page; fall back to the pasted string.

## Consequences

- No server to run, host, or secure — consistent with ADR-0001.
- Only **two** real error states, split on the user's *next action*, not on what
  went wrong: a **retryable** state (offline, timeout, 5xx/429/network) and a
  **dead-end** state (403/401, 404, 200-with-no-usable-image). 403 is a dead-end
  (likely anti-bot) but never locks the user out — the URL field stays editable and
  Fetch stays live.
- Name/brand pre-fill from `og:title` gets light cleanup only (split on separators,
  drop `og:site_name`); nothing survives → leave blank. Blank beats junk.
- Both fallback routes carry state forward, never restart (see ADR-0010).
