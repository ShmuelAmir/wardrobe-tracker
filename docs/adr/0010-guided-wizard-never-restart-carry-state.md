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

## Amendment (2026-08-07) — ports intact; the hosting mechanism changes

This ADR survives the replatform **invariant and mechanism**, for the price of one
IndexedDB record. It gains real history semantics in exchange.

**The whole draft persists — parsed JSON *and* the image blob.** `AddItemDraftProvider`
held a live blob precisely because route params cannot carry a local file handle
cleanly; on web, reload is a normal user act rather than a crash, so accepting
reload-as-restart would plainly contradict this ADR. Persisting only the JSON was
rejected because it re-restarts the **expensive** half, making the user re-download
or re-pick an image they had already confirmed. Lifecycle: **one active record per
flow**, overwritten as the walk proceeds, dropped on successful save and on explicit
Cancel, kept indefinitely otherwise.

**The wizard gets real step routes, so browser Back is wizard Back.** This is
load-bearing rather than convenient: an installed standalone PWA has **no back
button**, so history must be driven by in-app affordances that agree with it. Every
nested surface therefore owns an explicit visible exit, and browser Back is an
*alias* for it, never the only way out. The wizard is a **modal** mounted as a child
of the app shell via React Router's `backgroundLocation`, whose no-background
fallback renders full-screen — which *is* the phone design, so the degraded path is
one we build anyway.

**The builder persists too, and there is still no confirm-on-leave dialog.** A
confirm dialog is a restart-or-lose prompt wearing a politeness costume — this ADR's
own failure mode in its own language. The Outfits `+` offers **"Resume outfit"**
instead of ever asking.

**The four sheets become a uniform `?sheet=` search param**, so "Back closes the
topmost open thing" is one rule rather than four behaviours.

Two clauses change substrate but not meaning:

- **Camera / library permission denial** loses its source tile, because camera
  capture is out of scope on web. The surviving instance of "one source going quiet,
  not a dead end" is a failed file pick.
- **Actions must return structured failure results rather than throwing**
  (ADR-0019) — a thrown error in an action is exactly the flow-restart this ADR
  bans. That obligation catches a **real bug that ports today**: the `FetchOutcome`
  catch classifies every throw as `retryable`, producing a Retry button that can
  never work. Fixed by one invisible auto-retry, then dead-end.

The corollary "the app never offers a button that can't work" survives untouched.
Notably, both Back-trap fixes turned out to be **already-shipped native behaviour
that ports verbatim**: `review.tsx` already `replace`s into `saved`, and three steps
already carry `<Redirect>` guards on a missing draft.
