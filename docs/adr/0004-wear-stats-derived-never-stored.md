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
