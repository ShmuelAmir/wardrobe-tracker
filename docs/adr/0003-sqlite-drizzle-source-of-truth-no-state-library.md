# 3. SQLite + Drizzle as the single source of truth; no state-management library

- Status: Accepted
- Date: 2026-07-17
- Owner: [#2](https://github.com/ShmuelAmir/wardrobe-tracker/issues/2), [#4](https://github.com/ShmuelAmir/wardrobe-tracker/issues/4); §2 of `SPEC.md`

## Context

The app has meaningful relational data (items, outfits, wears) that must persist
on-device and drive several reactive screens (grids, leaderboards, rails). The
default RN instinct is to reach for a global state library (Redux/Zustand) as the
app's source of truth.

## Decision

- **Database:** expo-sqlite + **Drizzle ORM**.
- **Migrations:** drizzle-kit generates SQL, bundled via metro `sql` sourceExt +
  babel `inline-import`, applied on-device at startup with the `useMigrations` hook.
- **State management: none.** SQLite is the single source of truth. Drizzle
  `useLiveQuery` plus React state/Context is sufficient. Add Zustand later *only*
  if a real need appears.

## Consequences

- Reactive screens re-run their queries via `useLiveQuery` when the underlying data
  changes — no separate cache to keep coherent with the DB.
- This choice is what makes ADR-0004 (derived, never-stored stats) viable: a live
  query recomputes aggregates on read with no denormalized state to invalidate.
- Adding a state library later is a deliberate, evidence-driven step, not the
  default — avoiding two sources of truth that can disagree.
- The post-ship migration *mechanism* is settled here; how the schema *evolves*
  after ship is deferred (§11).
