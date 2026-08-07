# 17. Row-side cascades; enforcement moves to the server

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0005](./0005-hard-cascade-deletes-with-fk-enforcement.md)
- Owner: [#97 — Decide the Convex data model for items, outfits, and wear events](https://github.com/ShmuelAmir/wardrobe-tracker/issues/97), with research from [#91](https://github.com/ShmuelAmir/wardrobe-tracker/issues/91); §3.3, §3.4, §8.3, §8.4 of `SPEC.md`

## Context

ADR-0005 specified hard cascade deletes enforced by SQLite foreign keys, and
carried three mechanism sub-decisions: `PRAGMA foreign_keys = ON` on every
connection (expo-sqlite defaults it *off*, so without it no cascade fires), a
composite primary key `(outfit_id, item_id)` on the join table, and Category stored
as `text` with **no** `CHECK` constraint.

Convex has **no foreign keys, no cascade, no composite primary key and no
`CHECK`**. All three mechanisms have to be re-decided.

This ADR is superseded rather than amended for a specific reason: `PRAGMA
foreign_keys = ON` is not a private implementation note, it is a **cross-cutting
invariant cited in `SPEC.md`**. A dead invariant sitting inside a document still
marked `Accepted` is a landmine, and amending around it would leave one.

## Decision

**The delete *behaviour* survives entirely. The enforcement moves from a database
feature into tested application code.**

Behaviour, restated whole so it does not have to be read out of a superseded
document:

- **Delete an item** → its outfit memberships cascade. Outfits survive minus that
  garment; wear history is untouched.
- **Delete an outfit** → its memberships **and** its wear events die.
- **The UI confirms concrete impact** (N outfits / N wears) before any hard delete.
- **An outfit may legally outlive all its garments** — a zero-item outfit is a
  labelled state, not a broken one, because those wears really did happen.

The asymmetry of the confirmation copy — deleting an item is nearly harmless,
deleting an outfit is what destroys history — is honest to the new schema exactly as
it was to the old one.

The three mechanism sub-decisions all die or reverse:

| Sub-decision | Fate |
|---|---|
| `PRAGMA foreign_keys = ON` on every connection | **No analog.** Cascades are hand-written row-side deletes inside the mutation. |
| Composite PK `(outfit_id, item_id)` | **Replaced by the shape of the only write path.** |
| Category is `text`, **no** `CHECK` constraint | **Reversed.** Category and Season gain real server-side enforcement via `v.union(v.literal(…))`. |

**Uniqueness is upheld by the write path, not by a check-then-insert.** Membership
writes are already set-shaped — `saveOutfit` and `updateOutfit` both write the join
wholesale — so the composite key was never defending against a second writer; it
was defending against a duplicate *inside one `itemIds` array*. The mutations
therefore take a deduped `itemIds` array and replace the whole set, and **no
`addItemToOutfit` mutation is ever exposed**. A duplicate becomes **unreachable
rather than rejected**.

**The `CHECK`-constraint reversal is a strict upgrade.** ADR-0005's reasoning —
"keep new values cheap to add by migration" — was about SQLite's migration friction.
On Convex a validator change is an ordinary code-and-redeploy, so the original
cost/benefit does not transfer and the enforcement is taken.

## Consequences

- **Atomicity survives unchanged; enforcement does not.** A Convex mutation is a
  single transaction, so there is no window where the item is gone but its join rows
  remain. But nothing at the storage layer *makes* the cascade happen — if a
  mutation forgets a row-side delete, the orphaned join row is a real bug that only
  a test catches. This is the whole cost of the supersession, and it is why the DB
  integration tier ports to `convex-test` rather than being dropped.
- **Uniqueness is enforced in a stronger place than before.** A check-then-insert
  guards one code path; a write path that cannot express the illegal state guards
  all of them. The cost is that adding an incremental "add item to outfit" mutation
  later would silently reopen the hole — so the absence of that mutation is itself
  the invariant.
- **`by_outfit_and_item` is not needed**, because the uniqueness decision removes
  its only would-be caller.
- **The zero-item outfit arises by exactly the same route as before** and keeps its
  domain term untouched.
- **Deleting an item also deletes its stored image file, in the same mutation** —
  see ADR-0018, which is what makes that safe.
- **`userId` is denormalized onto the join table** so every authz check is a field
  comparison rather than a parent fetch. It cannot drift, because a join row's owner
  never changes.
