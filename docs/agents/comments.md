# Comments

What to write in a comment, and how much. This repo runs comment-dense on
purpose — the code is read cold, often by an agent with no memory of why a line
is the way it is. The point of this doc is not *fewer* comments; it is comments
that stay true.

## The one rule

**A comment explains the world as it is now.** It carries the reason a line
resists an obvious-looking change. It does **not** narrate how the line got
there — that is what git and GitHub Issues are for, and it is the part that
silently goes stale.

So: no "was", no "used to", no "#74 retired this", no "moved to `danger` in
#78". Write the standing fact, in the present tense, and let `git log -p` and
`gh issue view` hold the history.

```ts
// ✗ changelog — decays, and git already has it
// #74 redrew the gradient onto the indigo system and retired the old `onHero`
// role with it: the hero is no longer a dark brand block in both themes, so its
// title now reads off `textPrimary` like any other surface content.

// ✓ standing fact — same information, no expiry date
// The hero is a tinted well on the screen surface, not a brand block, so its
// content reads off the ordinary `textPrimary`/`textSecondary` roles.
```

The exception is a **live trap** — a hazard the next change would walk into.
Those keep whatever detail they need, including a ticket link if the ticket is
where the evidence lives:

```ts
// ✓ trap — the number is the point, and it binds a future change
// Light `warning` measures ~4.1:1 on `background`, below AA. A new consumer has
// to deepen the primitive first and add the pair to `__tests__/contrast.test.ts`.
```

## What always earns its place

- **Invariants and their consequence.** "`createdAt` is ms-granular, so two
  items saved in the same millisecond would otherwise order arbitrarily; `id`
  breaks the tie."
- **Spec anchors.** A `§` reference into `SPEC.md` (or `ADR-00NN`) is the
  cheapest comment in the repo — one token, points at the authority. Keep these
  freely.
- **The non-obvious mechanism.** Why `COLLATE NOCASE` is on the *group* and not
  just the sort. Why a join produces an intentional double-count.
- **The distinction a reader will get wrong.** "`data` is `[]` both before the
  first read resolves and for a genuinely empty wardrobe; `updatedAt` is what
  tells the two apart."

## What never does

- Restating the code (`// The light role map, expressed as roles`).
- Restating the type signature in a `@param`/`@returns` when TS already says it.
- Section banners (`// ---- helpers ----`).
- A test header that repeats the `it(...)` string.

## Budget by layer

Density should track how much invariant a file actually carries.

| Layer | Budget |
|---|---|
| `src/db/`, `src/theme/`, pure logic (`item-save.ts`, `web-import.ts`, `orphan-sweep.ts`, …) | **Dense is correct.** Full doc block per exported symbol; inline comments on any non-obvious clause. These files hold the invariants. |
| `src/components/` | **One-sentence header** naming the component's job and any prop contract that isn't in the types. Inline comments only for a layout hack or a platform quirk. |
| `src/app/` (screens/routes) | **One-sentence header**: what the screen is and where it's reached from. Nav-param contracts count as invariants — keep those. |
| `__tests__/` | **Near-zero.** The `describe`/`it` strings carry the meaning. A comment only where the *setup* is non-obvious (a fake clock, a real-SQLite fixture, a deliberate race). |

A screen or component that genuinely needs a long block is usually telling you
the logic belongs in a testable module one layer down.

## Reviewing a change that touches comments

- [ ] No past-tense narration, no bare `#NN` changelog. (Live traps may cite a
      ticket; history may not.)
- [ ] Every comment describes the code as it stands after this change — no
      leftover sentence about the shape it replaced.
- [ ] Comment says *why*, not *what*; delete anything the signature already says.
- [ ] Density matches the layer budget above.
- [ ] `§`/ADR anchors still resolve to a real section.
