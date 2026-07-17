# 12. Stats is a read-only leaderboard; category is a filter; leaderboards are disjoint

- Status: Accepted
- Date: 2026-07-17
- Owner: [#7 — Stats computation spec](https://github.com/ShmuelAmir/wardrobe-tracker/issues/7), [#11 — Prototype: Stats screen](https://github.com/ShmuelAmir/wardrobe-tracker/issues/11); §9 of `SPEC.md`

## Context

The Stats tab reports wear usage. The open questions were what to *show* (which
aggregates), how the user *slices* it, and how to keep the most/least leaderboards
meaningful once a filter shrinks the set.

## Decision

**Stats is a leaderboard you read, not a to-do list you act on.** (The Outfits tab
deliberately breaks this symmetry — it is acted *from* — because logging a wear is
the only daily action and had been buried one nav deep; hence the wear-again rail.)

**Two views and a global filter, not three views.**

- **"Wears by category" is a filter, not a metric.** No category-level aggregate
  exists — the "which pants do I wear most?" need is a *per-item* question *within* a
  category, answered by **scoping the leaderboards**. A global category filter
  (`All` + the six categories) re-scopes both lists at once. (Grouped-by-category
  totals were rejected: ordering is near-constant since every outfit has shoes.)
- **Most worn / least worn** are the same set — items with **≥ 1 wear** — sorted
  opposite ways. **Never-worn is a separate view** (a finite set, shown in full,
  oldest-first): "never worn" and "worn rarely" prompt different actions.

**The two leaderboards must be disjoint — no item is ever both most- and
least-worn.** Upheld by three coupled mechanisms:

- **`k = min(5, floor(n/2))`** rows per list, `n` = worn items in scope. Unfiltered
  it never binds; filtered it's the normal case (shrinking the set is the filter's
  purpose).
- **Exact-reverse orderings, including the `id` tiebreak** — `id DESC` on most-worn,
  `id ASC` on least-worn. Cosmetic in effect but load-bearing: same-direction `id`
  would drop a fully-tied item into both lists.
- **The podium is sized by `k`, never fixed at 3** — a bronze card the cap excluded
  would also sit in the least-worn list, the very collision the above prevents.

## Consequences

- Leaderboards run as **one reactive query** returning the full worn set; the
  `floor(n/2)` slice and the exact reverse ordering are done in JS (`n = rows.length`).
- Edge cases fall out of the cap: `n=1` → both lists empty; `n=2..3` → one row each;
  podium needs `n ≥ 6` in scope, so in practice it shows on `All` and filtered views
  render as ranked rows.
- **Fresh install is an honest empty state**, not a bug: everything is never-worn,
  so Stats opens forced to the Never-worn tab (Least disabled at `k=0`) showing the
  full wardrobe, above empty leaderboards.
- **"See all →"** pushes to the Wardrobe tab re-sorted and **carrying the active
  category filter** — the destination is a superset of the rows tapped from.
- **No standalone Wardrobe filter in v1** — it exists only as arrived-at nav state
  from "See all". The most likely early v2 ask, and cheap (the screen already takes
  filter + sort as params).
