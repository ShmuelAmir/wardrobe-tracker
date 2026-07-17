# 10. Guided add-item wizard; never restart a flow, always carry state

- Status: Accepted
- Date: 2026-07-17
- Owner: [#5 — Prototype: add-item flow](https://github.com/ShmuelAmir/wardrobe-tracker/issues/5), with [#9](https://github.com/ShmuelAmir/wardrobe-tracker/issues/9), [#10](https://github.com/ShmuelAmir/wardrobe-tracker/issues/10), [#13](https://github.com/ShmuelAmir/wardrobe-tracker/issues/13), [#14](https://github.com/ShmuelAmir/wardrobe-tracker/issues/14); §5 of `SPEC.md`

## Context

Adding an item spans a source choice, image acquisition (with a network step on the
primary web path), and a metadata form. This flow has many failure points — offline,
a page with no usable image, denied camera/library permission. The naive handling
of each is an error screen that dumps the user back to the start.

## Decision

**A guided wizard — one decision per full screen, always-forward with per-step
Back** — chosen over a single bottom-sheet and an image-first variant for clarity on
the primary web-import path. The extra taps buy a flow that can't leave you lost.

Canonical path: source → paste link → confirm image → **Review & fill** → saved.
Camera/library replace steps 2–3; Review onward is identical.

**Governing principle: never restart a flow; always carry state.** Every failure
continues *forward* to Review, carrying what's already known:

- **Web-import dead-end** (no usable image) and **"None of these"** → continue to
  Review with a captured/picked image, carrying `source_url` (always — the user
  typed it) and parsed name/brand (when the parse returned them).
- **Failed step-3 download** → drops into the same "use a photo instead" branch; it
  adds **no new error state**.
- **Camera/library permission denial** → the *one* source tile is replaced in place
  by a "Turn it on in Settings →" card; the other two sources stay live, the step
  never changes, the flow never restarts. Permission denial is one source going
  quiet, not a dead end for the whole flow.

**Review & fill is a single screen with two modes** — Create (from the wizard) and
Edit (from an item's detail, per detail spec). Same fields, same chip picker, same
required/optional split (**Category is the only required field**). Edit adds
`Cancel`/`Save`, a bottom `Delete Item` row, and no metadata pre-fill.

## Consequences

- One flow, one Review screen, reused as the item editor and the replace-photo host
  — **no new surfaces**, just second entry points.
- **The app never offers a button that can't work** (a corollary applied app-wide):
  the Outfits `+` hides on an empty wardrobe; the gated Outfits zero state has no
  create button.
- Both principles ("never restart, carry state" and "no dead-can't-work button")
  are cross-cutting invariants that any new flow must uphold.
