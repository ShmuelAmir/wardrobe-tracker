# 11. Occasion is a self-building free-text vocabulary; outfits have no season

- Status: Accepted
- Date: 2026-07-17
- Owner: [#6 — Prototype: outfit builder](https://github.com/ShmuelAmir/wardrobe-tracker/issues/6), amended/completed by [#12](https://github.com/ShmuelAmir/wardrobe-tracker/issues/12), [#14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14); §6.2, §6.3 of `SPEC.md`

## Context

Outfits need tagging so the user can find and filter them. Two candidate tag
dimensions were on the table: **occasion** and **season**. Category (on items) works
as a fixed enum because garment categories are universal — the question was whether
outfit tags could be modeled the same way.

## Decision

**Occasion: single-value free text, with a chip vocabulary built from the user's own
history.**

- Chips act as **radio buttons**: tapping one replaces the pick; tapping the active
  chip clears it (occasion is optional). Filtering is a plain `WHERE occasion = ?`.
- The vocabulary is the top-8 most-used occasions from existing outfits
  (`most-used first, tiebreak alphabetical, cap 8`) — **not a shipped enum.**
  Occasions are *personal* ("shul", "school run", "gigs"); any list in code is wrong
  for someone, and there is exactly one user.
- **Normalization on save is required** (the chip UI depends on it): trim + collapse
  whitespace, match case-insensitively against existing occasions; on a hit store
  the **existing** spelling, else store as typed. **First spelling wins and becomes
  canonical** — no forced casing (which would mangle `NYE` → `Nye`).
- **No seeding.** A fresh install has zero outfits → zero chips. Seeding starter
  chips would smuggle back the invented vocabulary just rejected.

**Outfits have no season.** Season chips are not on the Save sheet; season tags are
not in the Detail header. `occasion` carries outfit tagging alone.

- **Season is a property of a garment, not of a look** — items already carry it, and
  in v1 nothing consumes an outfit season.
- **Deriving outfit season was rejected on the data, not on taste.** The
  derived-stats precedent (ADR-0004) doesn't transfer: `item.season` is nullable and
  mixed-season outfits are normal, so both union *and* intersection return garbage
  (e.g. `[summer]` + `[fall]` + `null`). Derived wear-stats work only because
  `wear_event` rows are unambiguous; seasons are not.

## Consequences

- The vocabulary is **self-cleaning** — deleting the last outfit tagged "Gym"
  retires the "Gym" chip. Correct, follows necessarily.
- **No cross-outfit rename** in v1 — fixing a typo means editing each outfit that
  uses it. Normalization prevents the common (casing) case; a single user's typo is
  a visible, low-frequency, self-inflicted problem, not worth a management surface.
- An **occasion filter on the Outfits list** is a known v2 ask and cheap — the
  vocabulary query already exists (§7.4).

## Amendment (2026-08-07) — one mechanism change: matching loses `collate nocase`

This is the thinnest disposition on the replatform ledger, and the only ADR whose
*reasoning* turned out to be entirely storage-independent. The chips-as-radio-buttons
behaviour, the top-8 most-used-first / alphabetical-tiebreak / cap-8 vocabulary, no
seeding, first-spelling-wins canonicalization, the self-cleaning consequence, the
absence of a cross-outfit rename, and the whole outfits-have-no-season argument all
port with **no edits**.

One mechanism moves. **Case-insensitive occasion matching loses `collate nocase`**:
that was a SQLite collation, and Convex has no equivalent. Since normalization-on-save
*depends* on the case-insensitive match — it is what makes `WORK` reuse `Work` while
never mangling `NYE` to `Nye` — the match has to survive in some form.

**Decided: collect the outfits in the mutation and match in JS.** A stored
normalized `occasionKey` field was considered and rejected: a second field that must
stay in lockstep with the display spelling earns nothing at a few hundred outfits,
and it would put a concept in the schema the domain has no word for.

Filtering moves from `WHERE occasion = ?` to an indexed query plus a JS comparison.
The known-v2 occasion filter on the Outfits list stays cheap.
