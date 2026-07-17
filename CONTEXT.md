# wardrobe-tracker — domain context

A personal, on-device iOS app (Expo / React Native) to catalog a wardrobe, build
outfits from items, and read per-item usage stats. Single-user, no accounts, no
cloud, no sync.

This is the single-context glossary and invariant list for the repo. The full,
build-ready decision record is [`SPEC.md`](./SPEC.md); the reasoning behind each
architectural choice lives in [`docs/adr/`](./docs/adr/). When naming a domain
concept in an issue, test, or proposal, use the term as defined here — don't drift
to synonyms.

> This file and the ADRs were backfilled from `SPEC.md` after wayfinding closed.
> `SPEC.md` remains the authoritative statement of every decision; these docs
> restate its vocabulary and rationale in the shape the engineering skills expect.

---

## Glossary

**Item** — a single garment or accessory. Carries an image, a required category,
optional name / brand / season, and an optional `source_url` (set on web import).
The unit the Wardrobe tab catalogs.

**Category** — the fixed 6-value classification of an item: `Top, Bottom,
Outerwear, Footwear, Accessory, Bag`. Universal to every wardrobe, which is why it
is a closed enum. Stored as `text`, validated in TS, **no SQLite `CHECK`
constraint** (ADR-0005-adjacent; see §3.1 of `SPEC.md`).

**Season** — one of four base values (`spring, summer, fall, winter`). A property
of an **item only**, never an outfit. Optional multi-select stored as a JSON array;
year-round means all four selected. There is **no "All-season" value** — `null`
renders as "Any season".

**Outfit** — a named set of items worn together. Many-to-many with items, no fixed
slots. Carries an optional free-text `occasion`. Has **no season** (see ADR-0011).

**Outfit-item** — the join between an outfit and an item. Composite primary key
`(outfit_id, item_id)`: an item appears at most once per outfit.

**Wear event** — one record that an outfit was worn on a given day
(`worn_on`, `YYYY-MM-DD`, day-granular). The atomic, unambiguous unit all stats
derive from. Belongs to an **outfit**, never directly to an item.

**Wear count** — a *derived* per-item statistic: the number of wear events reaching
that item through its outfits. **Per wear-event** — two outfits sharing an item
worn the same day count twice, intentionally. Never stored (see ADR-0004).

**Most worn / Least worn** — the two leaderboards over the set of items with
**≥ 1 wear**, sorted opposite ways. Sized so no item can appear in both (see
ADR-0012).

**Never worn** — items with **zero** wear events, in scope of the active filter.
A finite set (not a leaderboard), shown in full, oldest-first.

**Occasion** — a single free-text tag on an outfit (e.g. "Work", "Shul"). Its chip
vocabulary is **built from the user's own history**, not a shipped enum (see
ADR-0011).

**Web import** — the primary add-item path: fetch a brand product page's HTML with
native `fetch`, parse an image (`og:image` → `twitter:image` → JSON-LD → largest
`<img>`), and download it. No proxy, no backend (see ADR-0009).

**Wear-again rail** — the horizontal rail atop the Outfits tab: the 5 most recently
worn outfits, each with a one-tap "Wore it" that logs a wear for today with no
navigation. Scope is `wears ≥ 1`.

**Orphan** — an image file on disk with no owning `item` row. The *safe* failure
mode: invisible, small, and reclaimed by the startup sweep.

**Dangling reference** — an `item` row whose image file is missing. The *unsafe*
failure mode: a broken tile on an item the user didn't delete. Avoided by ordering
(see ADR-0008).

**Orphan sweep** — the startup-only reconciliation that lists `document/items`,
diffs against the DB, and unlinks strays. Runs **once, at startup only** — never on
a timer (see ADR-0008).

---

## Core invariants

These are decided in individual ADRs but bind across the whole codebase
(mirrors §10 of `SPEC.md`):

1. **`PRAGMA foreign_keys = ON` on every connection** — expo-sqlite defaults it
   OFF; without it no cascade fires (ADR-0005).
2. **Always fail toward an orphan, never toward a dangling reference** — deletes are
   row-first, saves are file-first (ADR-0008).
3. **The orphan sweep runs at startup only** — the timing is what rules out the race
   with an in-flight save (ADR-0008).
4. **No item is ever both most-worn and least-worn** — upheld by the `floor(n/2)`
   cap, the exact-reverse orderings, and the `k`-sized podium (ADR-0012).
5. **Never restart a flow; always carry state** — web-import dead-ends, failed
   downloads, and permission denials all continue to Review carrying `source_url` +
   parsed metadata (ADR-0010).
6. **The app never offers a button that can't work** — the Outfits `+` hides on an
   empty wardrobe; the gated zero state has no create button (ADR-0010).
7. **Wear stats are always derived, never stored** (ADR-0004).
8. **Image grids use `contentFit: 'cover'`** — `none`/`fill` disable the
   downscaling that replaces thumbnails (ADR-0006).
