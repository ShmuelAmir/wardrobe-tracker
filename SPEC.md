# wardrobe-tracker — build-ready spec (v2, Convex web app + PWA)

A personal wardrobe tracker: catalog your garments, build outfits from them, and read per-item usage stats. A responsive web app and installable PWA, backed by Convex. Single-user and private.

**Status:** build-ready. Every decision here is locked. This document is assembled from the wayfinding [map #87](https://github.com/ShmuelAmir/wardrobe-tracker/issues/87) and its fifteen resolved decision tickets; each section cites the ticket that owns it. Where tickets amended one another, **this document states the amended result only** — the superseded text is not repeated here. See [Decision index](#decision-index) for the trail and [Amendment chain](#amendment-chain) for what changed under whom.

**This document supersedes v1**, which specified a native iOS app (Expo / React Native, on-device SQLite). v1 is not repeated, mirrored, or archived here: it is tagged **`spec-v1`** (commit `1cf8daf`), its wayfinding is [map #1](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1) with twelve resolved tickets, and the *reasoning* it recorded lives on in `docs/adr/` — seven of the thirteen ADRs are marked `Superseded by` their heirs, and six carry amendments. A second build-ready spec on disk, one of which is false, is the landmine the ADR ledger exists to prevent; there is only ever one.

Nothing here is a suggestion. Where a decision has an accepted cost, the cost is recorded next to it rather than left to be rediscovered.

---

## 1. Product shape

> Owner: map #87's Notes and [#96 — Prototype: the responsive desktop and phone layouts](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96).

Single-user and private. **The web app is the product**; the native iOS app is legacy and is deleted at cutover.

**Why this exists.** The native app failed as a *delivery mechanism*, not as a design — free-tier provisioning profiles expire every 7 days, so using it means a Mac and a re-sign. Web is the escape hatch. Two secondary motivations shape the design: browsing the wardrobe from a laptop, and running web-import on the machine where brand sites are actually being browsed.

Three destinations: **Wardrobe**, **Outfits**, **Stats**.

- **Wardrobe** — catalog items (image, category, name, brand, season). Add via web-import from a brand product page, or file upload.
- **Outfits** — build outfits from items; log "Wore this today".
- **Stats** — per-item wear counts; most / least / never worn.

The only thing a user does *daily* is log a wear. The design bends toward that: the wear-again rail sits above the list pane on every screen (§7.1), and Stats is a surface you read rather than act on (§9).

### 1.1 One shell: master–detail, and it never breaks

**Desktop is about never losing your place.** Every screen is one two-pane shape — a 64px icon rail, a list pane, and a persistent detail pane — and the shape does not break on any screen, including Stats.

**Only the desktop layout forks.** All three layout theses tested in #96 collapsed toward the same phone layout below 900px, so this is **one phone design plus one desktop design**, not two independent designs. Navigation is therefore one component and one media query (§7.4), not two trees.

**Feature parity with v1 minus camera capture.** File upload replaces it. Everything else — wardrobe, add-item wizard, outfit builder, stats, wear logging, wear-again rail — carries over.

### 1.2 Online-only for v1

There is an honest offline screen (§14.5) and no queued writes. Read-only offline caching is a later enhancement, not v1 scope. Convex is the source of truth and there is no local mirror.

---

## 2. Foundation & stack

> Owners: [#88 — Provision a Convex project and wire up local dev](https://github.com/ShmuelAmir/wardrobe-tracker/issues/88) and [#95 — Prototype: a Vite + React + Convex vertical slice](https://github.com/ShmuelAmir/wardrobe-tracker/issues/95).

| Concern | Decision |
|---|---|
| Build tool | **Vite** (SPA build, no SSR) |
| UI | **React** — a fresh app, **not `react-native-web`** |
| Router | **React Router v7, library mode** (§7) |
| Backend | **Convex** — database, functions, file storage, scheduling, auth |
| Styling | Real CSS with **CSS custom properties** generated from the token modules (§10.10, ADR-0013) |
| Tests | **Vitest**, one config, two projects (§15) |
| Hosting | **`@convex-dev/static-hosting`** on the Convex deployment itself (§14) |
| PWA | **`vite-plugin-pwa`**, `generateSW`, `registerType: 'prompt'` (§14.3) |
| Plan | Convex **Free** tier — a hard constraint every decision inherits |

**`react-native-web` was rejected, and the rejection was tested rather than assumed.** #95 built the slice: the domain modules port **unmodified** — `parseWardrobeView` drives the wardrobe screen off `URLSearchParams` without noticing it isn't `useLocalSearchParams` — and the ~17 screens are rewritten in real CSS at roughly **1:1, ~6,000 lines of view code**. The risk in that port is the outfit builder and the stats screen, not bulk volume.

### 2.1 Deployments

| | Name | URL |
|---|---|---|
| Dev | `mellow-oyster-459` | `https://mellow-oyster-459.convex.cloud` |
| **Prod** | **`acrobatic-swan-379`** | **`https://acrobatic-swan-379.convex.cloud`** |

Team `shmuel-amir`, project `wardrobe-tracker`, region **eu-west-1 (Ireland)**. The **app origin** is `https://acrobatic-swan-379.convex.site` — see §14.1, where its permanence is load-bearing.

Credentials live in a gitignored `.env.local`. **There are no CI secrets** (§15.6), and there is no deploy key.

Env vars are **`VITE_`-prefixed**. The Convex CLI wrote `EXPO_PUBLIC_`-prefixed vars at #88 because it detected Expo; renaming them is part of the web scaffold.

### 2.2 The free tier, and the one ceiling that binds

The binding constraint is **data egress at 1 GB/month** — not the 1 GB file-storage limit. Storage holds ~6–7k items; serving a 200-item grid **uncached** costs ~30 MB, so a few dozen cold loads spend the month.

Three findings shape what can be done about it, and the third overturns the first two:

1. Convex documents **no CDN and no default `Cache-Control`** (#89).
2. `getUrl()` **does in fact** send `cache-control: private, max-age=2592000` — measured on 1.43.0, undocumented — so warm repeat views already cost zero egress (#95).
3. **A custom HTTP action serving `public, max-age=1y, immutable` is not edge-cached.** Measured `cf-cache-status: DYNAMIC` on three consecutive requests: Convex's Cloudflare zone does not cache HTTP action responses at all, and a custom route costs *more* per miss (#98).

**So there is no caching work to do.** The browser cache is the only cache obtainable, `getUrl` already gets it, and egress is spent by cold loads only. The lever that remains is image size, which is why §4.2 trims the normalization target. Function calls (~1.5% of the ceiling) and database I/O are not binding.

A ~300 kB JS bundle is ~3,300 cold loads against the month; images dominate by orders of magnitude (§14.1).

---

## 3. Data model

> Owner: [#97 — Decide the Convex data model for items, outfits, and wear events](https://github.com/ShmuelAmir/wardrobe-tracker/issues/97), with research from [#91](https://github.com/ShmuelAmir/wardrobe-tracker/issues/91). Image field per [#98](https://github.com/ShmuelAmir/wardrobe-tracker/issues/98).

**Four tables, six indexes, no new concepts.** The relational model ports almost verbatim; every glossary term survives. The two genuine breaks are the composite primary key and monotonic integer ids, and neither costs the domain a word.

### 3.1 Rules

1. **Wear stats are derived, never stored** (ADR-0004). No `wearCount`, no `lastWorn` column. Aggregated on read through `wearEvents → outfitItems → items`.
2. **`@convex-dev/aggregate` is rejected.** It is idiomatic for aggregates native to *one* table; wear count is native to a *join*, so using it requires a write-time-fanned "wear-credit" table — structurally the denormalized counter ADR-0004 exists to refuse. Revisit at **~20k wear events** (≈50 years at one wear a day), or if the stats query approaches the 32,000-document / 16 MiB transaction ceiling.
3. **`userId` is `v.string()` on all four tables** — the auth user id stored directly, no internal `users` join. A `users` table for one human is ceremony, and the string survives swapping a beta auth provider. On the join table too: every authz check becomes a field comparison instead of a parent fetch, and the denormalization cannot drift because a join row's owner never changes.
4. **No `createdAt` anywhere.** `_creationTime` is the same fact and is already the implicit final column of every index, so §9.3's oldest-first Never-worn comes free.
5. **Category and Season are enforced server-side** via `v.union(v.literal(…))`. This **reverses** ADR-0005's "no `CHECK` constraint" sub-decision: that reasoned about SQLite's migration friction, and on Convex a validator change is an ordinary code-and-redeploy.
6. **No pagination.** The grid does a full `.collect()` scoped by `by_user`, sorted in JS. Convex pages may grow or shrink under live writes and their boundaries are unstable across a re-sort — which the most/least-worn sorts trigger on **every wear log**. Paginating imports that instability into the one screen whose order reacts, to solve a problem 200 items do not pose.

### 3.2 Schema (`convex/schema.ts`)

```ts
const category = v.union(
  v.literal("Top"), v.literal("Bottom"), v.literal("Outerwear"),
  v.literal("Footwear"), v.literal("Accessory"), v.literal("Bag"),
);
const season = v.union(
  v.literal("spring"), v.literal("summer"),
  v.literal("fall"), v.literal("winter"),
);

items: defineTable({
  userId: v.string(),
  image: v.id("_storage"),               // opaque identity — see §4.3
  imageUrl: v.string(),                  // denormalized, written once at insert
  category,
  name: v.optional(v.string()),
  brand: v.optional(v.string()),
  season: v.optional(v.array(season)),
  sourceUrl: v.optional(v.string()),
}).index("by_user", ["userId"]),

outfits: defineTable({
  userId: v.string(),
  name: v.optional(v.string()),
  occasion: v.optional(v.string()),
}).index("by_user", ["userId"]),

outfitItems: defineTable({
  userId: v.string(),
  outfitId: v.id("outfits"),
  itemId: v.id("items"),
})
  .index("by_outfit", ["outfitId"])
  .index("by_item", ["itemId"]),

wearEvents: defineTable({
  userId: v.string(),
  outfitId: v.id("outfits"),
  wornOn: v.string(),                    // "YYYY-MM-DD", day-granular
})
  .index("by_user", ["userId"])
  .index("by_outfit", ["outfitId"]),
```

**Six indexes and no more.** Category and season filtering stays in JS: an index per filter combination buys nothing at ~200 items and costs a schema decision per new filter. `outfitItems` carries `userId` for the authz assert but gets **no `by_user` index** — it is only ever reached through a parent-scoped query, so nothing would read it. **No `by_outfit_and_item`** either: §3.3 removes its only would-be caller.

**Verbatim from v1:** `wornOn` stays a `"YYYY-MM-DD"` string — day-granular is the domain fact, it is timezone-proof, and it sorts lexically, which the card and leaderboard tiebreaks already rely on. `sourceUrl` unchanged. Season unchanged in meaning: absent means unset, a 4-element array means year-round, and there is still deliberately **no "All-season" literal**.

### 3.3 Uniqueness: the write path's signature replaces the composite key

An item appears at most once per outfit. That was a composite primary key `(outfit_id, item_id)`; Convex has no composite key, and the replacement is **not** a check-then-insert.

**Membership writes stay set-shaped**, which is what the code already does — `saveOutfit` and `updateOutfit` (`src/outfit-save.ts`) both write the join wholesale. There has never been an incremental "add item to outfit" write path, so the composite key was never defending against a second writer; it was defending against a duplicate *inside one `itemIds` array*.

So the mutations take `itemIds: v.array(v.id("items"))`, dedupe, and replace the whole set. **No `addItemToOutfit` mutation is ever exposed.** A duplicate becomes **unreachable rather than rejected** — the guarantee moves from the storage layer to the shape of the only write path, which is a stronger place for it than a check-then-insert that a later second write path could bypass.

### 3.4 Cascade deletes: hand-written, row-side

There is no FK-cascade analog and no `PRAGMA foreign_keys = ON` to port. The cascades become mutation code:

- **Delete an item** → query `outfitItems` by `by_item`, delete every match, and delete the stored file in the same mutation (§4.3). Outfits survive minus that garment; `wearEvents` untouched.
- **Delete an outfit** → query `outfitItems` by `by_outfit` **and** `wearEvents` by `by_outfit`, delete both.

**Atomicity survives unchanged** — a Convex mutation is a single transaction, so there is no window where the item is gone but its join rows remain. Only *enforcement* moves from a database feature to tested application code (§15.3).

The **zero-item outfit** arises by exactly the same route as before: deleting an item removes join rows, the outfit survives, its wear events keep counting. Still a legal labelled state, still reachable only by declining §8.4's cleanup offer.

### 3.5 Ordering: `_creationTime`, with `_id` as final tiebreak

**`_id` is opaque in Convex and carries no creation order.** Four places leaned on autoincrement ids being monotonic: `compareCards`, `mostWornOrder`, `leastWornOrder`, and the outfit cover pick.

**The ordering key is `_creationTime`, with `_id` as the final tiebreak.** Under autoincrement, id order *was* creation order, so `_creationTime` preserves every one of those semantics exactly. The `_id` string compare underneath costs nothing and guarantees a **total** order even when two documents share a millisecond.

> ⚠️ That total order is **load-bearing, not cosmetic**. ADR-0012's disjointness invariant is upheld by `leastWornOrder` being the *exact reverse* of `mostWornOrder`, id direction included (§9.2). Without a total order the invariant has a hole. This is one of the two failures in this spec that are **silent** — see §10 and §15.5.

The **outfit cover pick** becomes "earliest-created **member item**" — keyed off the item, not the join row, so it stays stable across `updateOutfit`'s wholesale rewrite of the join.

### 3.6 The `useOutfitCards` three-way split dissolves

That split existed for exactly one documented reason: `useLiveQuery` re-runs only when *its own `from` table* changes, so identity, membership and wear facts had to be three reads merged in JS. **Convex queries are reactive over every table they read**, so the constraint is gone and the three reads collapse into one query function.

`mergeOutfitCards` and `compareCards` are **kept and moved server-side, unchanged**, as pure functions over the three arrays — the tested §7.2 `lastWorn DESC NULLS LAST` logic is worth keeping. Only the hook plumbing that worked around SQLite goes.

### 3.7 Occasion matching without `collate nocase`

`resolveOccasion` matches case-insensitively, which is what makes §6.2's self-building vocabulary work. Convex has no collation. **Decided: collect the outfits in the mutation and match in JS** — no stored normalized `occasionKey` field. A second field that must stay in lockstep with the display spelling earns nothing at a few hundred outfits, and it would put a concept in the schema the domain has no word for.

---

## 4. Image lifecycle

> Owner: [#98 — Decide the image lifecycle without a filesystem](https://github.com/ShmuelAmir/wardrobe-tracker/issues/98), with normalization from [#94](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94).

There is no filesystem. Images live in **Convex file storage**; the row holds a storage id and a URL.

### 4.1 One normalized image per item — no originals, no thumbnails

Unchanged in decision, changed in numbers and in *reason*. Every item has exactly one stored file. No original is kept, no thumbnail is generated.

**Target: ~1200px on the long edge, JPEG q0.8, ~150 KB.** Trimmed from v1's 1600px, and the reason moved from disk to **metered egress** — every grid render is now billed against §2.2's ceiling.

**JPEG is forced, not chosen.** Safari cannot *encode* WebP or AVIF via `canvas.toBlob`, even though it decodes both.

**Never upscale.** A 400px source stays 400px.

**No thumbnails**, same conclusion as v1 but a different argument: the browser's own decode path handles downscaling, so the native `allowDownscaling` reasoning is retired. This is why invariant #9 exists (`object-fit: cover`).

### 4.2 One pipeline, two sources

| Source | Where normalization runs |
|---|---|
| File upload | **Client-side** — `createImageBitmap` → canvas → `toBlob` |
| Web import | **Server-side**, inside the Convex action (§5.3) |

One file either way, so ADR-0006 survives.

Two problems solve themselves and must not be re-solved: **EXIF orientation** is handled by spec, since `createImageBitmap`'s `imageOrientation` defaults to `"from-image"`; and **iOS canvas dimension caps** are dodged by resizing *during* decode rather than after.

Convex storage offers **no transforms, no CDN and no cache headers** — the pipeline is the only normalization there is.

### 4.3 Row and file die together

**`ctx.storage.delete()` is fully transactional inside a mutation.** Verified live: delete-then-throw leaves the file serving; delete-then-commit 404s it.

So the item row and its stored file are deleted in **one mutation**, and **a dangling reference becomes unreachable by construction**. ADR-0008's row-first/file-first ordering table has no analog to port, and cross-cutting invariant #3 stops being an ordering rule the implementation must obey and becomes a *structural claim about what the platform permits*.

**The row stores both `image: v.id("_storage")` and a denormalized `imageUrl`.** The serving URL is **not derivable** from the storage id — `getUrl` returns an unrelated opaque UUID — so the alternative was a `_storage` read per item per reactive re-run.

**The storage id is kept as real identity**, which is ADR-0007's principle surviving its mechanism: store opaque identity, never a resolvable path, because paths rot. That is what makes the accepted cost — the denormalized URL embeds the deployment domain — a one-line backfill rather than a data migration. **And that backfill does not exist**, because §14.6 stands prod up empty: no URL is ever stale.

> A stale `imageUrl` is **not** a dangling reference. Decision 4.3's impossibility covers row↔file; the weaker row↔URL link is a render-path concern, and it renders the **category placeholder** (§4.5). This distinction is why the glossary keeps one term rather than two.

### 4.4 Saves, and the orphan sweep on a timer

**Upload happens on wizard submit, not on file pick.** #94 already puts the Blob in hand, so the Review step previews from `createObjectURL` for free — and orphan volume is held down at the source.

**A failed insert retries carrying the same `storageId`**, per ADR-0010: never restart a flow.

**The orphan sweep is a daily cron with a 24-hour age threshold.** This **reverses** ADR-0008's "never on a timer, never in the background", which the original called load-bearing — legitimately, because `_creationTime` retires the reason for the ban. The startup pin existed to rule out the file-exists-before-row race *by construction*; an age threshold rules it out the same way, and a web app has no "startup" worth the name.

An **orphan** — a stored file with no owning row — remains the safe failure mode: invisible, small, reclaimed.

### 4.5 The category placeholder survives

An item whose image cannot be rendered shows a category-shaped placeholder rather than a broken tile. This survives §4.3's impossibility result because it covers the weaker link (§4.3's note), and because it is also the honest render for an image still uploading.

---

## 5. Add-item wizard

> Owners: [#94](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94) (normalization), [#99](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99) (routing, draft persistence), [#102](https://github.com/ShmuelAmir/wardrobe-tracker/issues/102) (failure UX), with the action mechanics from [#92](https://github.com/ShmuelAmir/wardrobe-tracker/issues/92).

A **guided wizard** — one decision per full screen, always-forward with a per-step Back. Each step is a real route (§7.2), so **browser Back is wizard Back**.

### 5.1 Canonical web-import path (primary)

1. **Pick a source** — *Import from web* (primary), *Upload a file*.
2. **Paste link** — a single URL field + **Fetch**. Nothing else on the screen.
3. **Confirm image** — large preview; auto-pick the best candidate (`og:image`) with a thumbnail row to swap among other images found. Plus a **"None of these — use my own image"** bail-out.
4. **Review & fill** — its own screen (§5.5).
5. **Saved** — confirmation, with an **Add another** shortcut. Entered with `replace`, so Back from it lands on the wardrobe.

**Camera capture is gone** (out of scope); step 1's second tile is file upload. §5.6's permission-denial design retires with it — the surviving instance of "one source going quiet, not a dead end" is a failed file pick.

### 5.2 File-upload path

The same wizard; steps 2–3 are replaced by a file picker and a confirm-image screen. Steps 4–5 are identical. **No name/brand pre-fill** — there is no page metadata to read.

### 5.3 Web import is a server-side Convex action

**The fetch moves server-side.** One parser, and no CORS problem to solve — the reason inverts from v1's ("native apps have no CORS") to "there is no browser enforcing CORS in an action", reaching the same "no proxy" conclusion by the opposite architecture.

Mechanically simpler than expected: arbitrary outbound `fetch`, **no `"use node"` needed**, and `parsePage()` ports **verbatim** — it is pure regex, so neither cheerio nor linkedom is required at all. `ctx.storage.store(blob)` is verified against the installed 1.43.0 types.

**What ports unchanged from v1:** the parse cascade (`og:image` → `twitter:image` → JSON-LD → largest `<img>`); **syntax-only `http(s)` URL validation** (any rule sharp enough to reject a homepage eventually rejects a real product page, and a wrong image is guarded by *confirmation*, not validation — step 3 is the validation); storing `Response.url` after redirects as `sourceUrl`; and the `og:title` cleanup where **blank beats junk** (split on `|` `–` `—`, drop segments matching `og:site_name`, first survivor → Name, `og:site_name` → Brand, nothing survives → blank).

**`BROWSER_HEADERS` stay — for parse fidelity, not anti-bot.** They have no measured effect on *access*, but they change what is served: factory54 returns 321,603 bytes with the UA against 282,732 without, and the committed fixtures were captured with it.

**Actions return structured failure results, never throws.** A thrown error in an action is exactly the flow-restart ADR-0010 bans. `FetchOutcome` (`src/web-import.ts:95`) ports as-is; no new status earns its place, because "Convex is blocked" and "the site is down" are the same shrug from the client.

**Offline pre-flight** is `useConvexConnectionState()` (§14.5), not `navigator.onLine`.

### 5.4 Failure UX — bot-blocking costs one site in eleven

The premise that this would be common **did not survive measurement.** Eleven retailers were fetched from Convex's egress (a single stable IP, `54.73.189.39`, eu-west-1) against a residential control:

- **The replatform-attributable regression is zara alone** — residential 200, Convex 403, stable across three calls.
- Blocking is common overall (~5 of 11), but **hm, farfetch, asos and net-a-porter refuse a residential `curl` identically**. They were already dead ends in the native app, exactly as ADR-0009 anticipated, and are not a cost of going server-side.
- **Vendor predicts the block, not the IP:** every Cloudflare-fronted site passed from the datacenter IP; both Akamai-fronted sites 403'd from *both* origins.

So the manual fallback stays what ADR-0009 called it — **mandatory, and still the exception**. The egress move costs roughly **9%**, not a reordering of the flow. **Paste-a-URL stays the primary entry point** on exactly this basis.

**The two failure states still split on the user's next action**, not on what went wrong:

| Outcome | State | Actions |
|---|---|---|
| Offline, timeout (10s), network failure, 5xx, 429 | Retryable | **Retry** |
| 403 / 401, 404, 200-with-no-usable-image | Dead-end | Fall through to §5.5 carrying state |

> ⚠️ **One real bug ports with `FetchOutcome` and must be fixed.** Connection-level anti-bot rejects (asos, net-a-porter) *throw* rather than return a status, and the catch classifies **every** throw as `retryable` — producing a Retry button that can never work. This is an ADR-0010 violation the native app ships today. **Fix: one invisible auto-retry, then dead-end.** A transient blip survives it; a fingerprint reject reproduces in ~50ms.

### 5.5 The dead end is paste-or-drag-an-image, not take-a-photo

**This is the decision that matters most in §5, and it is orthogonal to bot-blocking.** ADR-0009's mandatory photo fallback silently assumed *you are holding the garment* — which web-import contradicts by design. The user has the product page open in another tab.

So the dead-end lands on **Review, holding everything but the image**, with:

- a **drop zone in the image slot** — paste from clipboard on both platforms, drag-and-drop on desktop;
- the **source URL rendered as a link**, so the page you were already looking at is one click away.

**The fallback is therefore strictly better on web than it was on native**, and it rescues even the pre-existing Akamai dead ends.

**Nothing is thrown away.** `sourceUrl` is carried always — the user typed it, and it is a true fact about the item regardless of whether an image could be read. Name and brand are carried whenever the parse actually returned them: real on the no-image dead end, absent on the network-failure path where there was no page to parse.

### 5.6 Step 4 — Review & fill, in two modes

The same screen, two entry points:

- **Create** (the wizard): pre-filled from page metadata, commits a new row, continues to step 5.
- **Edit** (per §8.2): pre-filled from the row, commits an update, returns to the item's detail pane.

**Category is the only required field** in both modes. Name and Brand are text; Season is multi-select chips; Source URL is auto-filled on the web-import path.

Three differences only: the nav becomes **`Cancel` / `Save`**; a **`Delete Item` row at the bottom, Edit mode only**; and **no pre-fill from page metadata** in Edit mode, where `sourceUrl` is *preserved, not re-derived*.

**Replace-image** lives here, in Edit mode, and runs §4.2's pipeline.

### 5.7 The draft persists — including the blob

**ADR-0010 ports intact for the price of one IndexedDB record.** On web, reload is a normal user act rather than a crash, so accepting reload-as-restart would plainly contradict the ADR.

**The whole draft persists — the parsed JSON *and* the image blob** — so a cold load of `/add/review` resumes exactly where you were. JSON-only was rejected: it re-restarts the *expensive* half, making the user re-download or re-pick an image they had already confirmed. IndexedDB stores Blobs natively, and §14.2 establishes that installed PWAs get the full quota with no 7-day eviction.

**Lifecycle: one active record per flow**, overwritten as the walk proceeds, dropped on successful save and on explicit Cancel, kept indefinitely otherwise.

This is a **new module seam with no native counterpart** — a draft-persistence module backing both `AddItemDraftProvider` and `OutfitBuilderProvider`, which keep their current context shape and gain a persisted backing store.

### 5.8 Back is never a trap

Native suppressed Back on the terminal step with `headerBackVisible: false`; the browser will not. **Both halves of the fix are already shipped native behaviour and port verbatim:**

- `review.tsx` already does `router.replace(...)` into `saved`, so `saved` consumes Review's history entry.
- `confirm.tsx`, `confirm-image.tsx` and `review.tsx` already carry `<Redirect>` guards when the capture is null — the deep-link-into-a-dead-step guard is a port, not a new design.

Dropping `saved` entirely was considered and rejected: it deletes a step ADR-0010 names in the canonical path and kills the "Add another" exit, the one affordance that makes bulk-adding bearable.

---

## 6. Outfit builder

> Owner: v1 §6 (unchanged in substance), as re-shelled by [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96) and re-routed by [#99](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99).

A **sectioned checklist**. **No fixed slots** — many items per category, consistent with §3.

**On desktop the outfit being assembled is permanently beside the picker** — the two-pane shell means the builder no longer hides what you have chosen behind a summary bar.

### 6.1 Builder screen

1. **Sectioned picker pane** — one section per category (Top → Bottom → Outerwear → Footwear → Accessory → Bag), each a horizontal rail. Selected items get an accent ring + check and **reorder to the front of their rail**.
2. **Browsing at scale** — each category header carries a **"See all →"** that expands *that one category* into a full vertical grid at `/builder/category/:category`. **No global search in v1.**
3. **Outfit pane** — the running selection, "*N items selected*", a name field, and **Save**. **Save is disabled until ≥1 item is selected.**
4. **Occasion tagging happens at Save** — Save opens a small review sheet (name + occasion) to confirm before it commits.
5. **After Save → the new outfit's detail pane** (not back to the list).

**Category is location, selection is state.** `/builder/category/:category` is a nested route, so **Back steps out of a category, not out of the builder**, and the rail's selection model stays orthogonal to navigation.

**The builder's unsaved selection persists, and there is no confirm-on-leave dialog.** A confirm dialog is a restart-or-lose prompt wearing a politeness costume — the exact failure ADR-0010 exists to prevent. Leaving the builder is always safe; the Outfits `+` offers **"Resume outfit"** instead of ever asking. Selection stays out of the URL.

### 6.2 Occasion — free text, single value, chips that build themselves

`outfit.occasion` is **single-value free text**. The chips are real, but the **vocabulary is built from the user's own history**, not a shipped enum: the top 8 occasions by use count, tiebroken alphabetically.

- **Single value, not multi.** Chips act as **radio buttons**: tapping one replaces the current pick; tapping the active chip clears it. Want "work formal"? Type it — it becomes its own chip.
- **A fixed enum was rejected.** Garment categories are universal (every top is a `Top`), which is why §3's enum works. **Occasions are personal** — "shul", "school run", "gigs". Any list shipped in code is wrong for someone, and there is exactly one user.
- **Ordering: most-used first, tiebreak alphabetical, capped at 8.** A one-off "Wedding" sinks out of the list, by design.

**Normalization on save is required — the chip UI depends on it.** Trim and collapse whitespace, then match the typed value **case-insensitively** against existing occasions (now a **JS scan**, §3.7). On a hit, store the **existing** spelling; otherwise store as typed.

```
input       existing     stored
"  work "   ["Work"]  →  "Work"    (reused)
"WORK"      ["Work"]  →  "Work"    (reused)
"Shul"      ["Work"]  →  "Shul"    (new, as typed)
```

**First spelling wins and becomes canonical.** Forcing a canonical case was rejected — it mangles `NYE` → `Nye`. Without this rule, `work`/`Work` splinter into two chips and the chip UI hands you the exact problem it was chosen to prevent.

**No seeding.** A fresh install has zero outfits, therefore zero chips. Seeding starters (`Work`, `Casual`, `Formal`) would smuggle back through the side door exactly the invented vocabulary rejected above.

**Accepted consequences:** the vocabulary is **self-cleaning** (deleting the last "Gym" outfit retires the chip — correct, and follows necessarily); and there is **no cross-outfit rename**, which is a visible, self-inflicted, low-frequency problem not worth a vocabulary-management surface in v1.

### 6.3 Outfits have no season

Season chips are not on the Save sheet; season tags are not in the detail header. `occasion` carries outfit tagging alone.

**Season is a property of a garment, not of a look.** Deriving it was rejected **on the data, not on taste**:

| outfit | items | union | intersection |
|---|---|---|---|
| summer tee + fall jacket + jeans (unset) | `[summer]`, `[fall]`, absent | `[summer, fall]` | `[]` |

Mixed-season outfits are **normal** and `item.season` is **optional** — so union *and* intersection both return garbage on everyday data. Derived wear-stats work because `wearEvents` rows are unambiguous; seasons are not.

---

## 7. Navigation & routing

> Owners: [#99 — Decide routing and navigation for the web app](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99) and [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96).

**React Router v7 in library mode. One route tree, which both layouts render differently.** 17 expo-router files become 15 routes. The through-line: **location is in the URL, state is not**, and the desktop/phone fork is a presentation choice made once at the shell rather than a second route tree.

**TanStack Router was the real alternative** and was rejected on a specific ground: its headline feature is validated typed search params, and this repo already banks that from `parseWardrobeView` being a **total** parse that degrades malformed values to defaults. Owning that schema in a domain module is a better boundary than owning it in the router.

### 7.1 The URL space

| URL | Renders | Notes |
|---|---|---|
| `/` | Wardrobe grid + empty detail pane | `?sort=`, `?category=` via `parseWardrobeView` |
| `/item/:id` | Grid (parent) + item detail pane | nested; phone = full screen |
| `/item/:id/edit` | Review in Edit mode | nested under detail; dialog ≥900px |
| `/outfits` | Outfit list + empty detail pane | |
| `/outfit/:id` | List (parent) + outfit detail pane | |
| `/stats` | Leaderboards + inspector pane | sub-tabs stay component state |
| `/add` | Wizard step 1 (source) | child of shell; `backgroundLocation` |
| `/add/paste-link` | wizard step 2 | |
| `/add/confirm-image` | wizard step 3 | |
| `/add/confirm` | wizard confirm | |
| `/add/review` | wizard step 4 | |
| `/add/saved` | wizard step 5 | entered with `replace` |
| `/builder` | Builder — picker pane + outfit pane | launched from Outfits `+` |
| `/builder/category/:category` | category grid in the picker pane | nested; Back steps out of the category |
| `*` | redirect → `/` | |

`/` is the wardrobe, and bare `/` already means "whole wardrobe, newest first" by `parseWardrobeView`'s defaults.

**Unknown path → redirect to `/`.** No designed 404: one user, no inbound links.

**An unresolvable `:id` renders an explicit "this item is gone" state in the pane, not a redirect.** This is a *normal* outcome once the same wardrobe is open on a laptop and a phone and one of them deletes something — §3.4's cascades are row-side, so nothing repairs the other tab's URL — and silently bouncing to the grid looks like a bug.

### 7.2 Detail is a nested route, not a pushed one

#96 settled "item detail is the right pane, **not a route**". That reads as *not a **pushed** route*. With nested routes, `/item/:id` renders as a **child** of the wardrobe layout, so the grid is rendered by the parent and never unmounts, while the URL still names the selection. Both properties hold at once, and reload lands you back on the item you were looking at.

Accepted cost: a small hero image rather than a full-bleed one.

### 7.3 Overlays are search params

`wear-logger`, `wear-history-sheet`, `date-backfill-calendar` and `outfit-review-sheet` get **`?sheet=…`** on whatever detail surface hosts them.

- **Not nested routes** — they are modifiers on a surface, not surfaces, and routing them doubles the tree for zero deep-link value.
- **Not pure component state** — with no history entry, Back would exit the whole item detail while a sheet is open, which is exactly the trap.

One uniform rule: **Back closes the topmost open thing.** The param parses as known-string-or-nothing, the same total shape as `parseWardrobeView`.

### 7.4 Navigation chrome and the wear-again rail

**One `<AppNav>` component, one media query** — icon rail above 900px, bottom tabs below, identical destinations. #96's finding that only the *desktop* layout forks is what makes this one component; a breakpoint hook would also make nav a client-measured thing, worse than CSS for a rail↔tabs swap.

**The wear-again rail earns desktop, and relocates.** It becomes a **strip above the list pane on every screen**, rather than sitting atop an Outfits tab — a two-pane shell has no "Outfits tab you land on".

Rail behaviour is unchanged from v1: the **5 most recently worn outfits**, each with a one-tap **"Wore it"** that writes a wear for **today** with no navigation, confirming in place. **Scope is `wears ≥ 1`** — it is "wear *again*", and a never-worn outfit has no "again". **If no outfit has ever been worn, the strip does not render** — no empty scaffold.

The rail is a **strict subset** of detail's capability (one tap, today only), deliberately, because it is the fast path for the common case. Anything else — backfilling a past date — goes through detail.

### 7.5 The `+` affordance

A `+` in the shell, **contextual**: on Wardrobe it opens the add-item wizard, on Outfits it opens the builder. No FAB, no global add.

**The `+` is hidden on Outfits when the wardrobe is empty.** Nothing to build from, so no affordance — **the app never offers a button that can't work** (invariant #8).

On Outfits, when a builder draft is persisted, the `+` offers **"Resume outfit"** (§6.1).

### 7.6 No occasion filter on the Outfits list in v1

§6.2's vocabulary stays Save-sheet-only, exactly the scope it was given. Same argument and answer as §9.6: the surface it would filter is not big enough in v1 to earn it, and it is cheap to add later because the vocabulary query already exists. A known v2 ask.

### 7.7 Zero states carry onboarding — there is no onboarding

No separate onboarding flow, no tour, no cards. Three zero states do the work:

| State | Treatment |
|---|---|
| **Wardrobe, 0 items** | **Full-bleed hero** — gradient ground, big primary **"Add your first item"**. Copy leads with the product-link path. **The only place in the app that gets a hero.** |
| **Outfits, 0 items** (the precondition) | **Gated state** — "Your wardrobe comes first", explains that an outfit *is* items worn together, offers **"Go to Wardrobe"**. **No create button**, and the `+` is hidden. Reads as information, not failure. |
| **Outfits, items but 0 outfits** | **Ordinary empty** — "Build your first outfit" + **"New outfit"**. The `+` is present. |

The two Outfits empties are **different screens**, not one message with a swapped verb.

### 7.8 Every nested surface owns an explicit exit

**Browser Back is an *alias* for a surface's own Back, never the only exit.** This is #93's no-back-button finding written down once so the wizard, the builder, the detail panes and the sheets inherit one contract rather than each rediscovering it. See §14.4 for the standalone chrome contract this feeds.

---

## 8. Item & outfit detail

> Owners: [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96) and [#99](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99); behaviour from v1 §8.

**An item is a place you go, and an edit is a deliberate mode.** On desktop that place is the right pane; on phone it is a full screen. Either way the URL names it (§7.2).

### 8.1 Item detail — read-only

- **Hero image**, then name + brand.
- **Stats strip, three cells:** wear count · days since last worn · outfits count. All derived per §3.1.
- **Fields:** Category, Season (`Any season` when unset), Added. **Source renders only when `sourceUrl` is set** — the hostname, linking out. It is the only field that leaves the app.
- **"In outfits" rail** — the outfits containing this item. When empty: *"Not in any outfit yet — that's why it has never been worn."* — which **explains** a zero wear count instead of just showing it.
- **No delete on this surface.** The read path is safe to browse.

### 8.2 Item edit

`Edit` opens §5.6's Review screen in Edit mode: `Cancel` / **Save**, same controls, no metadata pre-fill, **`Delete Item` at the bottom** — reachable but never on the read path. At `/item/:id/edit`, rendered as a dialog above 900px.

### 8.3 Delete confirms — the asymmetry is real, and the copy says so

A confirmation must surface concrete impact (N outfits / N wears). **This inverts the intuition:**

- **Deleting an item is nearly harmless.** Outfits survive minus the garment; wear history is untouched.
  > *"Used in 4 outfits — Weekday default, Smart evening +2 more. They'll keep their other items, and your wear history won't change."*
  Not in any outfit: *"Nothing else changes."*
- **Deleting an outfit is what destroys history.** Its wear events cascade.
  > *"Its 12 wears will be deleted too, so the wear counts on its 4 items will drop. The items themselves stay in your wardrobe."*

**The confirms deliberately do not feel equally scary.** The item confirm reassures; the outfit confirm warns. This is honest to the schema, and it was verified live: deleting "Weekday default" drops the Oxford Shirt from **20 wears to 8**.

### 8.4 An outfit can outlive all its garments — the last-item confirm

**Support the state, and offer to clean it up.** When the item being deleted is the **last garment in one or more outfits**, the confirm gains a third outcome:

> This is the last item in an outfit — "Weekday default".
> Keep it and it'll have no garments left, but its 12 wears keep counting.
> Delete it too and those 12 wears disappear from your stats.
>
> `Delete item only` · `Delete item + outfit` · `Cancel`

- **The offer is never silent about the wear cost.** Losing wear history is the one thing an item delete otherwise never does, so it must be **named**, not slipped in as tidying.
- **Prevention was rejected:** blocking the delete means an item you own can't be removed because of an outfit you forgot about. Auto-deleting destroys history with no confirm.
- The zero-item outfit remains a **legal, labelled state** — *"Every item in this outfit was deleted — its 12 wears still count toward your stats"* — because **those wears really did happen**. `Delete item only` is the default; cleanup is opt-in.
- Copy is singular/plural correct for the multi-outfit case (`Delete item + 2 outfits`).

### 8.5 Outfit detail & wear logging

- **Header** — name, item count, created date, **occasion tag** (no season, per §6.3).
- **Stats strip** — times worn / last worn / first worn.
- **Item grid.**
- **Wear logging** — **"Wore this today"** is the primary action; a secondary **"Other day"** opens a calendar for past-date backfill (**future dates disabled**). One wear event per log.
- **Edit item set** — re-enters §6's builder, pre-selected. Save opens §6's own review sheet, so **tags are edited exactly where they're created**.
- **Delete outfit** — bottom of Edit, mirroring the item rule.

**Un-logging a wear — two paths, two time horizons:**

1. **`Undo` on the toast — every wear log shows one**, from both surfaces (§7.4's rail and this one). It deletes the wear event just written and **expires with the toast**. This is the mis-tap, rescued **in place, where the action happened**.
2. **The wear history sheet — the durable path.** The stats strip's wears cell is clickable (`12 · wears ›`) and opens `?sheet=wear-history`: one row per wear event, dated, each with `Remove`. This is for *"I logged Tuesday by mistake"*, which a toast can never reach.

**Undo goes on both log surfaces, not just the rail** — the same gesture must not mean two different things depending on where you stood, and the toast is one component.

**Wear history is outfit-level only.** A wear belongs to an outfit, so item detail links to outfits and **never offers to un-log** — un-logging from an item would be ambiguous about which outfit's event dies.

> Un-logging an outfit's *only* wear removes it from §7.4's rail entirely (`wears ≥ 1`). That is a visible consequence the undo has to not feel broken about.

---

## 9. Stats

> Owners: v1 §9 (definitions, ordering, sizing — unchanged), as re-shelled by [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96) and re-keyed by [#97](https://github.com/ShmuelAmir/wardrobe-tracker/issues/97).

**Stats is a leaderboard you read**, not a to-do list you act on. Two views and a global filter, not three views.

**Stats takes the shipped head in the two-pane shell.** The §9.4 podium and the Least/Never sub-tabs live in the **left pane**, with the inspector pane retained — symmetry with every other screen won over giving the podium full width.

### 9.1 "Wears by category" is a filter, not a metric

**There is no category-level aggregate** — no per-category total, no average wears per item, no grouping. The need it served ("which pants do I wear most?") is a *per-item* question asked *within* a category, so it is answered by **scoping the leaderboards** instead.

A **global category filter** sits at the top: `All` (default) + the six categories, re-scoping both lists at once. One control, one state. It also settles never-worn's scoping — same control, no separate rule.

*Rejected:* item-wears grouped by category (the ordering is near-constant — Footwear ≈ total outfit-wears because every outfit has shoes, so it tells you nothing) and average-wears-per-item (answers a "which category is dead weight" question that is not a v1 need).

### 9.2 Most worn / least worn

Same underlying set — **items with at least one wear** — sorted opposite ways. **Never-worn items are excluded from least-worn**: "never worn" and "worn rarely" prompt different actions (*get rid of it* vs *wear it more*), and a wall of zeros would drown out the once-worn coat that is the interesting case.

**Ordering:**

- Most worn: `wearCount DESC, lastWorn DESC, _creationTime DESC, _id DESC`
- Least worn: `wearCount ASC, lastWorn ASC, _creationTime ASC, _id ASC`

Among equal counts, the more recently worn ranks as the bigger favorite and the longest-untouched as the more neglected. The `_creationTime` + `_id` pair is a **deterministic final tiebreak that never renders**; it exists so a reactive re-render cannot visibly reshuffle tied rows.

**Sizing — each list shows `k = min(5, floor(n/2))` rows**, where `n` = worn items **in scope**.

> ⚠️ **The `floor(n/2)` cap enforces the invariant that no item is ever both most-worn and least-worn.** Unfiltered it never binds; **filtered it is the normal case**, since shrinking the set is the filter's entire purpose. Edge cases fall out: `n = 1` → both lists empty; `n = 2..3` → one row each.

> ⚠️ **The two orderings must be exact reverses of each other — including the `_creationTime` and `_id` directions.** The cap only guarantees disjointness if they are. With two items tied on both count and last-worn, the same direction in *both* lists puts the same item first in each, so it lands in both. **This is one of the two silent failures in this spec** (§10, §15.5): get the direction wrong and no error surfaces — an item simply appears on both leaderboards.

**"See all →"** on each leaderboard navigates to `/` re-sorted to match the list tapped from, **carrying the active category filter**. "See all" means *more rows of the same question*, so the destination is a strict superset; dropping the filter would silently discard a just-expressed intent.

### 9.3 Never worn

Items with **zero** wear events, in scope of the global filter.

- **Full list, no truncation.** Unlike a leaderboard (nobody wants rank #23), this is a finite **set** — a to-do list of "deal with these or admit you won't" — and half a set is a strange object.
- **Sorted oldest-first** by `_creationTime`.
- The query returns creation time so a row can show "added 3 days ago" (§9.5).

**Oldest-first does the work a grace period would have done.** A brand-new item is *literally* never worn but is not a *mistake*; sorting by age lets genuine mistakes rise and this morning's purchase sink, with **no threshold to defend or tune**.

**Accepted consequence:** on a fresh install every item is never-worn, so Stats' first impression is two empty leaderboards above a complete copy of the wardrobe. Judged an **honest empty state, not a bug** — §9.4 shapes it.

### 9.4 Pane layout

**Category filter → adaptive most-worn head → Least/Never sub-tabs**, all in the left pane. One list at a time.

**1. Global category filter**, directly under the title, above everything else so it reads as governing every list below. Desktop has room for seven full labels; the phone layout falls back to a horizontally-scrolling chip row — **same information, same position, no other decision changes.**

**2. Most-worn head — adaptive on `k`:**

| `k` | Head |
|---|---|
| `≥ 3` | **Podium** of the top 3 (2–1–3, center raised, "Favorite" on #1), ranks 4..`k` trailing as ranked rows |
| `1–2` | **No podium** — ranked rows under a plain "Most worn" header |
| `0` | Empty state |

> ⚠️ **The podium is sized by `k`, never fixed at 3.** Load-bearing, not cosmetic: a bronze card the `k` cap excluded would **also** be sitting in the least-worn list below — precisely the collision §9.2 exists to prevent. The podium is a *view of the capped slice*, so it inherits the cap.

**Accepted consequence — the podium needs `n ≥ 6` worn items in scope** (`floor(n/2) ≥ 3`). On a 20-item wardrobe every category filter lands at `k=1`, so in practice the podium shows on `All`. **Verified in the prototype, not assumed.** The podium is a reward for a wardrobe with enough history to rank, and the fallback is a legitimate layout rather than a broken one.

**3. Sub-tabs — one list at a time.** `Least worn (k)` / `Never worn (count)`, counts in the labels.

- Default **Least worn**.
- **Forced to Never worn when `k = 0`, with the Least tab disabled.** Without this, a fresh install opens on an empty podium *above* an empty Least-worn tab, with the entire wardrobe hidden behind the unselected tab — two empty things and a hunt. This was a genuine bug caught in the prototype.

### 9.5 Row content & empty states

- **Leaderboard row:** thumbnail, name, `brand · worn N days ago`, wear-count badge.
- **Never-worn row:** thumbnail, name, `brand · added N ago`, `0` badge in the attention tone.

**Never-worn rows always show the "added N ago" line.** It is what makes §9.3's oldest-first ordering **legible**: without it the sort reads as arbitrary; with it, this morning's purchase at the bottom explains itself and the year-old mistake at the top indicts itself.

**Empty states:**

- **Fresh install** (`k=0`): *"No ranking yet — log a wear and your top items show up here."* above the Never-worn tab holding the full wardrobe. **Honest, not alarming.**
- **Filtered to `k=0`**: *"Only one item in `<Category>` has been worn — a leaderboard needs at least two."* **Names the actual reason** rather than showing a blank.

### 9.6 Wardrobe — arrived-at filter only

- Accepts sort + category filter as **search params**; sort values `recent` (default) | `most` | `least`, parsed by `parseWardrobeView`.
- **Indicator: removable chips**, one per active param, each clearing **independently** — so you can drop the category but keep the most-worn sort, or the reverse.
- **Title reflects the active category** (`Footwear`) so the shortened list is explained *before* you reach the chips.
- **No standalone filter surface in v1.** The filter exists only as arrived-at state from "See all →".

**Accepted consequence:** to see only footwear you go via Stats. The Wardrobe's job is browsing what you own, and §6.1's builder already carries per-category rails for the *"show me my tops"* need. **The most likely early v2 ask, and cheap** — the screen already takes filter + sort as params.

### 9.7 Query shape

The leaderboards run as **one reactive query** returning the full worn set, with the `floor(n/2)` slice done in JS — `n` is then just `rows.length`, and both orderings are exact and explicit. This is unchanged from v1 in shape; only the ordering keys moved (§3.5) and the reactivity is now Convex's rather than `useLiveQuery`'s.

---

## 10. Cross-cutting invariants

Pulled together because each was decided in one place but binds everywhere. **These state current truth only** — where an invariant reversed, the delta lives in the ADR ledger rather than here.

1. **Every read is scoped `by_user`, and no function anywhere accepts a `userId` argument.** `requireOwner(ctx)` wraps **`getAuthUserId(ctx)`**, never `getUserIdentity().subject` (§13.2). ⚠️ **Fails silently** — see §15.5.
2. **Deletes cascade as hand-written row-side deletes inside one atomic mutation** (§3.4).
3. **Row and file die together — a dangling reference is unreachable by construction** (§4.3).
4. **The orphan sweep runs daily on a cron with a 24-hour age threshold** (§4.4).
5. **No item is ever both most-worn and least-worn** — upheld by the `floor(n/2)` cap, the `k`-sized podium, and orderings that are **exact reverses including the `_creationTime` and `_id` directions** (§9.2, §9.4). ⚠️ **Fails silently** — see §15.5.
6. **Never restart a flow; always carry state** — dead ends, failed fetches and reloads all continue to Review carrying `sourceUrl` + parsed metadata, and the draft persists blob and all (§5.5, §5.7).
7. **Actions return structured failure results, never throws** (§5.3).
8. **The app never offers a button that can't work** — the Outfits `+` hides on an empty wardrobe; the gated zero state has no create button; a Retry button is never shown for a failure retry cannot fix (§5.4, §7.5, §7.7).
9. **Wear stats are always derived, never stored** (§3.1).
10. **Image grids use `object-fit: cover`** — other values disable the downscaling that replaces thumbnails (§4.1).
11. **Zero colour literals outside `src/theme/primitives.ts`**, and **the CSS custom-property block is generated at runtime** from the token modules. Runtime generation is load-bearing: a build-time `.css` file would re-open the raw-hex guard's exclusion problem (§15.5). The PWA manifest's `theme_color` / `background_color` are generated from the same source (§14.3).

Two of these — **#1 and #5** — fail *invisibly*, with no error and no crash. They are the reason §15.5 mandates two tests by name rather than leaving coverage to the implementer's judgement.

---

## 11. Deferred — known, not forgotten

These are **deliberately deferred**, not overlooked, and not out of scope. They block nothing in v1.

- **Read-only offline caching.** v1 is online-only with an honest offline screen (§14.5). Caching reads for offline browsing is a real enhancement; queued *writes* are out of scope (§12).
- **Passkey login.** #100's explicit revisit trigger: adopt when Convex Auth ships passkey support, at which point the password in a password manager stops being the credential (§13.3).
- **A standalone Wardrobe filter** (§9.6) — the screen already takes filter + sort as params.
- **An occasion filter on the Outfits list** (§7.6) — §6.2's vocabulary query already exists.
- **App icon / branding.** A task, not a decision. Blocks no implementation — though note §14.3's manifest needs icons at install time.
- **Post-v1 schema migration conventions.** The *mechanism* is settled (Convex schema + `@convex-dev/migrations` where a backfill is needed). How the schema evolves after ship becomes real the first time a column changes against live data.

---

## 12. Out of scope

Ruled beyond this effort's destination. These return only if the foundation is redrawn — and then as new efforts, not resumptions.

- **Multi-user signup, sharing, or anything social.** The schema stays multi-tenant-ready (§3.1 rule 3), but no second user is built for.
- **Keeping the native iOS app as a live target**, and the $99/yr Apple Developer fee that would fix signing. The PWA is the answer to "app on my phone".
- **Camera capture.** File upload replaces it.
- **Full offline with queued writes**, and any local-first / SQLite-mirror architecture.
- **Migrating existing on-device data** — there is none worth keeping, which is what lets §14.6 stand prod up empty.
- **A custom domain.** A domain costs money at the registrar, and every tool must be free. The origin is a generated slug, permanently (§14.1).
- **Any tool or tier that costs money.**
- **Browser-level end-to-end tests (Playwright or equivalent)** — ruled out on **reach, not cost** (Playwright is free). Everything it catches that §15's jsdom flow tests cannot — PWA install, service worker, real Safari behaviour — is manual-verification territory anyway, since install is 100% manual with no `beforeinstallprompt` (§14.2). A CI browser would create the appearance of coverage it does not have; the mitigation is the manual smoke checklist in `docs/runbook.md`.
- **Background removal, canvas/collage builder, cost-per-wear, time-series charts, laundry status, packing/trip planning, weather or AI outfit suggestions** — carried forward from v1 unchanged.
- **Local DB backup/export.** Ruled out in v1 on on-device grounds; now simply **Convex's problem**, not a reopened question.

---

## 13. Auth & single-user access

> Owner: [#100 — Decide the auth and single-user access model](https://github.com/ShmuelAmir/wardrobe-tracker/issues/100), with research from [#90](https://github.com/ShmuelAmir/wardrobe-tracker/issues/90) and [#93](https://github.com/ShmuelAmir/wardrobe-tracker/issues/93).

**Convex Auth in password mode. No signup UI, no forgot-password link, a 365-day session.** Every choice here is unusual only because there is exactly one human.

### 13.1 Why not a hosted provider

**This reverses the Clerk lean** recorded during research. Free tiers do not discriminate (Clerk 50k MRU, Auth0 25k MAU, WorkOS 1M MAU, no traps) — **the redirect condition does**. #90 and #93 together killed OAuth-by-redirect: no primary source confirms an OAuth redirect completes in an installed standalone PWA, and the platform mechanism against it is documented. Auth0 was ruled out outright, since Universal Login is always a redirect.

With redirects gone, a single-user login form does not want a hosted UI either — which left Clerk offering a second vendor for one person. It remains the sound fallback if Convex Auth's beta status becomes a problem; the embedded email/password or passkey component, **never the social button**.

**A passphrase in an env var was rejected as *more* bespoke code, not less.** `auth.config.ts` wants a JWT, so "crude" here means hand-rolling signing.

### 13.2 `getAuthUserId`, not `.subject` — the trap that fails silently

> ⚠️ **`getUserIdentity().subject` is not the user id under Convex Auth** — it is `userId|sessionId`.

`requireOwner(ctx)` therefore wraps **`getAuthUserId(ctx)`**. Had the original design shipped, the laptop and the phone would each have written under a *different* id, and **neither device would see the other's wardrobe** — silently, with no error. This is invariant #1 and the first of §15.5's two mandated tests.

**No function anywhere accepts a `userId` argument**, every read goes through `by_user`, and there is **no hardcoded-owner pin**. That is what makes multi-user later a schema-and-signup job rather than a rewrite.

**§3.1's `userId: v.string()` stands unamended.** `v.id("users")` would buy a read this app never performs, and the string is the seam that survives swapping a beta auth provider.

### 13.3 The credential and the session

- **A password, kept in a password manager.** Magic link drags in an email vendor; **passkey is the explicit revisit trigger** (§11) when Convex Auth ships it.
- **Sessions: 365 days total, 90 days inactive** — against defaults of 30/30. A 30-day server session re-imposes a slower version of the very annoyance §14.2's ITP exemption escapes.
- **Concurrent devices are supported, not tolerated.** Laptop and phone signed in at once is the map's own stated motivation.

### 13.4 Signup exists and is dead by construction

`signUp` stays permanently — removing it would mean the account can never be recreated — but is gated on **both** an `OWNER_SIGNUP_SECRET` env var **and** a zero-existing-users check. There is **no signup UI**, and **no dev auth bypass**.

The Owner document stores nothing custom. `authTables` adds ~7 library tables beside §3.2's four.

### 13.5 The login screen is not a route

§7's whole route tree lives inside `<Authenticated>`. The attempted URL is held **in memory**, so no `?next=` pollutes §7.1's URL space.

**Shell order is `offline → install-teach → AuthLoading → Unauthenticated → Authenticated`** (§14.5 owns the first two). Offline wins because "not signed in" and "cannot reach Convex" look alike, and `AuthLoading` hangs forever when the backend is unreachable.

### 13.6 No in-app recovery

There is no forgot-password link and no recovery screen. Both recovery paths are **operator procedures**, and they live in **`docs/runbook.md`**: a CLI password reset, and clearing the `authSessions` table, which is the real answer to a remote lockout.

An undocumented recovery path is the same as no recovery path — which is why the runbook is written at spec handoff rather than at need.

---

## 14. Hosting, deploy & PWA install

> Owner: [#103 — Decide hosting, deploy target, and the PWA install surface](https://github.com/ShmuelAmir/wardrobe-tracker/issues/103), with iOS constraints from [#93](https://github.com/ShmuelAmir/wardrobe-tracker/issues/93).

**The app ships from Convex itself — one command, one vendor.**

### 14.1 Host and origin

**`@convex-dev/static-hosting`, mounted component-owned at the root.** Root mounting is safe because password-mode Convex Auth registers **no root HTTP routes** — verified against `@convex-dev/auth@0.0.94`, where `/api/auth/*` serves only OAuth redirects and magic links, both killed by §13.1, and password sign-in is an ordinary function call to `.convex.cloud`. §5.3's web-import is an **action**, not a webhook, so it registers nothing either.

**SPA fallback ships built in**, which answers §7.1's unknown-path routing with no host configuration.

**The origin is `https://acrobatic-swan-379.convex.site`, and it is permanent.**

> ⚠️ A custom domain is out of scope (§12), so this generated slug is the origin **for the app's life**. Both §14.2's ITP exemption and §13.3's session token are **origin-scoped** — changing the origin silently logs the user out and forfeits the storage exemption.

The egress objection to hosting here was dismissed on arithmetic: a ~300 kB bundle is ~3,300 cold loads against the 1 GB month, and images dominate by orders of magnitude (§2.2).

### 14.2 What an installed PWA actually gets on iOS

**The destination survives its biggest risk.** WebKit **explicitly exempts** Home Screen web apps from the 7-day ITP storage cap — its own words, restated on the living tracking-prevention page — and Safari 17 gives installed PWAs the full 60%-of-disk quota. **There is no weekly silent logout.**

Residual constraints, each of which lands somewhere concrete in this spec:

- **Open WebKit bug #272325** — session cookies reverting on iOS 17.x. Mitigation: **prefer a token in IndexedDB/localStorage over cookies**, and build a re-auth path (§13.3, §13.6).
- **Install is 100% manual** — there is no `beforeinstallprompt` on iOS. This is why §12 rules out browser E2E and why §14.3 needs a teaching surface.
- **Standalone has no back button** (§7.8, §14.4).
- **`env(safe-area-inset-*)` needs `viewport-fit=cover`** (§14.4).

### 14.3 PWA configuration

**`vite-plugin-pwa`, `generateSW`, `registerType: 'prompt'`.**

A service worker is **not** required for iOS installability, so it earns its place for exactly one reason: the offline screen (§14.5).

**The component's `UpdateBanner` is rejected** — it is actively wrong once a service worker exists, because it can say "reload" while the SW still serves the old precached shell.

**`theme_color` and `background_color` are generated from `src/theme/primitives.ts` at build time.** They are static values living *outside* `src/`, and therefore beyond the raw-hex guard's scan surface — a new hole in ADR-0013 that generation closes rather than an exception the guard tolerates (invariant #11).

### 14.4 The standalone chrome contract

Four points, contracted once here so no surface rediscovers them:

1. **Visible in-app Back is mandatory on every nested surface.** §7's "browser Back is wizard Back" is true of **history** but false of **affordance** — standalone has no button to press.
2. `viewport-fit=cover` plus `env(safe-area-inset-*)` padding on the shell.
3. No reliance on browser chrome for orientation, reload, or share.
4. Every external link (§8.1's source hostname) opens deliberately, since standalone has no address bar to reveal where it went.

### 14.5 Offline and install-teach are shell states, not routes

**Shell order: `offline → install-teach → AuthLoading → Unauthenticated → Authenticated`.**

**Offline is detected with `useConvexConnectionState()`** — verified present in 1.43.0. **`navigator.onLine` is disqualified**: it lies through captive portals.

**Install-teach comes *before* login, and this is forced by storage partitioning.** Signing in in Safari does **not** carry into the installed app — they are different storage jars. Teaching install first means the user authenticates exactly once, **in the jar where the ITP exemption actually applies** (§14.2).

- Shown **iOS Safari only**, and **not a route** — a shell state, like §13.5's login.
- Dismissed via **"Skip for now"**, whose `localStorage` flag lives in *Safari's* jar and therefore **self-clears under ITP** — so the nudge returns on its own, with no timer logic to write.

### 14.6 Deploy

**Manual `npm run deploy`.** No CI secret and no deploy key, upholding §2.1 rather than quietly reversing it (§15.6).

**Prod is stood up empty**, which is what dissolves §4.3's `imageUrl` backfill rather than scheduling it: there is no data to migrate (§12), so no URL is ever stale.

---

## 15. Testing strategy & CI

> Owner: [#104 — Decide the testing strategy for the replatformed app](https://github.com/ShmuelAmir/wardrobe-tracker/issues/104).

**The native suite's largest investment is a tier it was assumed not to have.** The real split of 44 files / ~6,350 lines is **14 pure domain (1,232 lines) / 11 DB-integration (1,990, real SQL against in-memory `better-sqlite3`) / 19 RTL component (3,129)** — so "nothing above unit level" was wrong by 3,100 lines, and the DB tier is a genuine integration tier whose own comments argue its case ("a mock can't prove SQL").

**Net: 44 files → ~13 ported + ~11 convex-test suites + 7 flow tests + 3 new guards.**

### 15.1 Runner

**Vitest, one config, two `projects`** — forced apart because `convex-test` needs `edge-runtime` and component tests need `jsdom`. **`npm test` stays one command.**

**`globals: true`, specifically so the pure ports change zero bytes** and need no re-review.

### 15.2 The pure domain tier ports unchanged

14 files, ~1,232 lines. `contrast.test.ts` ports byte-identical, and `warning` stays unasserted.

**`theme.test.ts` does not port clean** — it imports `navigationTheme`, which dies with expo-router. Its role-shape half is succeeded by §15.5's `css-vars` guard.

### 15.3 The DB tier ports rather than dies

Same method — real backend, real indexes, no mocks — with an exact analog in **`convex-test`**. Two commitments in this spec are backed mechanically by its published type surface:

- **`withIdentity` makes §13.2's authz negatives first-class.** The `getAuthUserId`-vs-`.subject` trap fails silently, with each device writing under a different id, so a test that drives two identities is the only thing that catches it.
- **`finishInProgressScheduledFunctions` makes §4.4's daily orphan cron testable.**

Only `db-client` and `schema-migrations` die outright.

### 15.4 The component tier is rebuilt, re-scoped from screens to flows

**7 flow tests replace 19 screen tests** — and the re-scope is a correction, not a reduction. The native tests were screen-shaped by a **workaround**: every one mocks `expo-router` and asserts `mockPush`, because expo-router cannot be mounted. **React Router v7 can be**, via `createMemoryRouter`.

So the tier gains reach it never had — §7.2's nested-route detail, §5.8's browser-Back-is-wizard-Back, §7.3's `?sheet=` dismissal, §5.7's draft resume. None of those is reachable by a screen test.

**Data comes from `vi.mock('convex/react')`**, which is right on the merits — §3.6 establishes there is no client cache that can disagree, so `useQuery` *is* the seam — and is also the only option, since `convex-test` has **no React transport**.

**Web-import splits across the project boundary, decided by `fs`:** the gallery test reads real HTML fixtures off disk and `edge-runtime` has no `fs`, so parser tests stay in the jsdom project (keeping the corpus as real files), and a thin `convex/webImport.test.ts` covers only §5.4's corrected failure contract.

### 15.5 Two tests are mandated by name, because they fail invisibly

Everything else in this section is a strategy; these two are **spec text**, because nothing surfaces when they are wrong.

1. **ADR-0012 leaderboard disjointness** (§9.2, invariant #5). The `_creationTime` + `_id` tiebreak must be **exactly reversed** between the two lists. Get the direction wrong and there is no error — an item simply appears on both leaderboards.
2. **A `css-vars` totality guard** (invariant #11). Every one of the 23 semantic roles must be emitted as a custom property. An unemitted role yields an **unstyled element, not an error**. This is the successor to `theme.test.ts`'s role-shape half, now that the shape has a second representation that can drift.

**The raw-hex exclusion problem does not exist**, and this is why: the token block is generated as a **runtime string** off `src/theme/*.ts`, so no `.css` file ever holds a hex. ADR-0013's widened scan surface (`src/**/*.css`) is therefore free, and the guard keeps its single-entry allowlist — but **runtime generation becomes load-bearing** (invariant #11), because a build-time `.css` would re-open all of it.

### 15.6 CI

**CI arrives — this repo has none.** One workflow: `typecheck` + `test`, and **no secrets**, since `convex-test` is in-memory and never touches a deployment. That upholds §2.1 and §14.6 rather than quietly introducing a deploy key.

**No coverage threshold**, declined explicitly.

A review-time guard nobody runs is decoration; this one runs on every push.

---

## Decision index

| § | Ticket | Governs |
|---|---|---|
| §2.1 | [88 — Provision a Convex project and wire up local dev](https://github.com/ShmuelAmir/wardrobe-tracker/issues/88) | deployments, env, plan |
| §2.2, §4.1 | [89 — Research: does Convex's free tier cover an image-heavy wardrobe?](https://github.com/ShmuelAmir/wardrobe-tracker/issues/89) | egress ceiling |
| §13.1 | [90 — Research: auth options for a single-user Convex app at zero cost](https://github.com/ShmuelAmir/wardrobe-tracker/issues/90) | provider survey |
| §3 | [91 — Research: modeling relational wardrobe data in Convex](https://github.com/ShmuelAmir/wardrobe-tracker/issues/91) | join-table shape, limits |
| §5.3 | [92 — Research: server-side web-import as a Convex action](https://github.com/ShmuelAmir/wardrobe-tracker/issues/92) | action mechanics |
| §14.2 | [93 — Research: what an installable PWA actually gets on iOS Safari](https://github.com/ShmuelAmir/wardrobe-tracker/issues/93) | ITP, install, standalone |
| §4.1, §4.2 | [94 — Research: image normalization on the web](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94) | pipeline, targets |
| §2 | [95 — Prototype: a Vite + React + Convex vertical slice](https://github.com/ShmuelAmir/wardrobe-tracker/issues/95) | stack confirmation |
| §1.1, §6, §7.4, §9.4 | [96 — Prototype: the responsive desktop and phone layouts](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96) | master–detail shell |
| §3 | [97 — Decide the Convex data model for items, outfits, and wear events](https://github.com/ShmuelAmir/wardrobe-tracker/issues/97) | schema, indexes, ordering |
| §4 | [98 — Decide the image lifecycle without a filesystem](https://github.com/ShmuelAmir/wardrobe-tracker/issues/98) | storage, deletes, sweep |
| §5.7, §5.8, §7, §8 | [99 — Decide routing and navigation for the web app](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99) | route tree, drafts |
| §13 | [100 — Decide the auth and single-user access model](https://github.com/ShmuelAmir/wardrobe-tracker/issues/100) | auth, ownership |
| ADRs | [101 — Decide the ADR supersession ledger](https://github.com/ShmuelAmir/wardrobe-tracker/issues/101) | `docs/adr/` dispositions |
| §5.4, §5.5 | [102 — Decide the web-import failure UX](https://github.com/ShmuelAmir/wardrobe-tracker/issues/102) | failure contract, fallback |
| §14 | [103 — Decide hosting, deploy target, and the PWA install surface](https://github.com/ShmuelAmir/wardrobe-tracker/issues/103) | hosting, PWA, origin |
| §15 | [104 — Decide the testing strategy for the replatformed app](https://github.com/ShmuelAmir/wardrobe-tracker/issues/104) | tiers, runner, CI |
| — | [105 — Decide the shape of the final spec deliverable](https://github.com/ShmuelAmir/wardrobe-tracker/issues/105) | this document's shape |
| — | [106 — Decide the cutover sequence from native to web](https://github.com/ShmuelAmir/wardrobe-tracker/issues/106) | build order |

**Supporting branches and directories.**

- **Research findings** are committed under `research/` — eight Markdown files, durable reference for §2.2, §5.3, §13.1 and §14.2.
- **Prototype source: throwaway, and deleted once the port lands.** Both prototypes were merged in-tree and are deleted at cutover step 15, after the port that uses them as reference. Recoverable from git:

  | Directory | Commit | Ticket |
  |---|---|---|
  | `prototype/web-slice` | `266e779` | [#95](https://github.com/ShmuelAmir/wardrobe-tracker/issues/95) |
  | `prototype/layouts` | `0d91fcb` | [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96) |

- **v1** is tagged **`spec-v1`** at commit `1cf8daf`.

## Amendment chain

This document already reflects all of these. Recorded so a reader following a ticket link is not misled by superseded text in the ticket body.

| Amendment | Effect |
|---|---|
| #95 amends #89 | `getUrl()` **does** send `cache-control: private, max-age=2592000` (undocumented, measured on 1.43.0), so warm repeat views already cost zero egress and #89's ~33-cold-load figure is a worst case, not a norm. |
| #98 corrects #89 | **The custom-HTTP-action caching lever does not exist.** A route serving `public, max-age=1y, immutable` measured `cf-cache-status: DYNAMIC` three times running — Convex's zone does not cache HTTP action responses at all, and a custom route costs *more* per miss. #89's headline recommendation is withdrawn (§2.2). |
| #97 overturns the map's Destination | **ADR-0004 survives in *both* halves**, invariant and mechanism. The Destination line claimed its mechanism dies; `@convex-dev/aggregate` was rejected instead (§3.1). |
| #97 amends #91 | Uniqueness is **not** the check-then-insert #91 predicted — it is the shape of the only write path (§3.3). |
| #102 corrects #101 | ADR-0019's rationale said the manual fallback becomes "the common path". **It does not** — measurement puts the replatform-attributable regression at one site in eleven (§5.4). |
| #103 dissolves #98's backfill | Standing prod up empty makes the `imageUrl` backfill unnecessary rather than scheduled (§14.6). |
| #103 amends #99 | "Browser Back is wizard Back" is true of **history** but false of **affordance** — standalone has no button, so visible in-app Back is mandatory (§14.4). |
| #103 amends #100 | Shell order gains `install-teach` **before** `AuthLoading`, because storage partitioning means a Safari sign-in does not carry into the installed app (§14.5). |
| #104 amends #101 | ADR-0013's widened raw-hex scan surface is **free**, because runtime token generation means no `.css` file ever holds a hex — but that generation thereby becomes load-bearing (§15.5). |
| #106 amends #105 | The prod origin is created **before** the spec is written, so §14.1 and `CONTEXT.md` carry a literal value rather than an obligation to fill one in later. |
