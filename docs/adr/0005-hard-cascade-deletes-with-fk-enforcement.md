# 5. Hard cascade deletes with foreign keys enforced

- Status: Accepted
- Date: 2026-07-17
- Owner: [#4 — Finalize data model & Drizzle schema](https://github.com/ShmuelAmir/wardrobe-tracker/issues/4); §3.1 of `SPEC.md`

## Context

Items and outfits are joined many-to-many, and wear events hang off outfits.
Deleting either end needs a defined, predictable effect on the rest of the graph.
Soft-delete flags were an option but add a "deleted but present" state to every
query for a single-user app that genuinely wants things gone.

## Decision

**Hard cascade deletes, both directions, with foreign keys enforced.**

- Delete an **item** → its `outfit_item` rows cascade. Outfits **survive minus that
  garment**; wear history (which hangs off the outfit) is **untouched**.
- Delete an **outfit** → its `outfit_item` **and** `wear_event` rows cascade.
- The UI confirms with the concrete impact before any hard delete (N outfits /
  N wears).

Related schema rules decided alongside:

- **Category** is a fixed 6-value enum stored as `text`, validated in TS, with
  **no SQLite `CHECK` constraint** — so new values stay cheap to add by migration.
- **`outfit_item`** uses composite PK `(outfit_id, item_id)` — an item at most once
  per outfit.

## Consequences

- **`PRAGMA foreign_keys = ON` on every connection.** expo-sqlite defaults it
  **OFF**, and without it *none* of these cascades fire. This is load-bearing for
  the entire delete story — a cross-cutting invariant.
- The delete confirmations are deliberately asymmetric and honest to this schema:
  deleting an item is nearly harmless (history survives); deleting an outfit
  destroys history (its wears cascade). The copy says so.
- SQL cascades delete **rows only** — SQLite knows nothing about image files. Files
  are the app's responsibility, on a specific ordering (ADR-0008).
- An outfit can legally outlive all its garments (a 0-item outfit whose wears still
  count); the last-item delete offers cleanup but never does it silently.
