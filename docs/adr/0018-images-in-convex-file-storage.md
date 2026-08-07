# 18. Images live in Convex file storage

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0007](./0007-uuid-filenames-bare-filename-in-db.md) and [ADR-0008](./0008-fail-toward-orphan-startup-only-sweep.md)
- Owner: [#98 — Decide the image lifecycle without a filesystem](https://github.com/ShmuelAmir/wardrobe-tracker/issues/98), with research from [#89](https://github.com/ShmuelAmir/wardrobe-tracker/issues/89) and [#94](https://github.com/ShmuelAmir/wardrobe-tracker/issues/94); §4 of `SPEC.md`

## Context

Two ADRs existed to manage a filesystem the app no longer has. ADR-0007 gave every
image a UUID filename and stored only the bare filename in the database, so the
resolvable path was never persisted. ADR-0008 ordered saves file-first and deletes
row-first so the app would always fail toward a harmless **orphan** rather than a
user-visible **dangling reference**, and pinned the reconciliation sweep to app
startup — calling that timing load-bearing, because it is what ruled out the race
with an in-flight save.

**They are collapsed into one successor because #98 answered them as a single
question**, and because the filename/ordering seam that justified splitting them
does not exist once there is no filesystem.

## Decision

**Images live in Convex file storage. The row stores `image: v.id("_storage")` —
opaque identity — plus a denormalized `imageUrl` written once at insert.**

**Row and file die together.** `ctx.storage.delete()` was verified live to be fully
transactional inside a mutation: delete-then-throw leaves the file serving,
delete-then-commit 404s it. So the item row and its stored file are deleted in one
mutation, and **a dangling reference becomes unreachable by construction**.

**The denormalized URL is a measured trade, not a convenience.** The serving URL is
**not derivable** from the storage id — `getUrl` returns an unrelated opaque UUID —
so the alternative was a `_storage` read per item, per reactive re-run.

**The storage id is kept alongside the URL, and that is ADR-0007's principle
surviving its mechanism**: store opaque identity, never a resolvable path, because
paths rot. It is what makes the accepted cost — the URL embeds the deployment domain
— a one-line backfill rather than a data migration.

**The orphan sweep becomes a daily cron with a 24-hour age threshold**, reversing
ADR-0008's "never on a timer, never in the background".

## Consequences

- **Cross-cutting invariant #2 changes category, not just wording.** "Always fail
  toward an orphan, never toward a dangling reference" stops being an **ordering
  rule the implementation must obey** and becomes a **structural claim about what
  the platform permits**. ADR-0008's row-first/file-first table has no analog to
  port, because there is no ordering left to get wrong.
- **The timer reversal is legitimate, not a regression, and the reason is
  specific.** ADR-0008 banned timers because the startup pin ruled out the
  file-exists-before-row race *by construction*. `_creationTime` retires that
  reason: an age threshold rules the race out the same way. A web app also has no
  "startup" worth the name.
- **Orphan volume is held down at the source.** Upload happens **on wizard submit,
  not on file pick** — the Blob is already in hand, so Review previews from
  `createObjectURL` for free — and a failed insert **retries carrying the same
  `storageId`**, per ADR-0010.
- **The backfill this ADR would otherwise owe does not exist.** Production is stood
  up empty as the first cutover step, so no `imageUrl` is ever stale.
- **A stale `imageUrl` is not a dangling reference.** The impossibility above
  covers row↔file; the weaker row↔URL link is a render-path concern that shows the
  **category placeholder** — which is why ADR-0008's placeholder survives, and why
  the glossary keeps one term rather than growing a second.
- **There is no caching work available, and this was measured rather than
  assumed.** Convex documents no CDN and no default `Cache-Control`; `getUrl()`
  turns out to send `cache-control: private, max-age=2592000` undocumented, so warm
  repeat views already cost zero egress; and a custom HTTP action serving `public,
  max-age=1y, immutable` measured `cf-cache-status: DYNAMIC` three times running —
  Convex's zone does not edge-cache HTTP action responses at all, and a custom route
  costs *more* per miss. The browser cache is the only cache obtainable and `getUrl`
  already gets it. **The remaining lever is image size**, which is why ADR-0006's
  target drops to ~1200px.
- **Egress, not storage, is the binding free-tier constraint** — 1 GB/month against
  a 1 GB store that would hold ~6–7k items. Cold loads spend it; there is no
  caching work to reduce them.
- **The sweep is testable**, via `convex-test`'s
  `finishInProgressScheduledFunctions` — which is part of why the DB integration
  tier ports rather than dies.
