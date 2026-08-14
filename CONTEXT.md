# wardrobe-tracker — domain context

A personal responsive web app and installable PWA (Vite + React + Convex) to catalog
a wardrobe, build outfits from items, and read per-item usage stats. **Single-user
and private** — one account exists solely to prove a device belongs to the one
human, and multiple devices signed in at once is the point, not a tolerated side
effect.

This is the single-context glossary and invariant list for the repo. The full,
build-ready decision record is [`SPEC.md`](./SPEC.md); the reasoning behind each
architectural choice lives in [`docs/adr/`](./docs/adr/); operator procedures live
in [`docs/runbook.md`](./docs/runbook.md). When naming a domain concept in an issue,
test, or proposal, use the term as defined here — don't drift to synonyms.

> This file and the ADRs were backfilled from `SPEC.md` v1 after
> [map #1](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1) closed, and
> rewritten for the Convex web app after
> [map #87](https://github.com/ShmuelAmir/wardrobe-tracker/issues/87) closed.
> `SPEC.md` remains the authoritative statement of every decision; these docs
> restate its vocabulary and rationale in the shape the engineering skills expect.

**Production origin: `https://acrobatic-swan-379.convex.site`** (deployment
`acrobatic-swan-379`, team `shmuel-amir`, eu-west-1). This is a generated slug and
it is **permanent** — a custom domain is out of scope, and both the iOS ITP storage
exemption and the auth session token are origin-scoped, so changing it would
silently log the user out and forfeit the exemption. See §14.1 of `SPEC.md`.

---

## Glossary

**Item** — a single garment or accessory. Carries an image, a required category,
optional name / brand / season, and an optional `sourceUrl` (set on web import).
The image is stored as `image: v.id('_storage')` — opaque identity — **plus** a
denormalized `imageUrl` written once at insert, because the serving URL is not
derivable from the storage id. The unit the Wardrobe catalogs.

**Category** — the fixed 6-value classification of an item: `Top, Bottom,
Outerwear, Footwear, Accessory, Bag`. Universal to every wardrobe, which is why it
is a closed enum. **Enforced server-side** via `v.union(v.literal(…))` — a real
constraint, not TypeScript-only validation (this reverses v1's "no `CHECK`
constraint"; see ADR-0017).

**Season** — one of four base values (`spring, summer, fall, winter`). A property
of an **item only**, never an outfit. Optional multi-select stored as
`v.optional(v.array(season))`; year-round means all four selected. There is **no
"All-season" value** — absent renders as "Any season".

**Outfit** — a named set of items worn together. Many-to-many with items, no fixed
slots. Carries an optional free-text `occasion`. Has **no season** (see ADR-0011).

**Outfit-item** — the join between an outfit and an item. An item appears at most
once per outfit. There is **no composite primary key** — Convex has none. The
uniqueness is upheld by **the shape of the only write path**: membership is written
wholesale from a deduped `itemIds` array, and no `addItemToOutfit` mutation is ever
exposed, so a duplicate is *unreachable* rather than rejected (see ADR-0017).

**Wear event** — one record that an outfit was worn on a given day
(`wornOn`, `YYYY-MM-DD`, day-granular). The atomic, unambiguous unit all stats
derive from. Belongs to an **outfit**, never directly to an item.

**Wear count** — a *derived* per-item statistic: the number of wear events reaching
that item through its outfits. **Per wear-event** — two outfits sharing an item
worn the same day count twice, intentionally. Never stored (see ADR-0004).

**Most worn / Least worn** — the two leaderboards over the set of items with
**≥ 1 wear**, sorted opposite ways. Sized so no item can appear in both. The final
tiebreak is `_creationTime` then `_id`, and it must be **exactly reversed** between
the two lists (see ADR-0012 — this fails silently).

**Never worn** — items with **zero** wear events, in scope of the active filter.
A finite set (not a leaderboard), shown in full, oldest-first by `_creationTime`.

**Zero-item outfit** — an outfit whose every item has been deleted. A **legal,
labelled state**, not a broken one: its wear events survive and keep counting,
because those wears really did happen. Reachable only by declining the cleanup
offered on each item delete (§8.4).

**Occasion** — a single free-text tag on an outfit (e.g. "Work", "Shul"). Its chip
vocabulary is **built from the user's own history**, not a shipped enum. Matching is
case-insensitive so first-spelling-wins canonicalization works; with no SQL
collation available this is a **JS scan** over the collected outfits, not a stored
normalized key (see ADR-0011).

**Web import** — the primary add-item path: a **server-side Convex action** fetches
the brand product page's HTML, parses an image (`og:image` → `twitter:image` →
JSON-LD → largest `<img>`), normalizes it and stores it. Running server-side means
there is no CORS to enforce; the parser is pure regex and needs no DOM library, and
the codec is pure JavaScript, which is why the server path reads **JPEG only** (see
ADR-0020). The action returns **structured failure results, never throws** (see
ADR-0019).

**Dead end** — a web import that reached Review with everything **but** the image:
a 401/403/404, a page with no usable image, a connection reject that reproduced, or
the user's own "none of these". It is a *continuation*, never a restart — `sourceUrl`
is carried always, name and brand whenever the parse returned them — and the image
slot becomes a paste-or-drag drop zone. Distinct from a **retryable** failure, which
keeps the user on the paste step behind a Retry button (see §5.4 of `SPEC.md`).

**Wear-again rail** — the horizontal strip **above the list pane on every screen**:
the 5 most recently worn outfits, each with a one-click "Wore it" that logs a wear
for today with no navigation. Scope is `wears ≥ 1`. It does not render when nothing
has ever been worn.

**Owner** — the single human the app belongs to. Identified by
**`getAuthUserId(ctx)`**, never by `getUserIdentity().subject` (which under Convex
Auth is `userId|sessionId`, not the user id). `requireOwner(ctx)` is the only way a
function learns who is asking; **no function accepts a `userId` argument**.

**Orphan** — a file in Convex storage with no owning `item` row. The *safe* failure
mode: invisible, small, and reclaimed by the daily sweep.

**Dangling reference** — an `item` row whose stored **file** is gone. The *unsafe*
failure mode. **Unreachable by construction**: `ctx.storage.delete()` is
transactional inside a mutation, so the row and the file die together (ADR-0018).
A stale `imageUrl` is *not* a dangling reference — it is a render-path concern, and
it renders the category placeholder (§4.5 of `SPEC.md`).

**Orphan sweep** — the reconciliation that lists stored files, diffs against the DB,
and deletes strays older than **24 hours**. Runs **daily, on a cron** — the age
threshold, not the timing, is what rules out the race with an in-flight save
(ADR-0018).

---

## Core invariants

These are decided in individual ADRs but bind across the whole codebase
(mirrors §10 of `SPEC.md`). They state **current truth only** — where an invariant
reversed against v1, the delta lives in the ADR ledger, not here.

1. **Every read is scoped `by_user`, and no function accepts a `userId` argument** —
   `requireOwner(ctx)` wraps `getAuthUserId(ctx)`, never `.subject` (ADR-0014).
   ⚠️ **Fails silently.**
2. **Deletes cascade as hand-written row-side deletes inside one atomic mutation** —
   Convex has no FK cascade; atomicity survives, enforcement moves to tested code
   (ADR-0017).
3. **Row and file die together** — a dangling reference is unreachable by
   construction (ADR-0018).
4. **The orphan sweep runs daily on a cron with a 24-hour age threshold**
   (ADR-0018).
5. **No item is ever both most-worn and least-worn** — upheld by the `floor(n/2)`
   cap, the `k`-sized podium, and orderings that are exact reverses *including* the
   `_creationTime` and `_id` directions (ADR-0012). ⚠️ **Fails silently.**
6. **Never restart a flow; always carry state** — dead ends, failed fetches and
   reloads all continue to Review carrying `sourceUrl` + parsed metadata, and the
   draft persists to IndexedDB blob and all (ADR-0010).
7. **Actions return structured failure results, never throws** — a thrown error in
   an action is exactly the flow-restart ADR-0010 bans (ADR-0019).
8. **The app never offers a button that can't work** — the Outfits `+` hides on an
   empty wardrobe; the gated zero state has no create button; Retry is never offered
   for a failure retry cannot fix (ADR-0010).
9. **Wear stats are always derived, never stored** (ADR-0004).
10. **Image grids use `object-fit: cover`** — other values disable the downscaling
    that replaces thumbnails (ADR-0006).
11. **Zero colour literals outside `src/theme/primitives.ts`**, and the CSS
    custom-property block is **generated at runtime** from the token modules — a
    build-time `.css` would re-open the raw-hex guard's exclusion problem. The PWA
    manifest's `theme_color` / `background_color` are generated from the same source
    (ADR-0013).
