# 8. Fail toward an orphan; startup-only orphan sweep

- Status: Accepted
- Date: 2026-07-17
- Owner: [#10 — Spec image storage](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10); §4.5, §4.6 of `SPEC.md`

## Context

The DB cascade (ADR-0005) deletes rows; image files are the app's job (ADR-0006,
ADR-0007). Because a save and a delete each touch two systems (filesystem + DB)
non-atomically, a crash mid-operation can leave them disagreeing. There are two
possible disagreements, and they are not equally bad.

## Decision

**Order every two-system operation so that a crash leaves an *orphan* (file with no
row), never a *dangling reference* (row with no file).**

- **Save is file-first:** write file → insert row → delete file if the insert
  throws. (Enabled by the UUID being known before the row — ADR-0007.)
- **Delete is row-first:** delete the row (cascade runs), then unlink the file,
  best-effort. A failed unlink is swallowed and left to the sweep; it must never
  block or roll back a delete the user asked for.

| Killed mid-delete | Result | Cost |
|---|---|---|
| Row first | file with no row | invisible, ~300KB, sweepable |
| File first | row → missing file | broken tile on an item the user *didn't* delete, unfixable in-app |

- **Scope:** an item delete removes its one file; an **outfit delete removes none**
  (outfits own no images — their cascade is pure rows).

**Orphan sweep — startup only.** List `document/items`, diff against
`SELECT image_file FROM item`, unlink strays, silently (log, never surface). Runs
**once, after `useMigrations` resolves, before the UI can open the wizard.**

## Consequences

- **The timing is load-bearing.** Save is "move file → insert row", so there is a
  real window where a legitimate file exists with no row yet. Pinning the sweep to
  startup rules the race out **by construction**, not by locking — **never on a
  timer, never in the background.**
- The sweep is cheap (one dir listing + one column query) and catches both orphan
  sources: interrupted deletes, and saves killed between move and insert.
- The mirror case (row with missing file) shouldn't occur once this holds, but the
  grid degrades quietly: **render a category placeholder, never a broken tile.**
- **Principle:** always fail toward an orphan, never toward a dangling reference.
  Cross-cutting invariant.
