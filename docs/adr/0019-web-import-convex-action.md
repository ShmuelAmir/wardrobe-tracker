# 19. Web import is a Convex action

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0009](./0009-web-import-native-fetch-no-backend.md)
- Owner: [#102 — Decide the web-import failure UX](https://github.com/ShmuelAmir/wardrobe-tracker/issues/102), with mechanics from [#92](https://github.com/ShmuelAmir/wardrobe-tracker/issues/92) and normalization from [#94](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94); §5.3–§5.5 of `SPEC.md`

## Context

ADR-0009 fetched brand product pages directly from the device. Its argument was a
chain: native apps do not enforce CORS, therefore fetch directly, therefore no
backend is needed, therefore this is consistent with ADR-0001's no-cloud stance.

On the web the first link breaks — a browser *does* enforce CORS, and brand sites do
not send permissive headers — and the last link is gone anyway, because there is now
a backend (ADR-0014). Only the premise dies, though: the conclusion "no proxy" can
be reached again by the opposite architecture.

## Decision

**Web import runs server-side, in a Convex action.**

Same "no proxy" outcome, opposite reasoning: the fetch happens where no browser is
enforcing CORS, so there is nothing to work around.

Mechanically simpler than expected. Actions make arbitrary outbound `fetch` calls,
**no `"use node"` runtime is needed**, and `parsePage()` ports **verbatim** — it is
pure regex, so neither cheerio nor linkedom is required at all. `ctx.storage.store(blob)`
is verified against the installed types.

**Substantially more of ADR-0009 survives than the platform change suggests, and it
is restated here rather than left in a superseded document:**

- The **parse cascade**: `og:image` → `twitter:image` → JSON-LD → largest `<img>`.
- **Syntax-only `http(s)` URL validation.** We do not try to detect "is this a
  product page": any rule sharp enough to reject a homepage will eventually reject a
  real product page and lock the user out of the primary path. A confidently wrong
  image is guarded by **confirmation, not validation** — the confirm-image step *is*
  the validation.
- **`sourceUrl` stores `Response.url`** after redirects, so a shortened link resolves
  to the durable product page rather than a shortener that rots.
- **`og:title` cleanup where blank beats junk**: split on `|` `–` `—`, drop segments
  matching `og:site_name`, first survivor → Name, `og:site_name` → Brand, nothing
  survives → leave blank.
- **The two error states split on the user's next action**, not on what went wrong.

**Actions return structured failure results, never throws.** A thrown error in an
action is exactly the flow-restart ADR-0010 bans. `FetchOutcome` ports as-is; no new
status earns its place, because "Convex is blocked" and "the site is down" are the
same shrug from the client.

**`BROWSER_HEADERS` stay — as a parse-fidelity requirement, not an anti-bot one.**
They have no measured effect on access, but they change what is served (factory54
returns 321,603 bytes with the UA against 282,732 without), and the committed
fixtures were captured with it.

## Consequences

- **The egress regression is real but small, and it was measured rather than
  inferred.** The fetch moves from a residential IP to Convex's small, fixed,
  shared-across-tenants eu-west-1 egress — a single stable IP, `54.73.189.39` —
  so this app can in principle inherit another tenant's block. Across eleven
  retailers the **replatform-attributable regression is zara alone** (residential
  200, Convex 403, stable across three calls). Four other failures — hm, farfetch,
  asos, net-a-porter — refuse a residential `curl` identically and were already dead
  ends, exactly as ADR-0009 anticipated. **Vendor predicts the block, not the IP**:
  every Cloudflare-fronted site passed from the datacenter IP; both Akamai-fronted
  sites 403'd from both origins.
- **So the manual fallback stays what ADR-0009 called it — mandatory, and still the
  exception.** An earlier reading of this ledger promoted it to "the common path";
  measurement put the cost at roughly **9%**, not a reordering of the flow.
  **Paste-a-URL remains the primary entry point** on exactly that basis.
- **The dead end changes shape, and this is the decision that matters most.**
  ADR-0009's mandatory *photo* fallback silently assumed **you are holding the
  garment** — which web import contradicts by design; the user has the product page
  open in another tab. The dead end therefore lands on Review holding
  everything-but-the-image, with a **drop zone in the image slot** (clipboard paste
  on both platforms, drag-and-drop on desktop) and the **source URL as a link**.
  The fallback is thereby **strictly better on web than it was on native**, and it
  rescues even the pre-existing Akamai dead ends.
- **One real bug ports with `FetchOutcome` and must be fixed.** Connection-level
  anti-bot rejects *throw* rather than return a status, and the catch classifies
  **every** throw as `retryable` — producing a Retry button that can never work.
  That is an ADR-0010 violation the native app ships today. The fix is **one
  invisible auto-retry, then dead-end**: a transient blip survives it, a fingerprint
  reject reproduces in ~50ms.
- **Normalization for this path runs server-side, inside the action**, while file
  uploads normalize client-side — one file either way, so ADR-0006 holds.
- **Cost is negligible** against the free tier; function calls are ~1.5% of the
  ceiling and the binding constraint is image egress (ADR-0018).
- **The parser corpus stays on disk as real HTML fixtures**, which is what splits
  web-import testing across the two Vitest projects: `edge-runtime` has no `fs`, so
  parser tests stay in jsdom and only the failure contract is tested in the Convex
  project.
