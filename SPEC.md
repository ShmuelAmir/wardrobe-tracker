# wardrobe-tracker — build-ready spec (v1)

A personal, on-device iOS app (Expo / React Native) to catalog your wardrobe, build outfits from your items, and see per-item usage stats.

**Status:** build-ready. Every decision here is locked. This document is assembled from the wayfinding [map](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1) and its twelve resolved decision tickets; each section cites the ticket that owns it. Where tickets amended one another, **this document states the amended result only** — the superseded text is not repeated here. See [Decision index](#decision-index) for the trail and [Amendment chain](#amendment-chain) for what changed under whom.

Nothing here is a suggestion. Where a decision has an accepted cost, the cost is recorded next to it rather than left to be rediscovered.

---

## 1. Product shape

Single-user, on-device only. No accounts, no cloud, no sync.

Three tabs: **Wardrobe**, **Outfits**, **Stats**.

- **Wardrobe** — catalog items (image, category, name, brand, season). Add via camera, photo library, or web-import from a brand product page.
- **Outfits** — build outfits from items; log "Wore this today".
- **Stats** — per-item wear counts; most/least/never worn.

The only thing a user does *daily* is log a wear. The design bends toward that: the Outfits tab leads with a one-tap log (§7.1), and Stats is a surface you read rather than act on (§9).

---

## 2. Foundation & stack

> Owner: [#2 — Research: Expo project foundation & SDK choices](https://github.com/ShmuelAmir/wardrobe-tracker/issues/2). Findings on branch `research/expo-foundation`.

| Concern | Decision |
|---|---|
| Framework | **Expo / React Native**, TypeScript |
| SDK | **Expo SDK 57** (RN 0.85–0.86, React 19.2); minimum **iOS 16.4** |
| Navigation | **Expo Router** — file-based routing, typed routes, automatic deep linking; built on React Navigation |
| Database | **expo-sqlite + Drizzle ORM** |
| Migrations | drizzle-kit generates SQL, bundled via metro `sql` sourceExt + babel `inline-import`, applied on-device at startup with the `useMigrations` hook |
| Images on disk | expo-file-system |
| State management | **None.** SQLite is the source of truth; Drizzle `useLiveQuery` + React state/Context suffices. Add Zustand later only if a real need appears |

**Project structure:** `db/schema.ts` + `db/client.ts` + a generated `drizzle/` folder.

**Expo Go vs dev build.** expo-image-picker, expo-file-system and expo-sqlite all run in Expo Go, so early work is unblocked. But config-plugin settings (iOS permission strings in particular) need a **custom dev build** (`expo-dev-client`). This app needs proper permission strings, so **plan to move to a dev build early** rather than treating Expo Go as the target.

> ⚠️ **Verify at scaffold time.** SDK versions churned three times within 2026 (55→56→57). Re-verify the latest SDK and a stable Drizzle-Expo install channel when scaffolding. The iOS 16.4 minimum is quoted from the Expo FAQ; Podfile specifics came from a search summary, not first-hand.

---

## 3. Data model

> Owner: [#4 — Finalize data model & Drizzle schema](https://github.com/ShmuelAmir/wardrobe-tracker/issues/4), as amended by [#10](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10).

Four tables: `item`, `outfit`, `outfit_item` (join), `wear_event`.

### 3.1 Rules

1. **Category** — fixed 6-value enum stored as `text`, validated against a TS `CATEGORIES` const. **No SQLite `CHECK` constraint**, so values stay cheap to add by migration. Values: `Top, Bottom, Outerwear, Footwear, Accessory, Bag`.
2. **Season** — four base values (`spring, summer, fall, winter`). **No explicit "All-season"**: year-round means all four selected. Optional multi-select, stored as a **JSON array** in a nullable `season` column. **Items only — outfits have no season** (§6.3).
3. **Color** — **dropped for v1.** No color field on `item`. Migrates cleanly to a field or tag table later if ever wanted.
4. **Wear stats are derived, never stored.** No `wear_count` / `last_worn` columns. Aggregated on read via `item → outfit_item → wear_event`, re-run reactively with `useLiveQuery`. Wear count is **per wear-event**: wearing two outfits that share an item on the same day counts **twice**. This is intended.
5. **Deletes hard-cascade, with foreign keys enforced.** Both directions:
   - Delete an **item** → its `outfit_item` rows cascade. Outfits **survive minus that garment**; wear history (which hangs off the outfit) is **untouched**.
   - Delete an **outfit** → its `outfit_item` **and** `wear_event` rows cascade.
   - The UI confirms with the concrete impact before any hard delete (§8.3).
6. **Wear date** — `wear_event.worn_on` is `text`, `YYYY-MM-DD` (day-granular; backfilled via date picker). Creation timestamps are unix-ms integers.
7. **`outfit_item`** — composite PK `(outfit_id, item_id)`: an item appears at most once per outfit.

> ⚠️ **`PRAGMA foreign_keys = ON` on every connection.** expo-sqlite defaults it **OFF**, and without it none of the cascades in rule 5 fire. This is load-bearing for the whole delete story.

### 3.2 Schema (`db/schema.ts`)

```ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const CATEGORIES = ["Top", "Bottom", "Outerwear", "Footwear", "Accessory", "Bag"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const item = sqliteTable("item", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageFile: text("image_file").notNull(),          // bare filename, e.g. "a3f2c1de.jpg"
  category: text("category").$type<Category>().notNull(),
  name: text("name"),
  brand: text("brand"),
  season: text("season", { mode: "json" }).$type<Season[]>(),   // e.g. ["winter","fall"]
  sourceUrl: text("source_url"),                    // auto-set on web import
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const outfit = sqliteTable("outfit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  occasion: text("occasion"),                        // free text, single value
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const outfitItem = sqliteTable("outfit_item", {
  outfitId: integer("outfit_id").notNull().references(() => outfit.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => item.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.outfitId, t.itemId] }) }));

export const wearEvent = sqliteTable("wear_event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  outfitId: integer("outfit_id").notNull().references(() => outfit.id, { onDelete: "cascade" }),
  wornOn: text("worn_on").notNull(),                 // "YYYY-MM-DD"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
```

**`image_file` holds a bare filename, not a path** — see §4.2 for why. Resolve at read time:

```ts
Paths.join(Paths.document, "items", item.imageFile)
```

### 3.3 Per-item stats query

```sql
SELECT oi.item_id,
       COUNT(*)          AS wear_count,   -- per wear-event
       MAX(we.worn_on)   AS last_worn
FROM outfit_item oi
JOIN wear_event we ON we.outfit_id = oi.outfit_id
GROUP BY oi.item_id;
```

---

## 4. Image storage

> Owner: [#10 — Spec image storage: on-disk layout, download & thumbnails](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10).

### 4.1 One normalized file per item, no originals, no thumbnails

**Normalize at save: 1600px longest edge, JPEG quality 0.8.** A 12MP camera original (4032×3024, ~4MB) against a 200-item wardrobe is **~800MB on disk**, feeding an app whose largest render is a ~400pt detail image (~1200px @3x). Capped: **~60MB @200 items**.

This is **near a no-op on the primary path** — web-import product images are typically already 1000–1600px and pass through unresized. It is really the camera path being brought in line with what web-import already gives.

**No thumbnails.** expo-image's `allowDownscaling` defaults to `true`, and expo-image is SDWebImage on iOS, which downsamples **at decode** and never materializes the full bitmap; its memory cache then holds the decoded, downscaled result, so only a tile's first render pays. Against a ~300KB/1600px file feeding a 120pt cell, a stored thumbnail buys almost nothing while doubling the files to name, move and delete — and adds a second way for the two to disagree.

> ⚠️ **Implementation constraint: image grids must not use `contentFit: 'none'` or `'fill'`** — downscaling is disabled for both. Use `cover`.

**Accepted cost:** the true original is gone. Re-cropping or background removal would only ever have 1600px to work with. Both are out of scope (§12), and that's better revisited than carrying 800MB against a maybe.

### 4.2 Layout & naming

One flat directory, `Paths.document/items/`, created with `{ intermediates: true }` on first use. One file per item. No subdirectories, no thumbnail dir.

**Filename is `<uuid>.jpg`** — `expo-crypto`'s `randomUUID()`, generated **at capture, before the row exists**.

- *Why not rename-after-insert:* it welds the filesystem to the DB transaction — insert a placeholder, read back the id, rename, `UPDATE`. Two writes, a window where the row points at nothing, and a real failure mode if the app dies between them. A UUID is known **first**, so save is a single insert carrying its final path, and the ordering is trivial: write file → insert row → delete file if the insert throws.
- *Why not `item.id`:* `12.jpg` is only safe while no future item is ever id 12 again — true today (Drizzle's `autoIncrement: true` emits `AUTOINCREMENT`, preventing rowid reuse), but it makes file naming depend on a schema detail that has nothing to do with files.
- **Accepted cost:** UUID filenames are opaque in a debugger. Orphans are found by query, not by reading filenames.

**The DB stores the bare filename** (`a3f2c1de.jpg`) — not a path, never absolute.

- *Absolute is not an option:* per Apple's [TN2406](https://developer.apple.com/library/archive/technotes/tn2406/_index.html) the app container path can change across updates and reinstalls, so a stored `file:///var/mobile/Containers/…` rots.
- *Bare filename over relative subpath (`items/a3f2c1de.jpg`):* the difference only shows up when the layout changes. Bare — the directory is **one constant in code**, so reorganizing is a one-line edit and no data moves. Subpath — the layout is baked into every row, so the same reorganization becomes an `UPDATE` across the table: a data migration to fix what is really a code concern. The subpath buys per-row directory flexibility this app will never want.
- Extension stays in the name so format is readable without sniffing.

### 4.3 One pipeline, three sources

> **Invariant — by the time the user reaches Review, regardless of source: a local file exists in the cache dir under our UUID name.**

- **Web import:** downloaded at **"Use this image"** (wizard step 3 → 4) — **not** at Save. See §5.4.
- **Camera / library:** expo-image-picker already returns a cache-dir URI (`.../cache/cropped1814158652.jpg`).

### 4.4 Save — identical for every source, no network

1. `manipulate(cacheFile)` → resize **only if** `max(w, h) > 1600` → `saveAsync({ format: JPEG, compress: 0.8 })`
2. Move that output → `document/items/<uuid>.jpg`
3. Insert row; if the insert throws, delete the file

```ts
// cap the LONGEST edge; never upscale
const longest = Math.max(width, height);
const ctx = ImageManipulator.manipulate(cacheUri);
if (longest > 1600) {
  ctx.resize(width >= height ? { width: 1600 } : { height: 1600 });
}
const out = await (await ctx.renderAsync()).saveAsync({
  format: SaveFormat.JPEG,
  compress: 0.8,
});
new File(out.uri).move(new File(Paths.document, "items", `${uuid}.jpg`));
```

`saveAsync()` writes to the **cache** dir, which slots straight into this pipeline — its output is what gets moved. The raw download stays in cache and the OS reclaims it.

**Never upscale.** Resize only when the longest edge exceeds 1600, and pick the axis by orientation so it's the longest edge that's capped. An 800px product image is stored untouched.

### 4.5 Deletes — row first, then file

§3.1's cascade is a **SQL** cascade: it deletes rows. SQLite knows nothing about files, so **nothing in the schema will ever remove an image.** App code must.

**Order: row first (cascade runs), then the file** — best-effort. A failed unlink is swallowed and left to the sweep; it must never block or roll back a delete the user asked for.

The failure modes aren't symmetric, and that decides it:

| Killed mid-delete | Result | Cost |
|---|---|---|
| **Row first** | file with no row | invisible, ~300KB, sweepable |
| **File first** | row → missing file | broken tile, on an item the user **didn't** delete, unfixable in-app |

> **Principle: always fail toward an orphan, never toward a dangling reference.**

**Scope:** an item delete removes its one file. **An outfit delete removes none** — outfits own no images, they only reference items, so their cascade (`outfit_item` + `wear_event`) is pure rows.

### 4.6 Orphan reconciliation — a startup-only sweep

List `document/items`, diff against `SELECT image_file FROM item`, unlink strays, silently (log, never surface).

> ⚠️ **The timing is the load-bearing part.** Save is "move file → insert row", so there is a real window where a legitimate file is on disk with no row yet — a concurrent sweep would delete it out from under an in-flight save. Pinning the sweep to **startup only** — once, after `useMigrations` resolves, before the UI can open the wizard — rules that race out **by construction** rather than by locking. **Never on a timer, never in the background.**

Cheap (one dir listing + one column query, ~200 rows), and it catches both orphan sources: interrupted deletes, and a save killed between move and insert.

**Mirror case** (a row whose file is missing) shouldn't occur once the above holds, but the grid degrades quietly anyway: **render a category placeholder, never a broken tile.**

---

## 5. Add-item wizard

> Owner: [#5 — Prototype: add-item flow](https://github.com/ShmuelAmir/wardrobe-tracker/issues/5) ([prototype](https://claude.ai/code/artifact/1307ea39-7bcc-4904-8996-443e68f85889)), with error states from [#9](https://github.com/ShmuelAmir/wardrobe-tracker/issues/9), disk behavior from [#10](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10), permission denial from [#13](https://github.com/ShmuelAmir/wardrobe-tracker/issues/13), and edit mode from [#14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14).

A **guided wizard** — one decision per full screen, always-forward with a per-step Back. Chosen over a single bottom-sheet and an image-first variant for clarity on the primary web-import path; the extra taps are an acceptable trade for a flow that can't leave you lost.

### 5.1 Canonical web-import path (primary)

1. **Pick a source** — full-screen list: *Import from web* (highlighted as primary), *Take a photo*, *Choose from library*.
2. **Paste link** — a single URL field + **Fetch**. Nothing else on the screen.
3. **Confirm image** — large preview; **auto-pick the best candidate (`og:image`)** with a thumbnail row to **swap** among other images found on the page. Plus a **"None of these — use a photo instead"** bail-out (§5.3).
4. **Review & fill** — its own screen (§5.5).
5. **Saved** — confirmation → back to the wardrobe, with an **Add another** shortcut. *(Create mode only.)*

### 5.2 Camera / library paths

The same wizard; steps 2–3 are replaced by capture-or-select + a confirm-photo screen. Steps 4–5 are identical. **No name/brand pre-fill** on these paths — there's no page metadata to read.

### 5.3 Web-import: fetch, parse, and the two failure states

**How the import works** (per [#3 — Research: web image import](https://github.com/ShmuelAmir/wardrobe-tracker/issues/3), findings on branch `research/web-image-import`):

> **Key finding: RN's `fetch` does not enforce CORS** — native apps have no CORS — so brand pages can be fetched directly. **No proxy, no backend.**

Fetch the page HTML with native `fetch`, parse for an image: `og:image` → `twitter:image` → JSON-LD → largest `<img>`. `og:image` is present on most SSR retail pages. Reliability is site-dependent (client-rendered SPAs and anti-bot 403s can fail), which is exactly why the manual fallback is **mandatory**, not a nicety.

**Only two of the plausible failure cases are actually error states.** Offline collapses into the retryable error. Partial metadata is a silent no-op on optional fields. And **a non-product URL doesn't fail at all** — a homepage has an `og:image` (its hero banner), so it returns 200, parses cleanly, and hands back a confidently wrong image. **That case is guarded by confirmation, not validation** (step 3 is the validation).

The two states **split on the user's next action** — not on what went wrong. The user can't act on our diagnosis, only on what's available next.

| Outcome | State | Copy | Actions |
|---|---|---|---|
| Offline (pre-flight) | Retryable | "You're offline. Reconnect and try again." | **Retry** |
| Timeout (10s), network failure, 5xx, 429 | Retryable | "Couldn't reach that page. Check your connection." | **Retry** |
| 403 / 401, 404, 200-with-no-usable-image | Dead-end | "Couldn't get an image from that page." | **Take a photo** / **Choose from library** |

`5xx`, `429` and `404` are derived from the rule *"would trying again plausibly help?"* rather than decided case-by-case.

**403 is deliberately a dead-end, with an escape hatch.** The likely 403 is anti-bot rejecting a non-browser request — permanent for our parser however many times you tap Retry. But it's also where the user is most sure we're wrong, since the same link opens fine in Safari. So: **no Retry button, but the URL field stays populated and editable and Fetch stays live.** Re-fetching is always physically possible, just not promoted. **The classification biases the UI; it never locks anyone out.**

**Nothing is thrown away.** Both routes to the fallback — the dead-end state, and step 3's "None of these" — **continue to step 4 (Review)** with a captured/picked image. They do **not** restart the wizard. Carried forward:

- **`source_url`** — always. The user typed it; it's a true fact about the item regardless of whether we could read an image off it.
- **Name / brand** — whenever the parse actually returned them. Real on the **no-image dead end** (a 200 we parsed, with `og:title` but no usable `og:image`); never on the network-failure path, where there's no page to have parsed.

**URL validation is `http(s)` syntax only** — just enough to enable Fetch. We do **not** try to detect "is this a product page": `/collections/coats/wool-overcoat` and `/collections/coats` differ by nothing a regex should judge, and any rule sharp enough to reject a homepage will eventually reject a real product page and lock the user out of the primary path.

**`source_url` stores the resolved URL.** RN `fetch` follows redirects automatically, so shortened links import fine and need no error state. Store **`Response.url`** (the final URL after redirects) so `source_url` is the durable product page, not a shortener that rots. Fall back to the pasted string when no fetch ever succeeded.

**Name/brand pre-fill — blank beats junk.** `og:title` is rarely a clean product name (`Wool Overcoat | Acme — Free Shipping Over $50`). Pasting it raw taxes the user with a hand-edit on **every successful import** — the primary path. Light cleanup, no cleverness:

1. Split `og:title` on `|`, `–`, `—`.
2. Drop any segment matching `og:site_name`.
3. First survivor → **Name**. `og:site_name` → **Brand**.
4. Nothing survives → leave **blank**.

Missing metadata needs no error and no warning: name/brand are optional, so Review just renders empty fields. Every field stays editable, so a bad guess costs one tap.

**In-flight state (step 2).** "Fetch" is **fetch HTML + parse only**.

- **No dedicated loading screen** — a full-screen spinner that flashes for 800ms and pops fights the always-forward wizard. Stay on step 2: spinner inline in the Fetch button, URL field disabled.
- **10s timeout** via `AbortSignal` → retryable error. Long enough for a slow retail page on cellular, short enough that nobody thinks the app hung.
- **Cancel** aborts with the same signal and restores the editable field.
- **Offline pre-flight:** `Network.getNetworkStateAsync()` (expo-network) at Fetch time. No connectivity → fire the retryable error immediately, skipping the timeout. **Step 1 never greys out "Import from web"** — connectivity detection lies (captive portals), and it's a request-time fact that would go stale between step 1 and step 2.

### 5.4 The image downloads at step 3, not at Save

When the user taps **"Use this image"** (step 3 → 4), the image downloads into the **cache** dir under its UUID name.

*Why not at Save:* downloading at Save hides a network round-trip behind the one button the user reads as instant and local, and it can fail **after** the Review form is filled. `image_file` is `notNull`, so there is no "save without the image and fix it later" escape — the only honest response is an error on the final screen, the worst place in the flow to discover the network is gone.

At step 3 the failure is cheap: nothing is invested yet, and Retry is natural. **It adds no new error state** — a failed download drops into the **"None of these — use a photo instead"** branch already specified in §5.3, carrying `source_url` + any parsed name/brand to Review exactly as the dead-end route does. Spinner inline on the button, per the Fetch pattern.

The download lands in **cache**, so the document dir still only receives bytes at Save: an abandoned wizard leaves nothing behind that the OS won't reclaim, and §4.6's startup sweep catches the rest.

Download mechanics: expo-file-system `File.downloadFileAsync(url, dest, { headers, onProgress, signal })` (SDK 54+). Download is format-agnostic; only WebP/AVIF **display** is a caveat (transcode to JPEG if needed — §4.4 already re-encodes to JPEG at save).

> ⚠️ Verify exact `downloadFileAsync` option names against the installed SDK at build time.

### 5.5 Step 4 — Review & fill, in two modes

The same screen, two entry points:

- **Create** (the wizard): reached from step 3, pre-filled from page metadata, commits a new row. Continues to step 5.
- **Edit** (per §8.2): reached from an existing item's detail screen, pre-filled from the row, commits an update. Returns to the item's detail screen.

**Category is the only required field** in both modes (chip picker, the fixed 6-value list). Name and Brand are text; Season is multi-select chips; Source URL is auto-filled on the web-import path.

The field set, the chip picker, and the required/optional split are **identical in both modes** — that is precisely why §8 reuses this screen rather than designing a separate editor. Three differences only:

1. **Nav bar** — the wizard's always-forward Back becomes **`Cancel` / `Save`**. Edit is not a step in a flow, so it commits or abandons; there is nothing after it.
2. **A `Delete Item` row at the bottom, in Edit mode only.** Delete has no home on the create path (there's nothing to delete yet).
3. **No pre-fill from page metadata** in Edit mode — values come from the row. `source_url` is **preserved, not re-derived**.

**Replace-photo** lives here (Edit mode), not on the read-only detail page. It runs §4's pipeline: cache-dir file → manipulate → move → insert.

### 5.6 Camera / photo-library permission denial

The camera tile in the source step is **replaced in place** by a card stating the reason, with a **"Turn it on in Settings →"** deep link. **The other two sources stay live beside it. The step never changes and the flow never restarts.**

This follows §5.3's precedent directly: the dead-end case drops the retry but **continues carrying state**, offering the other sources rather than blowing up the wizard. A full-screen takeover was rejected for contradicting exactly that — **permission denial is one source going quiet, not a dead end for the whole flow.**

The same treatment covers **photo-library** denial. Only the web-import source can never be permission-blocked.

> On a *first* denial iOS fires its own alert; that alert is the OS's, not ours. **Our design starts the moment it's dismissed.**

---

## 6. Outfit builder

> Owner: [#6 — Prototype: outfit builder](https://github.com/ShmuelAmir/wardrobe-tracker/issues/6) ([prototype](https://claude.ai/code/artifact/364fad40-312e-4a48-9b7d-f023f6fd1331)), as amended by [#12](https://github.com/ShmuelAmir/wardrobe-tracker/issues/12) (no season) and completed by [#14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14).

A **sectioned checklist**. Chosen over a persistent-tray variant and a canvas + picker-sheet variant because it matches how outfits are actually reasoned about — *what top, what bottom, what shoes* — and keeps browse + select on one screen with no modal.

**No fixed slots** — many items per category are allowed (many-to-many), consistent with §3.

### 6.1 Builder screen

1. **Sectioned scroll** — one section per category (Top → Bottom → Outerwear → Footwear → Accessory → Bag), each a **horizontal rail**. Selected items get an accent ring + check and **reorder to the front of their rail**.
2. **Browsing at scale** — rails are the default; each category header carries a **"See all →"** that expands *that one category* into a full **vertical grid** sub-screen. Rails stay lightweight; the grid is on-demand for 100+ item wardrobes. **No global search in v1.**
3. **Sticky summary bar** — mini-stack of the first few picks, "*N items selected*", a name field, and **Save**. **Save is disabled until ≥1 item is selected.**
4. **Occasion tagging happens at Save** — tapping Save opens a small **review sheet** (name + occasion) to confirm before it commits. Keeps the build screen uncluttered; one confirm step.
5. **After Save → the new outfit's Detail screen** (not back to the Outfits list).

### 6.2 Occasion — free text, single value, chips that build themselves

`outfit.occasion` is **single-value free text** (§3.2). The chips are real, but the **vocabulary is not a fixed enum — it is built from the user's own history**:

```sql
SELECT occasion, COUNT(*) AS c
  FROM outfit
 WHERE occasion IS NOT NULL
 GROUP BY occasion COLLATE NOCASE
 ORDER BY c DESC, occasion ASC
 LIMIT 8;
```

- **Single value, not multi.** Chips act as **radio buttons**: tapping one replaces the current pick; **tapping the active chip clears it** (occasion is optional). Filtering is a plain `WHERE occasion = ?`. Want "work formal"? Type it — it becomes its own chip. The vocabulary absorbs compound cases with no schema change.
- **A fixed enum was rejected.** Garment categories are universal (every top is a `Top`), which is why §3's enum works. **Occasions are personal** — "shul", "school run", "gigs". Any list shipped in code is wrong for someone, and there is exactly one user.
- **Ordering: most-used first, tiebreak alphabetical, capped at 8.** Habitual occasions stay in thumb reach; the long tail stays typeable. The cap keeps the Save sheet from becoming a wall of chips at outfit #200. A one-off "Wedding" sinks out of the list — **by design**.

**Normalization on save is required — the chip UI depends on it.** Trim and collapse whitespace, then match the typed value **case-insensitively** against existing occasions. On a hit, store the **existing** spelling; otherwise store as typed.

```
input       existing     stored
"  work "   ["Work"]  →  "Work"    (reused)
"WORK"      ["Work"]  →  "Work"    (reused)
"Shul"      ["Work"]  →  "Shul"    (new, as typed)
```

```sql
SELECT occasion FROM outfit
 WHERE occasion COLLATE NOCASE = ?
 LIMIT 1;
```

**First spelling wins and becomes canonical.** Store display casing, match case-insensitively. Forcing a canonical case was rejected — it mangles `NYE` → `Nye`. Without this rule, `work`/`Work` splinter into two chips and the chip UI hands you the exact problem it was chosen to prevent.

**No seeding.** A fresh install has zero outfits, therefore **zero chips**. Outfit #1's Save sheet is a bare optional text field; chips accrete from outfit #2 onward. Seeding starter chips (`Work`, `Casual`, `Formal`) would smuggle back through the side door exactly the invented vocabulary rejected above.

**Accepted v1 consequences:**
- **The vocabulary is self-cleaning.** Chips derive from live outfits, so deleting the last outfit tagged "Gym" retires the "Gym" chip. This follows necessarily and is correct.
- **No cross-outfit rename.** Fixing a typo ("Wrok" → "Work") means editing each outfit that uses it. Normalization prevents the common case (casing drift), the chip list makes tapping the default over typing, and a single user with a typo'd chip has a visible, self-inflicted, low-frequency problem. Not worth a vocabulary-management surface in v1.

### 6.3 Outfits have no season

Season chips are **not** on the Save review sheet; season tags are **not** in the Detail header. `occasion` carries outfit tagging alone.

**Season is a property of a garment, not of a look.** Items already carry it, and in v1 nothing consumes an outfit season — Stats filters by category only (§9), and there is no Outfits-list filter (§7.4).

**Deriving it was rejected on the data, not on taste.** §3's "wear stats are derived, never stored" looks like a precedent, but the operator doesn't survive contact with ordinary wardrobes:

| outfit | items | union | intersection |
|---|---|---|---|
| summer tee + fall jacket + jeans (`null`) | `[summer]`, `[fall]`, `null` | `[summer, fall]` | `[]` |

Mixed-season outfits are **normal**, and `item.season` is **nullable** — so union *and* intersection both return garbage on everyday data. Derived wear-stats work because `wear_event` rows are unambiguous; seasons are not.

---

## 7. Navigation, entry points & first-run

> Owner: [#13 — Prototype: navigation, entry points & first-run](https://github.com/ShmuelAmir/wardrobe-tracker/issues/13) ([prototype](https://claude.ai/code/artifact/d913e3f0-17a3-4a58-bbfe-758d6acfadc6)).

Three tabs: Wardrobe, Outfits, Stats.

**The Outfits tab is something you act from, not an archive you add to.** This **deliberately breaks the symmetry with §9**, which settles Stats as "a leaderboard you read". Stats and Outfits are now different kinds of surface — **Stats is read, Outfits is acted from** — and that asymmetry is the decision, not an oversight. The justification is traffic: **logging a wear is the only thing in this app you do daily**, and §6 had buried it one navigation deep.

### 7.1 "Wear again" rail — logs directly, in place

A horizontal rail at the top of the Outfits tab: the **5 most recently worn outfits**, each card carrying a **"Wore it"** button that writes a wear-event for **today** with **no navigation**. Confirms in place (`✓ Worn today`).

- **Rail scope is `wears ≥ 1`** — it's "wear *again*". A never-worn outfit has no "again", so it never appears.
- **If no outfit has ever been worn, the rail section doesn't render** — no empty scaffold (same principle as §6.2's no-seeding).
- The rail is a **strict subset** of Detail's capability — **one tap, today only** — deliberately, because it's the fast path for the common case.

**v1 therefore has two wear-logging surfaces** (this rail and §8.4's Detail screen). Accepted. The rail cannot backfill and cannot reach a past date; anything other than "I'm wearing this today" goes through Detail. Both carry the same Undo (§8.5).

### 7.2 "All outfits" list

Large cover cards below the rail.

**Sort: `last_worn DESC NULLS LAST`.** Strict last-worn ordering — **every** never-worn outfit collects at the bottom regardless of created date.

`COALESCE(last_worn, created)` was considered and **rejected**. Never-worn is an edge case: you build an outfit when you intend to wear it, and immediately mark it worn. §6.1 lands Save on the new outfit's **Detail** screen, where "Wore this today" is the primary button — so a just-built outfit typically acquires a `last_worn` of today **within seconds of existing** and lifts itself to the top before the list is ever seen again. The never-worn bucket is therefore *aspirational* outfits (the Summer Wedding case), and **sinking those is correct, not a bug.** It also keeps the list's ordering identical to the rail's, which is the sort the user already understands.

### 7.3 Add affordance — nav-bar `+`, contextual per tab

A small `+` in the **top-right nav bar**. **Contextual**, not global: on Wardrobe it opens the add-item wizard (§5), on Outfits it opens the builder (§6). **No FAB, no global add.**

- *A FAB was rejected:* a 58pt accent circle bottom-right permanently shouts "create" on a tab whose primary job is now logging — it would compete with the rail.
- *A global `+` was rejected:* one affordance that can be pressed on any tab must then carry a disabled state explaining itself.

**The `+` is hidden on Outfits when the wardrobe is empty.** Nothing to build from, so no affordance. **The app never offers a button that can't work.**

### 7.4 No occasion filter on the Outfits list in v1

§6.2's self-building vocabulary stays **Save-sheet-only**, exactly the scope it was given. This parallels §9.6's ruling against a standalone Wardrobe filter — same argument, same answer: the surface it would filter isn't big enough in v1 to earn it, and it's cheap to add later (**the vocabulary query already exists**). This is a known v2 ask.

### 7.5 Zero states carry onboarding — there is no onboarding

**No separate onboarding flow, no tour, no cards.** Three zero states do the work:

| State | Treatment |
|---|---|
| **Wardrobe, 0 items** (the literal first screen of the app) | **Full-bleed hero** — gradient ground, no nav bar, big primary **"Add your first item"**. Copy leads with the **product-link** path, since §5 made it the highest-quality source. **The only place in the app that gets a hero.** |
| **Outfits, 0 items** (the precondition) | **Gated state** — "Your wardrobe comes first", explains that an outfit *is* items worn together, and offers **"Go to Wardrobe"**. **No create button**, and the nav-bar `+` is hidden. Reads as information, not failure. |
| **Outfits, items but 0 outfits** | **Ordinary empty** — "Build your first outfit" + **"New outfit"**. The `+` is present. |

The two Outfits empties are **different screens**, not one message with a swapped verb.

---

## 8. Item & outfit detail

> Owner: [#14 — Prototype: item & outfit detail](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14) ([prototype](https://claude.ai/code/artifact/3ab8aedf-7912-4757-ac29-b8902af8a3fb)).

**An item is a place you go, and an edit is a deliberate mode.** Tapping a Wardrobe grid cell **does** open a detail screen. Rejected: a page that *is* the editor (autosave, no mode), and a bottom-sheet inspector over the grid with no item page at all.

This wins on **reuse**: §5.5's Review step already renders exactly these fields, and §6's builder already edits an item set. **It adds no new surfaces — it gives the two that exist a second entry point.**

### 8.1 Item detail — read-only page

Reached by tapping a Wardrobe grid cell. Nav bar: `‹ Wardrobe` · category as title · **Edit**.

- **Hero image**, then name + brand.
- **Stats strip, three cells:** wear count · days since last worn · **outfits count**. All derived per §3, no stored counters.
- **Fields:** Category, Season (`Any season` when null), Added. **Source renders only when `source_url` is set** — the hostname, linking out. It's the only field that leaves the app, and only web-imported items have one.
- **"In outfits" rail** — the outfits containing this item, each tapping through to its detail. When empty: *"Not in any outfit yet — that's why it has never been worn."* — which **explains** a zero wear count instead of just showing it.
- **No delete on this screen.** The read path is safe to browse.

### 8.2 Item edit

`Edit` pushes §5.5's Review screen in Edit mode: `Cancel` / **Save** in the nav bar, same controls, no metadata pre-fill, **`Delete Item` at the bottom** (the iOS Contacts pattern) — reachable but never on the read path.

### 8.3 Delete confirms — the asymmetry is real, and the copy says so

§3 requires a confirmation surfacing impact (N outfits / N wears). Concretely — **and this inverts the intuition**:

- **Deleting an item is nearly harmless.** Outfits survive minus the garment; wear history is untouched.
  > *"Used in 4 outfits — Weekday default, Smart evening +2 more. They'll keep their other items, and your wear history won't change."*
  Not in any outfit: *"Nothing else changes."*
- **Deleting an outfit is what destroys history.** Its `wear_event` rows cascade.
  > *"Its 12 wears will be deleted too, so the wear counts on its 4 items will drop. The items themselves stay in your wardrobe."*

**The confirms deliberately do not feel equally scary.** The item confirm reassures; the outfit confirm warns. This is honest to the schema, and it was verified live in the prototype: deleting "Weekday default" drops the Oxford Shirt from **20 wears to 8**.

### 8.4 An outfit can outlive all its garments — the last-item confirm

Nothing prevents deleting every item in an outfit, leaving a **0-item outfit whose wears still count**. **Decision: support the state, and offer to clean it up.**

When the item being deleted is the **last garment in one or more outfits**, the confirm gains a **third outcome**:

> This is the last item in an outfit — "Weekday default".
> Keep it and it'll have no garments left, but its 12 wears keep counting.
> Delete it too and those 12 wears disappear from your stats.
>
> `Delete item only` · `Delete item + outfit` · `Cancel`

- **The offer is never silent about the wear cost.** Losing wear history is the one thing an item delete otherwise never does, so it must be **named**, not slipped in as tidying.
- **Prevention was rejected:** blocking the delete means an item you own can't be removed because of an outfit you forgot about. Auto-deleting destroys history with no confirm.
- The zero-item outfit remains a **legal, labelled state** — `Every item in this outfit was deleted — its 12 wears still count toward your stats` — because **those wears really did happen**. `Delete item only` is the default; cleanup is opt-in.
- Copy is singular/plural correct for the multi-outfit case (`Delete item + 2 outfits`).

### 8.5 Outfit detail & wear logging

- **Header** — name, item count, created date, **occasion tag** (no season, per §6.3).
- **Stats strip** — times worn / last worn / first worn.
- **Item grid.**
- **Wear logging** — **"Wore this today"** is the big primary action; a secondary **"Other day"** opens a **calendar for past-date backfill** (**future dates disabled**). One `wear_event` per log.
- **Edit item set** — `Edit` in the nav bar **re-enters §6's sectioned-checklist builder**, pre-selected. Save opens **§6's own review sheet** (name + occasion), so **tags are edited exactly where they're created** — no second tag-editing surface.
- **Delete outfit** — bottom of the builder, mirroring the item rule: **delete lives at the bottom of Edit.**

**Un-logging a wear — two paths, two time horizons:**

1. **`Undo` on the toast — every wear log shows one**, from both surfaces: §7.1's rail ("Wore it") and Detail's "Wore this today" / "Other day". It deletes the `wear_event` row just written, and **expires with the toast**. This is the mis-tap, rescued **in place, where the action happened** — it always means "that last tap, undo it", and on the rail it is the *only* affordance in reach.
2. **The wear history sheet — the durable path.** The stats strip's **wears cell is tappable** (`12 · wears ›`) and opens a sheet: one row per `wear_event`, dated, each with `Remove`. This is for *"I logged Tuesday by mistake"*, which a toast can never reach because it's long expired.

**Undo goes on both log surfaces, not just the rail.** A toast that carries Undo from a list but not from Detail would make the same gesture mean two different things depending on where you stood — and the toast is one component. §6.1 already specified a toast at Detail; it gains a button, not a new surface.

**Wear history is outfit-level only.** A wear belongs to an outfit (§3), so item detail links to outfits and **never offers to un-log** — un-logging from an item would be ambiguous about which outfit's event dies.

> Un-logging an outfit's *only* wear removes it from §7.1's rail entirely (`wears ≥ 1`). That's a visible consequence the undo has to not feel broken about.

---

## 9. Stats

> Owners: [#7 — Stats computation spec](https://github.com/ShmuelAmir/wardrobe-tracker/issues/7) (definitions, ordering, sizing, queries) and [#11 — Prototype: Stats screen & Wardrobe sort/filter surface](https://github.com/ShmuelAmir/wardrobe-tracker/issues/11) (presentation) ([prototype](https://claude.ai/code/artifact/b039f4ac-55b1-4075-ab8b-51f98f814a04)).

**Stats is a leaderboard you read**, not a to-do list you act on. (§7 deliberately breaks this symmetry for Outfits.)

**Stats v1 is two views and a global filter, not three views.**

### 9.1 "Wears by category" is a filter, not a metric

**There is no category-level aggregate in Stats v1** — no per-category total, no average wears per item, no grouping. The need it served ("which pants do I wear most?") is a *per-item* question asked *within* a category, so it's answered by **scoping the leaderboards** instead.

A **global category filter** sits at the top of the Stats tab:
- Values: `All` (default) + the six `CATEGORIES`.
- It **re-scopes both lists at once**. One control, one state.
- This also settles never-worn's scoping — same control, no separate rule.

*Rejected:* item-wears grouped by category (coherent, but the ordering is near-constant — Footwear ≈ total outfit-wears because every outfit has shoes, so it tells you nothing) and average-wears-per-item (informative, but answers a "which category is dead weight" question that isn't a v1 need).

### 9.2 Most worn / least worn

Same underlying set — **items with at least one wear** — sorted opposite ways.

**Never-worn items are excluded from least-worn.** They're a separate view, because "never worn" and "worn rarely" prompt different actions (*get rid of it* vs. *wear it more*), and a wall of zeros would drown out the once-worn coat that's the interesting case.

**Ordering:**
- Most worn: `wear_count DESC, last_worn DESC, id DESC`
- Least worn: `wear_count ASC, last_worn ASC, id ASC`

Among equal counts, the more recently worn ranks as the bigger favorite, and the longest-untouched ranks as the more neglected. **`id` is a deterministic final tiebreak — it never renders**; it exists so a `useLiveQuery` re-render can't visibly reshuffle tied rows (SQLite guarantees no order among rows `ORDER BY` can't separate).

**Sizing — each list shows `k = min(5, floor(n/2))` rows**, where `n` = worn items **in scope**.

> ⚠️ **The `floor(n/2)` cap enforces the invariant that no item is ever both most-worn and least-worn.** Unfiltered it never binds; **filtered it's the normal case**, since shrinking the set is the filter's entire purpose (8 pairs of pants, top-5 each → the same jeans appear in both lists, and the tab stops being believable). Edge cases fall out: `n = 1` → both lists empty (a single item can't be ranked against anything); `n = 2..3` → one row each.

> ⚠️ **The two orderings must be exact reverses of each other — including the `id` direction.** The cap only guarantees disjointness if they are. With two items tied on both `wear_count` and `last_worn`, `id ASC` in *both* lists puts the same item first in each, so it lands in both. Hence **`id DESC` on most-worn, `id ASC` on least-worn.** Cosmetic in effect (it only moves fully-tied items); **load-bearing for the invariant.**

**"See all →"** on each leaderboard pushes to the **Wardrobe tab**, re-sorted to match the list tapped from, **carrying the active category filter**. "See all" means *more rows of the same question* — the destination is a strict superset of the rows tapped from, so dropping the filter would silently discard a just-expressed intent and land you on a list whose top row isn't what you were looking at.

### 9.3 Never worn

Items with **zero** derived wear-events, in scope of the global filter.

- **Full list, no truncation.** Unlike a leaderboard (nobody wants rank #23), this is a finite **set** — a to-do list of "deal with these or admit you won't" — and half a set is a strange object.
- **Sorted oldest-first** by `created_at`.
- The query **returns `created_at`** so a row can show "added 3 days ago" (§9.5 — it does).

**Oldest-first does the work a grace period would have done.** A brand-new item is *literally* never worn, but it isn't a *mistake* — sorting by age lets genuine mistakes rise and this morning's purchase sink, with **no threshold to defend or tune**, and without the app hiding a row you'd expect right after adding it.

**Accepted consequence:** on a fresh install every item is never-worn, so the Stats tab's first impression is two empty leaderboards above a complete copy of the wardrobe. Judged an **honest empty state, not a bug** — §9.4 shapes it.

### 9.4 Screen layout

**Segmented category filter → adaptive most-worn head → Least/Never sub-tabs.** One list at a time.

**1. Global category filter — segmented control, directly under the title.** Seven values (`All` + six categories), `All` default, sitting above everything else so it reads as governing every list below.

> ⚠️ **Known risk — the one part of this layout under real pressure.** Seven segments at 390pt is ~50pt each; it only fits with abbreviations (`Outer`, `Acc.`). **If it proves cramped on the narrowest supported device, fall back to a horizontally-scrolling chip row with full category names** — same information, same position, **no other decision changes.**

**2. Most-worn head — adaptive on `k`** (`k = min(5, floor(n/2))` from §9.2):

| `k` | Head |
|---|---|
| `≥ 3` | **Podium** of the top 3 (2–1–3, center raised, "Favorite" on #1), with ranks 4..`k` trailing as ranked rows |
| `1–2` | **No podium** — ranked rows under a plain "Most worn" header |
| `0` | Empty state |

> ⚠️ **The podium is sized by `k`, never fixed at 3.** Load-bearing, not cosmetic: a bronze card that the `k` cap excluded would **also** be sitting in the least-worn list below — precisely the both-lists collision §9.2's `id`-direction correction exists to prevent. **The podium is a view of the capped slice, so it inherits the cap.**

**Accepted consequence — the podium needs `n ≥ 6` worn items in scope to appear** (`floor(n/2) ≥ 3`). On a 20-item wardrobe every category filter lands at `k=1`, so **in practice the podium shows on `All`** and filtered views render as ranked rows. **Verified in the prototype, not assumed.** Judged acceptable: the podium is a reward for a wardrobe with enough history to rank, and the fallback is a legitimate layout rather than a broken one. **Revisit if** real per-category counts stay under six and the head feels like it's constantly rearranging — the remedy would be a persistent structure, **not a smaller podium**.

**3. Sub-tabs — one list at a time.** `Least worn (k)` / `Never worn (count)`, counts in the labels, below the head.

- Default **Least worn**.
- **Forced to Never worn when `k = 0`, with the Least tab disabled.** Without this, a fresh install opens on an empty podium *above* an empty Least-worn tab, with the user's entire wardrobe **hidden behind the unselected tab** — two empty things and a hunt. This was a genuine bug caught in the prototype.

### 9.5 Row content & empty states

- **Leaderboard row:** thumbnail, name, `brand · worn N days ago`, wear-count badge.
- **Never-worn row:** thumbnail, name, `brand · added N ago`, `0` badge in the attention tone.

**Never-worn rows always show the "added N ago" line.** It's what makes §9.3's oldest-first ordering **legible**: without it the sort reads as arbitrary; with it, this morning's purchase at the bottom explains itself and the year-old mistake at the top indicts itself. `created_at` is already returned by the query, so it costs nothing.

**Empty states:**
- **Fresh install** (`k=0`, everything never-worn): *"No ranking yet — log a wear and your top items show up here."* above the Never-worn tab holding the full wardrobe. **Honest, not alarming** — it states the precondition and still shows the user their stuff.
- **Filtered to `k=0`** (one worn item in scope): *"Only one item in `<Category>` has been worn — a leaderboard needs at least two."* **Names the actual reason** rather than showing a blank.

### 9.6 Wardrobe tab — arrived-at filter only

- Accepts **sort + category filter as nav params**; sort values `recent` (default) | `most` | `least`.
- **Indicator: removable chips**, one per active param, each clearing **independently** — so you can drop the category but keep the most-worn sort, or the reverse. A single "Clear all" can't express that.
- **Title reflects the active category** (`Footwear`) instead of the generic `Wardrobe`, so the shortened list is explained **before** you reach the chips.
- **No standalone filter surface in v1.** The filter exists only as arrived-at state from "See all →".

**Accepted consequence:** you cannot filter the Wardrobe directly in v1 — to see only footwear you go via Stats. Judged acceptable because the Wardrobe tab's job is **browsing what you own**, and §6.1's builder already carries per-category rails for the *"show me my tops"* need. **This is the most likely early v2 ask, and it's cheap:** the screen already takes filter + sort as params, so a standalone control is a **new entry point to existing state, not a rework.**

### 9.7 Query shapes

The wardrobe is personal-scale and on-device, so the leaderboards run as **one reactive query** returning the full worn set, with the `floor(n/2)` slice done in JS — `n` is then just `rows.length`, and both orderings are exact and explicit.

```ts
import { and, asc, desc, eq, sql, count, max, notExists } from "drizzle-orm";
import { item, outfitItem, wearEvent, type Category } from "./schema";

type Scope = Category | null;                    // null = "All"
const inScope = (s: Scope) => (s ? eq(item.category, s) : undefined);

// --- Worn set: every item with >= 1 wear, ordered as "most worn". ---
// The inner joins are what exclude never-worn items — no explicit filter needed.
export const wornItemsQuery = (scope: Scope) =>
  db
    .select({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      imageFile: item.imageFile,
      wearCount: count(wearEvent.id).as("wear_count"),
      lastWorn: max(wearEvent.wornOn).as("last_worn"),
    })
    .from(item)
    .innerJoin(outfitItem, eq(outfitItem.itemId, item.id))
    .innerJoin(wearEvent, eq(wearEvent.outfitId, outfitItem.outfitId))
    .where(inScope(scope))
    .groupBy(item.id)
    .orderBy(desc(sql`wear_count`), desc(sql`last_worn`), desc(item.id));

type WornItem = Awaited<ReturnType<typeof wornItemsQuery>>[number];

// Exact reverse of the query's ORDER BY — including the id direction,
// which is what keeps the two slices disjoint.
const leastWornOrder = (a: WornItem, b: WornItem) =>
  a.wearCount - b.wearCount ||
  (a.lastWorn ?? "").localeCompare(b.lastWorn ?? "") ||
  a.id - b.id;

export const leaderboards = (worn: WornItem[]) => {
  const k = Math.min(5, Math.floor(worn.length / 2));
  return {
    mostWorn: worn.slice(0, k),
    leastWorn: [...worn].sort(leastWornOrder).slice(0, k),
  };
};

// --- Never worn: zero wear-events, full list, oldest first. ---
export const neverWornQuery = (scope: Scope) =>
  db
    .select()
    .from(item)
    .where(
      and(
        inScope(scope),
        notExists(
          db
            .select({ one: sql`1` })
            .from(outfitItem)
            .innerJoin(wearEvent, eq(wearEvent.outfitId, outfitItem.outfitId))
            .where(eq(outfitItem.itemId, item.id)),
        ),
      ),
    )
    .orderBy(asc(item.createdAt), asc(item.id));
```

Equivalent SQL for the worn set:

```sql
SELECT i.id, i.name, i.brand, i.category, i.image_file,
       COUNT(we.id)    AS wear_count,   -- per wear-event
       MAX(we.worn_on) AS last_worn
FROM item i
JOIN outfit_item oi ON oi.item_id = i.id
JOIN wear_event  we ON we.outfit_id = oi.outfit_id
WHERE (:category IS NULL OR i.category = :category)
GROUP BY i.id
ORDER BY wear_count DESC, last_worn DESC, i.id DESC;
```

---

## 10. Cross-cutting invariants

Pulled together because each was decided in one ticket but binds everywhere:

1. **`PRAGMA foreign_keys = ON` on every connection** — without it no cascade fires (§3.1).
2. **Always fail toward an orphan, never toward a dangling reference** — deletes are row-first, saves are file-first (§4.5).
3. **The orphan sweep runs at startup only** — never on a timer; the timing is what rules out the race with an in-flight save (§4.6).
4. **No item is ever both most-worn and least-worn** — upheld by the `floor(n/2)` cap *and* the exact-reverse orderings *and* the `k`-sized podium (§9.2, §9.4).
5. **Never restart a flow; always carry state** — web-import dead-ends, failed downloads, and permission denials all continue to Review carrying `source_url` + parsed metadata (§5.3, §5.4, §5.6).
6. **The app never offers a button that can't work** — the Outfits `+` hides on an empty wardrobe; the gated zero state has no create button (§7.3, §7.5).
7. **Wear stats are always derived, never stored** (§3.1).
8. **Image grids use `contentFit: 'cover'`** — `none`/`fill` disable the downscaling that replaces thumbnails (§4.1).

---

## 11. Deferred — known, not forgotten

These are **deliberately deferred**, not overlooked, and not out of scope. They block nothing in v1.

- **Post-v1 DB migration strategy.** The *mechanism* is settled (§2 — drizzle-kit + `useMigrations`). How the schema **evolves after ship** — additive-only conventions, handling a destructive change against on-device data with no backup (§12), whether a failed migration can recover — is undecided. It becomes real the first time v1.1 changes a column.
- **App icon / branding.** A task, not a decision. Blocks no implementation.

Known **v2 asks**, both cheap because the plumbing already exists:
- **A standalone Wardrobe filter** (§9.6) — the screen already takes filter + sort as params.
- **An occasion filter on the Outfits list** (§7.4) — §6.2's vocabulary query already exists.
- **`expo-share-intent`** as a fast-follow to paste-URL import, reusing the same parse+download pipeline (feasible via config plugin + dev/EAS build, not Expo Go; moderate effort; community-maintained).

---

## 12. Out of scope

Ruled beyond this effort's destination. These return only if the foundation is redrawn — and then as new efforts, not resumptions.

- Background removal / clean cutouts.
- Freeform canvas/collage outfit builder.
- Cloud sync / accounts / multi-device.
- Sharing / exporting outfits (social).
- Cost-per-wear / price / wardrobe value.
- Time-series charts & seasonal analytics.
- Laundry status, packing/trip planning, weather-based or AI outfit suggestions.
- **Local DB backup/export** (iCloud/file export). **Ruled out, not deferred.** On-device-only with no accounts is a locked foundation decision, and **a lost phone meaning lost data is its accepted consequence**, not an open question.

---

## Decision index

| # | Ticket | Governs |
|---|---|---|
| [2](https://github.com/ShmuelAmir/wardrobe-tracker/issues/2) | Research: Expo project foundation & SDK choices | §2 |
| [3](https://github.com/ShmuelAmir/wardrobe-tracker/issues/3) | Research: web image import from a brand product page | §5.3, §5.4 |
| [4](https://github.com/ShmuelAmir/wardrobe-tracker/issues/4) | Finalize data model & Drizzle schema | §3 |
| [5](https://github.com/ShmuelAmir/wardrobe-tracker/issues/5) | Prototype: add-item flow | §5.1, §5.2, §5.5 |
| [6](https://github.com/ShmuelAmir/wardrobe-tracker/issues/6) | Prototype: outfit builder | §6.1, §8.5 |
| [7](https://github.com/ShmuelAmir/wardrobe-tracker/issues/7) | Stats computation spec | §9.1–§9.3, §9.7 |
| [9](https://github.com/ShmuelAmir/wardrobe-tracker/issues/9) | Spec web-import error & edge states | §5.3 |
| [10](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10) | Spec image storage | §4, §5.4 |
| [11](https://github.com/ShmuelAmir/wardrobe-tracker/issues/11) | Prototype: Stats screen & Wardrobe sort/filter | §9.4–§9.6 |
| [12](https://github.com/ShmuelAmir/wardrobe-tracker/issues/12) | Reconcile outfit tagging | §6.2, §6.3 |
| [13](https://github.com/ShmuelAmir/wardrobe-tracker/issues/13) | Prototype: navigation, entry points & first-run | §7, §5.6 |
| [14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14) | Prototype: item & outfit detail | §8 |

**Supporting branches** — none are merged to `main`, and none carry app code.

- **Research findings, kept on the remote:** `research/expo-foundation` (#2), `research/web-image-import` (#3). These are durable reference — §2 and §5.3 lean on them.
- **Prototype source: throwaway, and deleted from the remote once wayfinding closed.** The **interactive prototypes linked from each section above are the durable record**; the HTML that generated them is not. Recoverable from a local clone if ever needed:

  | Branch | Commit | Ticket |
  |---|---|---|
  | `prototype/stats-screen` | `cb8f933` | [#11](https://github.com/ShmuelAmir/wardrobe-tracker/issues/11) |
  | `prototype/navigation-entry-points` | `d5e11d2` | [#13](https://github.com/ShmuelAmir/wardrobe-tracker/issues/13) |
  | `prototype/detail-screens` | `e9ff76e` | [#14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14) |

  > The `source on branch …` links in #11, #13 and #14's comments therefore **404**. This is intended — those prototypes did their job (each one caught a real bug: the `k=0` sub-tab trap, the never-worn sink, the outfit-delete cascade) and their conclusions are in this document.

## Amendment chain

This document already reflects all of these. Recorded so a reader following a ticket link isn't misled by superseded text in the ticket body.

| Amendment | Effect |
|---|---|
| #10 amends #4 | `image_path` → `image_file` (`imagePath` → `imageFile`); the column holds a **bare filename**. #7's query examples carry the old name in the ticket; §9.7 here is corrected. |
| #10 amends #9 | The web image downloads at **step 3 ("Use this image")**, not at Save. #9's "no file lands on disk until save" is superseded — the download lands in **cache**, preserving #9's actual intent. |
| #12 amends #6 | **Outfits have no season** — season chips off the Save sheet, season tags off the Detail header. "Occasion chips" refined into the self-building vocabulary. **#4's schema untouched.** |
| #14 amends #5 | The **Review step becomes create-or-edit** — a second entry point, `Cancel`/`Save`, a `Delete Item` row, no metadata pre-fill. |
| #14 amends itself (addendum, after #13) | **The toast carries `Undo`** on **both** log surfaces. The resolution's original "No `Undo` on the toast" was written against #6's world; #13's one-tap rail broke that reasoning. Its accepted cost ("recovering a mis-tap costs two taps") is **withdrawn**. |
| #4 supersedes the map's foundation | **Color dropped for v1.** |
| #7 supersedes the map's foundation | **"Wears by category" is a filter, not a Stats view** — no category aggregate at all. |
| #12 supersedes the map's foundation | *"Outfit: name (opt), occasion/season tag (opt)"* → **occasion only**. |
