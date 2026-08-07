# 4. Wear stats are derived, never stored

- Status: Accepted
- Date: 2026-07-17
- Owner: [#4 — Finalize data model & Drizzle schema](https://github.com/ShmuelAmir/wardrobe-tracker/issues/4), amended by [#10](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10); §3, §9 of `SPEC.md`

## Context

Every screen in the app reads wear statistics: per-item wear counts, last-worn
dates, most/least/never-worn leaderboards. The tempting optimization is to store
`wear_count` / `last_worn` columns and update them on each log.

## Decision

**No derived-stat columns.** No `wear_count`, no `last_worn` on `item`. Every
statistic is aggregated on read via `item → outfit_item → wear_event`, and re-run
reactively with `useLiveQuery`.

- **Wear count is per wear-event.** Wearing two outfits that share an item on the
  same day counts **twice**. This is intended.
- The atomic fact is the `wear_event` row; everything else is a projection of it.

## Consequences

- No denormalized counter can ever drift from reality — there is nothing to keep in
  sync, and a cascade delete of `wear_event` rows (ADR-0005) automatically corrects
  every affected item's stats on the next read.
- Correctness holds under the cascade deletes: deleting an outfit drops its wears,
  and dependent counts fall out of the next query with no bookkeeping.
- Viable only because SQLite is the reactive source of truth (ADR-0003). At
  personal scale (~200 items) the aggregate queries are cheap, so there is no
  performance case for stored counters.
- Contrast: **season cannot be derived the same way** — see ADR-0011, where the
  union/intersection operator fails on ordinary mixed-season, nullable data.

## Amendment (2026-08-07) — survives whole on Convex; the rejected alternative gets a name

The replatform to Convex (ADR-0014) leaves this ADR **intact in both halves** —
the invariant *and* the mechanism. The map's own destination line initially claimed
the mechanism would die; that was wrong, and this amendment is where it is
corrected.

**`@convex-dev/aggregate` is rejected**, and the reason is structural rather than
about cost. It is idiomatic for aggregates native to **one table**; wear count is
native to a **join** (`wearEvents → outfitItems → items`). Using it here would
require inventing a write-time-fanned "wear-credit" table — which is *structurally
the denormalized counter this ADR exists to refuse*, re-earned only by
same-transaction discipline. That is a real table the domain has no name for,
bought to solve a cost problem this app does not have: a few thousand small
documents against a 32,000-document / 16 MiB transaction ceiling.

So the read-time join ports intact.

**A revisit trigger, which the original had no equivalent of:** wear events past
**~20,000**, or the stats query approaching the document-scan ceiling. At roughly
one wear a day that is ~50 years away.

Re-pointed references:

- "Viable only because SQLite is the reactive source of truth (ADR-0003)" now reads
  against **ADR-0016** — Convex's reactive queries occupy exactly `useLiveQuery`'s
  seat, so the argument transfers with the noun swapped.
- The cascade-corrects-stats consequence now rests on **ADR-0017**'s hand-written
  row-side deletes rather than on SQLite foreign keys. Atomicity survives, so the
  consequence holds unchanged.

The wear-count-per-event rule and the "atomic fact is the wear-event row" framing
are untouched.
