# 16. Convex is the source of truth; still no state library

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0003](./0003-sqlite-drizzle-source-of-truth-no-state-library.md)
- Owner: [#95 — Prototype: a Vite + React + Convex vertical slice](https://github.com/ShmuelAmir/wardrobe-tracker/issues/95) and [#97 — Decide the Convex data model](https://github.com/ShmuelAmir/wardrobe-tracker/issues/97), with research from [#91](https://github.com/ShmuelAmir/wardrobe-tracker/issues/91); §2, §3.6 of `SPEC.md`

## Context

ADR-0003 made SQLite-via-Drizzle the single source of truth and, on that basis,
shipped **no state management library at all**: `useLiveQuery` re-ran on write, so
there was exactly one place data lived and nothing that could disagree with it.
Zustand was left as a deliberate, evidence-driven step rather than a default.

The storage engine is now gone — expo-sqlite, Drizzle, drizzle-kit migrations, the
metro `sql` sourceExt and the `useMigrations` startup hook all die with the native
app. The question is whether the *thesis* dies with the premise, because a
replatform is exactly the moment a team reaches for a client cache "while we're in
here".

## Decision

**Convex is the source of truth, and there is still no state library.**

Convex's reactive queries occupy exactly the seat `useLiveQuery` occupied: a
component subscribes to a query, the server pushes an update on write, the
component re-renders. There remains **one source of truth and no client cache that
can disagree with it**, which is the entire content of ADR-0003's thesis. Zustand
stays a deliberate step, not a default.

This is why ADR-0003 needs a successor rather than a tombstone. Losing the thesis
alongside its premise would let the replatform quietly reintroduce the
two-sources-of-truth problem the original ADR existed to prevent.

**Convex reactivity is strictly stronger than what it replaces, in one specific
way**: `useLiveQuery` re-ran only when **its own `from` table** changed, whereas
Convex queries are reactive over **every table they read**.

## Consequences

- **The three-way `useOutfitCards` split dissolves.** It existed for exactly one
  documented reason — a wear touches `wearEvents`, an item delete cascades into
  `outfitItems`, neither touches `outfits`, so identity, membership and wear facts
  had to be three reads merged in JS. The three reads collapse into one query
  function. `mergeOutfitCards` and `compareCards` are **kept and moved server-side,
  unchanged**: the tested `lastWorn DESC NULLS LAST` logic is worth keeping, and
  only the hook plumbing that worked around SQLite goes.
- **This is what keeps ADR-0004 viable.** That ADR's "viable only because SQLite is
  the reactive source of truth" consequence re-points here with the noun swapped —
  derived stats are affordable precisely because the reactive layer re-runs the
  aggregate rather than the app maintaining a counter.
- **Category and Season filtering stays in JS**, and there is **no pagination**
  (§3.1). Convex pages may grow or shrink under live writes and their boundaries are
  unstable across a re-sort — which the most/least-worn sorts trigger on every wear
  log. Paginating would import that instability into the one screen whose order
  reacts.
- **A precondition this ADR owns, and which four separate tickets independently
  hit:** `CATEGORIES`/`SEASONS` must move out of `src/db/schema.ts` into their own
  module **before** `src/db/` is deleted. `wardrobe-view.ts` imports `CATEGORIES` at
  runtime, dragging **23.1 kB of `drizzle-orm`** into the web bundle against 237
  bytes for a genuinely platform-free module. This is a precondition of this ADR
  taking effect in code, not a cutover chore — it is cutover step 2.
- **Schema migration mechanism changes shape entirely.** drizzle-kit generate and
  `useMigrations` retire; a Convex schema edit is an ordinary code-and-redeploy, and
  `@convex-dev/migrations` covers the cases that need a backfill. How the schema
  evolves after ship is deferred, not decided here.
