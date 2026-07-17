# 7. UUID image filenames; store the bare filename, never a path

- Status: Accepted
- Date: 2026-07-17
- Owner: [#10 — Spec image storage](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10); §4.2 of `SPEC.md`

## Context

Each item has exactly one image file (ADR-0006) in one flat directory,
`Paths.document/items/`. Two naming questions follow: what is the file called, and
what does the DB store to find it.

## Decision

**Filename is `<uuid>.jpg`** — `expo-crypto`'s `randomUUID()`, generated **at
capture, before the row exists**.

- *Not rename-after-insert:* that welds the filesystem to the DB transaction
  (insert placeholder → read id → rename → UPDATE), with a window where the row
  points at nothing and a real failure if the app dies between steps. A UUID is
  known *first*, so save is a single insert carrying its final path: write file →
  insert row → delete file if the insert throws.
- *Not `item.id`:* `12.jpg` is only safe while no future item is ever id 12 again,
  which ties file naming to a schema detail (`AUTOINCREMENT` preventing rowid reuse)
  that has nothing to do with files.

**The DB stores the bare filename** (`a3f2c1de.jpg`) — not a path, never absolute.

- *Not absolute:* per Apple's TN2406 the app container path can change across
  updates and reinstalls, so a stored `file:///var/mobile/Containers/…` rots.
- *Bare filename over relative subpath (`items/a3f2c1de.jpg`):* the directory is
  then **one constant in code**, so reorganizing the layout is a one-line edit and
  no data moves. A subpath bakes the layout into every row, turning the same change
  into an `UPDATE` across the table — a data migration for what is really a code
  concern. Resolve at read time: `Paths.join(Paths.document, "items", imageFile)`.
- Extension stays in the name so format is readable without sniffing.

## Consequences

- Save ordering is trivial and crash-safe because the final name exists before any
  row does (feeds ADR-0008).
- **Accepted cost:** UUID filenames are opaque in a debugger; orphans are found by
  query, not by reading filenames.
