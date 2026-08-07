# Research: web-import as a Convex action

Ticket: [ShmuelAmir/wardrobe-tracker#92](https://github.com/ShmuelAmir/wardrobe-tracker/issues/92)

Date: 2026-08-07. Sources are Convex 1.43.0 primary docs (docs.convex.dev, fetched
2026-08-07), the installed `convex` npm package's own `.d.ts` files, and this repo's
`convex/_generated/ai/guidelines.md` (Convex's own current agent guidance). Community
sources flagged inline as such.

Scope: this ticket answers *whether and how* web-import's server-side leg (fetch
product-page HTML → parse image URL → download the image → put it in storage) can
run as a Convex action, replacing the client-side `fetch` from `src/web-import.ts` /
`src/web-download.ts` (native app, ADR-0009) now that the target is a browser, where
CORS forbids fetching third-party HTML directly. It does not re-derive the parsing
logic (§2 of `research/web-image-import.md` and `src/web-import.ts` already solved
that as pure, dependency-free string/regex code) or design the Convex schema/API
surface — those are implementation, not research.

---

## 1. Can an action make arbitrary outbound HTTP requests?

**Yes — documented, no egress allowlist, no SSRF protection.** Convex's own actions
doc states the default runtime "supports `fetch`, so actions that simply want to
call a third-party API using `fetch` can be run in this environment" [1]. There is no
mention anywhere in the actions, runtimes, or networking docs of a host allowlist,
blocked ports, or SSRF filtering on outbound `fetch` — an action can hit any
`http(s)://` URL, exactly like `src/web-import.ts`'s RN `fetch` today.

The only networking control Convex documents runs the **other direction**: Convex
publishes a fixed, region-scoped set of *outbound* IP addresses so an external
service *can* allowlist Convex if it wants to [2]. For `eu-west-1` (this project's
region) those are IPv4 `3.248.173.188`, `34.242.144.108`, `54.170.181.63`,
`54.195.47.143`, `54.73.189.39`, `63.33.186.66`, plus two `/56` IPv6 ranges [2]. The
docs explicitly warn these IPs are **shared across all Convex deployments in the
region**, so a third-party site cannot distinguish this app's action traffic from any
other Convex app's — relevant to §8 below. **Documented:** no allowlist restricts
*this app's* outbound reach. **Inferred:** individual target sites are free to block
Convex's published IP ranges the same way they block any other datacenter range.

---

## 2. Hard limits on an action

From the Convex limits doc [3] and confirmed by the actions doc [1]:

| Limit | Default (V8) runtime | Node.js runtime (`"use node"`) |
|---|---|---|
| Wall-clock timeout | **30 minutes** [3] | **10 minutes** [1][3] |
| Memory | **64 MiB** [1][3] | **512 MiB** [1][3] |
| Function argument size | 16 MiB | 5 MiB [3] |
| Function return-value size | 16 MiB | 16 MiB |
| Concurrent ops per action (fetch/query/mutation calls) | 1000 [1] | 1000 |

**Response-size caveat:** the 20 MiB figure in the limits doc is scoped to **HTTP
action** responses (`convex/http.ts` endpoints reachable from the public internet)
[3], not to a regular `action`'s outbound `fetch` calls or its own return value. A
regular action's `fetch(productPageUrl)` and `fetch(imageUrl)` calls are bounded only
by the runtime's memory (64 MiB V8 / 512 MiB Node) and the 30-minute (V8) / 10-minute
(Node) wall clock — not by a documented Convex-imposed byte cap on the fetched
response itself. **Documented:** the per-runtime timeout/memory table above.
**Inferred:** a fetched image or HTML body is capped in practice by runtime memory,
since the whole response is buffered as a `Blob`/string before `ctx.storage.store()`
sees it — undocumented as an explicit "max fetched-file size," but 64 MiB (V8) is
comfortably above "a few hundred KB to a few MB" and even a multi-MB hero shot fits
inside 64 MiB many times over. A product-page HTML document is typically under 1 MiB
even for large SPA bundles' server-rendered shell, so both the HTML fetch and the
image fetch fit the V8 default runtime's memory with wide headroom.

**Verdict for this feature:** both the HTML fetch (~tens to a few hundred KB of text)
and the image download (a few hundred KB to a few MB) sit far inside even the
smaller, faster, always-warm default-runtime limits — no need to reach for the
Node.js runtime's larger 512 MiB ceiling on memory grounds alone.

---

## 3. Runtime: default (V8) vs Node.js (`"use node"`)

**Default runtime** — a custom JS runtime Convex describes as "very similar to the
Cloudflare Workers runtime" [4]. It has **no cold starts** ("the runtime is always
up, and ready to handle any function at a moment's notice") [4], supports "most web
standard globals" — `fetch`, `Request`, `Response`, `Headers`, `FormData`,
`TextEncoder`/`TextDecoder`, `atob`/`btoa`, Web Streams, Web Crypto, `WebAssembly`,
and a handful of Node globals (`process.env`, `AsyncLocalStorage`, `AsyncResource`)
[4] — and "most npm libraries that work in the browser, Deno, and Cloudflare
Workers" [4]. This repo's own guidelines confirm `fetch()` needs no `"use node"` [5].

**Node.js runtime** (`"use node";` at the top of the file) — full Node.js 20 (or 22 /
24 via `convex.json`) [4], for npm packages that need genuine Node built-ins
(`fs`, `crypto` native bindings, etc.) or aren't Workers-compatible. Trade-offs: a
**cold start** (the docs' explicit reason the default runtime is "faster") [4],
**lower** argument-size ceiling (5 MiB vs 16 MiB) [3], and — the sharpest structural
rule — a file with `"use node"` **cannot also export a `query` or `mutation`**, and
plain `action`s that don't need Node built-ins should stay in the default runtime
file [5][1].

**Which one does this feature need? Neither strictly requires Node.js.** Everything
web-import needs — `fetch()` for the HTML and image bytes, string/regex parsing, and
`ctx.storage.store(blob)` — is available in the default runtime [1][4][6]. The
existing `src/web-import.ts` parser is already pure, dependency-free regex/string
code with **no DOM parser and no native imports** by design ("Parsing is
deliberately regex-based: RN ships no DOM parser… kept free of native imports so the
whole parse is a pure function") — that design choice ports to the default Convex
runtime unchanged, zero new npm dependency required. **Recommendation: default
runtime, no `"use node"`.** Reach for Node only if a future need (e.g. `sharp` for
server-side image transcoding) requires a genuine Node native module — not for
parsing or fetching.

---

## 4. HTML-parsing library runtime compatibility

Because the existing parser is regex-based and environment-agnostic, **no HTML
parsing library is required at all** to port §5.3 of the original spec — this is the
strongest finding of this ticket. Answering the ticket's specific question for
completeness, in case a future need (e.g. more robust JSON-LD/DOM traversal) argues
for a real parser:

- **`cheerio`** — works in Convex actions; a Convex Stack tutorial runs
  `cheerio.load(html)` and jQuery-style selectors directly inside an
  `internalAction` with no `"use node"` directive shown [7]. Since Convex's default
  runtime explicitly supports "npm libraries that work in the browser, Deno, and
  Cloudflare Workers" [4] and cheerio ships browser/ESM builds on top of pure-JS
  `parse5`/`htmlparser2`, this is consistent with the runtime's documented
  capability, but the Stack example is a **community/tutorial source**, not a
  compatibility statement in the primary docs — **inferred, not fully confirmed** for
  every cheerio code path.
- **`linkedom`** and **`node-html-parser`** — no Convex-specific primary-source
  confirmation found in docs.convex.dev or Stack. Both are pure-JS (no native
  bindings, no Node-only built-ins), which fits the same "Workers-compatible npm
  package" bar the docs describe [4], but this is **inferred by design, not verified
  against Convex specifically**.
- **A regex/streaming approach** (the status quo) — **confirmed working**, since it
  requires nothing beyond the string/`fetch` APIs the default runtime documents
  directly [1][4].

**Recommendation:** port `parsePage()` from `src/web-import.ts` verbatim (it's
already a pure function taking `html: string` and `resolvedUrl: string`) — no new
parsing dependency, no runtime question to resolve.

---

## 5. Streaming a downloaded image into Convex file storage

**Yes, and the API is `ctx.storage.store(blob)`.** From the installed package's own
types (`node_modules/convex/dist/cjs-types/server/storage.d.ts`, `StorageActionWriter`
interface — ground truth for 1.43.0):

```ts
// Only available in actions and HTTP actions.
store(blob: Blob, options?: { sha256?: string }): Promise<GenericId<"_storage">>;
```

`get()`/`store()` are called out as the two methods `ctx.storage` gains specifically
**in actions** (not in mutations/queries) [8][the .d.ts above]. The documented usage
pattern for a fetched third-party file is exactly this feature's shape [6]:

```ts
const response = await fetch(imageUrl);
const image = await response.blob();
const storageId: Id<"_storage"> = await ctx.storage.store(image);
```

**Storage id:** `store()` resolves to `Id<"_storage">` (aliased `GenericId<"_storage">`
in the interface) — this is what gets persisted on the wardrobe item's document and
later resolved to a servable URL via `ctx.storage.getUrl()` [5][8]. The docs did not
surface an explicit example of streaming a `Response.body` `ReadableStream` straight
into storage without an intermediate `.blob()` — `await response.blob()` is the
documented and, per the file-storage overview, the load-bearing shape ("Convex
storage stores items as `Blob` objects. You must convert all items to/from a `Blob`
when using Convex storage.") [5]. Given the response body is buffered as a `Blob`
regardless, this reconfirms §2: the whole image sits in the 64 MiB (V8) / 512 MiB
(Node) action memory budget at once — fine for a few-MB product photo, but not a
truly unbounded streaming path.

There is also a separate **upload-URL flow** (`ctx.storage.generateUploadUrl()`,
called from a *mutation*, then a client `POST`s bytes to the returned URL) [8] — not
relevant here, since the client never holds the third-party bytes; the action is the
only party that ever sees them.

---

## 6. Surfacing failures to the client (carrying `source_url` — ADR-0010)

Convex does not have a special "typed action error" channel beyond what the caller
builds: an action either returns its declared value or throws, and a thrown error
propagates to the `ctx.runAction` / client caller as a rejected promise carrying the
message (public actions get a generic/redacted message unless wrapped in
`ConvexError`; internal-action call sites see the real message). **This is standard
Convex function-call behavior**, not something documented specifically for this
scenario — **inferred**, not a distinct primary-source citation.

What this means for ADR-0010's "never restart a flow; always carry state" invariant:
the action itself only ever sees the *fetch* outcome (network error, HTTP status,
absence of a parseable image) — the same four-way split `src/web-import.ts` already
encodes today (`ok` / `retryable` / `dead-end` / `cancelled`). Porting that
`FetchOutcome` union as the action's **return value** (not a thrown error, for every
case except a genuine infra fault) is what makes the invariant honorable end-to-end:
the action returns a structured result — `{ status: 'ok', ... }` or
`{ status: 'dead-end', message, sourceUrl, name, brand }` etc. — so the client
always has `source_url` and whatever metadata was parsed to carry into Review, exactly
as ADR-0010 requires, regardless of *why* the import failed (404, bot-blocked 403,
timeout, non-image content-type, or a redirect chain that lands somewhere with no
usable image). Only a genuine Convex-infra failure (action crash, 30-min/10-min
timeout exceeded, out-of-memory) surfaces as a thrown/rejected promise instead of a
structured result — and per ADR-0010 the client-side wizard must treat *that* the
same way it already treats "retryable" (offline/timeout) rather than inventing a
fifth state or restarting the flow, since a thrown error carries no metadata at all
to hand to Review. **Documented:** action-throws-propagate-to-caller is basic Convex
function semantics referenced throughout the guidelines file [5], but no primary
source specifically addresses "structuring a fetch-outcome type as an action return
value" — that's this repo's own established pattern (`FetchOutcome` in
`src/web-import.ts`), reapplied.

---

## 7. Compute/egress cost of one import against Free-plan limits

Free plan: **20 GB-hours/month** action compute, **1 GB/month** data egress, **1M**
function calls/month, **1 GB** file storage, **1 GB/month** database I/O [9][3].

**Action compute** is GB-hours = (memory allocated) × (wall-clock duration). One
import does two fetches sequentially inside one action invocation: a product-page
`fetch` (network-bound, likely 200 ms–2 s) and an image `fetch` (similarly network-
bound, maybe 0.5–3 s for a multi-MB file), plus negligible parse/CPU time. Call it a
generous **5 seconds** of wall clock at the default runtime's **64 MiB**:

- 64 MiB ≈ 0.0625 GiB; 5 s ≈ 0.00139 hours → **≈ 0.000087 GB-hours per import**
  (using GiB≈GB for this order-of-magnitude estimate).
- Against the 20 GB-hour/month allowance, that's roughly **230,000 imports/month**
  before hitting the action-compute ceiling — action compute is not the binding
  constraint for any realistic usage of a personal wardrobe app.

**Egress (1 GB/month)** is the tighter budget. Egress is billed on data Convex sends
*out* — for this feature, that's primarily the action's own return value (HTML is
consumed and discarded inside the action; only the parsed result and the stored
image travel further) and, separately, whatever the client later downloads when it
displays the stored image via `ctx.storage.getUrl()`. If each import's stored photo
is retrieved a handful of times by the owning user (wardrobe list, item detail), a
1–3 MB image viewed ~5–10 times is 5–30 MB of egress per item; **1 GB/month
comfortably covers dozens to low-hundreds of imports and views per month** for a
single-user or small-household app, but would need watching if this became
multi-tenant or high-traffic. **Inferred estimate**, not a documented per-operation
cost — Convex's docs give the plan ceilings [9][3] but not a per-`fetch`-byte
accounting model; this repo would need to confirm actual egress via the dashboard
after shipping.

---

## 8. Bot-blocking risk — the single biggest threat to this feature

**This is a real, likely-underestimated risk, and it changes character entirely
compared to the native app.** In `src/web-import.ts`'s current (native) design, the
fetch runs from the **user's own iPhone**, over the user's own residential/cellular
IP, with a browser-shaped `User-Agent` — indistinguishable from the user opening the
page in Safari. Moving the fetch into a Convex action moves it to **Convex's cloud
infrastructure**, fetching from a small, fixed, published set of AWS `eu-west-1` IP
addresses [2] that — by Convex's own explicit admission — are **shared across every
Convex app in the region** [2].

This is materially worse for anti-bot exposure than a generic "some cloud IP," for
two compounding reasons:

1. **Datacenter-IP classification.** Major retail/e-commerce platforms (Cloudflare,
   Akamai, PerimeterX/Human, Shopify's own bot management, Salesforce Commerce
   Cloud's) commonly maintain IP-reputation lists that flag AWS/GCP/Azure ranges as
   "datacenter," independent of `User-Agent` — the same class of defense
   `docs/adr/0009-web-import-native-fetch-no-backend.md` already flags as a
   *site-dependent* risk on native, but native at least starts from a clean
   residential-reputation IP. The action starts from a *known-bad* one.
2. **Shared-reputation blast radius.** Because the egress IPs are pooled across all
   Convex tenants [2], if *any* other Convex app scrapes aggressively enough to get
   an IP or range flagged/rate-limited by a given retailer's WAF, **this app inherits
   that block with zero fetches of its own** — a failure mode that doesn't exist on
   native at all, where each device carries its own reputation.

**Documented:** the shared, fixed, small IP-range fact itself [2]. **Not documented
anywhere in Convex's docs:** any claim about how commonly this actually gets blocked
by real retail sites, or any mitigation Convex offers (there's no rotating-IP /
residential-proxy feature). This is squarely a **known-unknown risk that primary
Convex docs are silent on**, consistent with what the ticket asked to flag honestly.

**Practical implication for this feature:** the ADR-0009 "manual photo fallback is
mandatory, not a nicety" principle, and ADR-0010's "never restart, always carry
`source_url`" principle, both become **more** load-bearing on web than they were on
native — the dead-end rate from bot-blocking is likely to be *higher* server-side
than the native baseline, not the same or lower. Any implementation should budget for
this being a frequent, not rare, path through the wizard, and the same UA header
(`BROWSER_HEADERS` in `src/web-import.ts`) should be sent from the action as a
minimum mitigation, though it will not defeat IP-reputation-based blocking.

---

## Uncertainty / inferred vs documented — summary

- **Documented directly:** outbound fetch is unrestricted [1]; timeout/memory table
  [1][3]; HTTP-action (not action) 20 MiB response cap is a different limit than this
  feature hits [3]; `fetch()` needs no `"use node"` [1][4][5]; `ctx.storage.store`
  signature and `Id<"_storage">` return type, straight from the installed package's
  `.d.ts` [8, node_modules]; the fetch→blob→store code shape [6]; the shared,
  region-fixed egress IP list [2]; Free-plan numeric ceilings [9][3].
- **Inferred, not confirmed by a primary Convex source:** cheerio/linkedom/
  node-html-parser's exact compatibility in Convex's default runtime specifically
  (reasoned from "Workers-compatible npm libraries" + one community tutorial [7], not
  a compatibility-matrix page); the real-world frequency of retail-site bot-blocking
  against Convex's specific IPs (no data exists to cite either way); egress cost
  per import (estimated from plan ceilings, not a documented per-byte model);
  action-throw-propagation semantics applied to this specific flow (general Convex
  behavior, not scenario-specific docs).
- **Recommendation carried into implementation:** default (V8) runtime, no
  `"use node"`, reuse the existing regex-based `parsePage()` verbatim, return a
  structured `FetchOutcome`-shaped value (not a thrown error) for every fetch/parse
  failure so `source_url` and any parsed metadata always reach Review, and treat
  bot-blocking as the primary failure mode to design the manual-fallback UX around —
  not an edge case.

---

## Sources

1. [Convex Docs — Actions](https://docs.convex.dev/functions/actions) — fetch support, timeout, memory, concurrency, runtime comparison
2. [Convex Docs — Networking (production)](https://docs.convex.dev/production/networking) — outbound egress IP addresses per region, shared-IP caveat
3. [Convex Docs — Limits (production/state)](https://docs.convex.dev/production/state/limits) — action timeout/memory table, argument/response size limits, Free-plan action compute and egress
4. [Convex Docs — Runtimes](https://docs.convex.dev/functions/runtimes) — default V8 runtime vs Node.js runtime, supported globals, npm compatibility, cold starts
5. `convex/_generated/ai/guidelines.md` (this repo, Convex-generated current guidance) — action/file-storage rules, `"use node"` restrictions, storage Blob requirement
6. [Convex Docs — File Storage overview](https://docs.convex.dev/file-storage) — fetch→blob→store code pattern for third-party files
7. [Convex Stack — Real-time GitHub/npm stat counter for TanStack.com](https://stack.convex.dev/tanstack-real-time-github-npm-stat-counter) — community tutorial using `cheerio.load(html)` inside a Convex `internalAction`
8. `node_modules/convex/dist/cjs-types/server/storage.d.ts` (installed convex@1.43.0) — `StorageActionWriter.store(blob, options?): Promise<GenericId<"_storage">>`
9. [Convex Pricing](https://www.convex.dev/pricing) — Free-plan metered allowances (action compute, function calls, storage, database I/O, data egress)
10. `docs/adr/0009-web-import-native-fetch-no-backend.md`, `docs/adr/0010-guided-wizard-never-restart-carry-state.md`, `src/web-import.ts`, `src/web-download.ts` (this repo) — the native implementation and invariants this ticket ports server-side
11. `research/web-image-import.md` (this repo) — original native-side research this ticket extends
