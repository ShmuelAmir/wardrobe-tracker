# Research: modeling relational wardrobe data in Convex's document store

Ticket: ShmuelAmir/wardrobe-tracker #91
Date: 2026-08-07
Scope: Mechanics and idioms for expressing the current relational model (`item`,
`outfit`, `outfit_item` composite-PK join, `wear_event` belonging to an outfit) in
Convex 1.43.0, eu-west-1, Free plan — for the replatform mapped in #87. This ticket
reports options and trade-offs only; the schema **decision** is separate ticket #97.

All claims are cited to primary sources: `docs.convex.dev`, the `@convex-dev/aggregate`
README, the installed `convex@1.43.0` package, and this repo's own
`convex/_generated/ai/guidelines.md` (Convex's current first-party guidance for this
exact installed version, which the tooling regenerates and which overrides training
data). Every claim is marked **[documented]** (quoted or paraphrased from a primary
source), **[inferred]** (reasoned from documented mechanics but not stated verbatim),
or **[unknown]** (primary sources didn't settle it).

---

## 1. Many-to-many: join documents vs embedded id arrays

**Documented recommendation: a separate join table, not an embedded array — and this
is a hard steer, not a stylistic preference.**

The repo's own generated guidelines state it as a rule, not advice:

> "Do not store unbounded lists as an array field inside a document (e.g.
> `v.array(v.object({...}))`). As the array grows it will hit the 1MB document size
> limit, and every update rewrites the entire document. Instead, create a separate
> table for the child items with a foreign key back to the parent." [documented,
> `convex/_generated/ai/guidelines.md`]

Convex's own best-practices docs describe both shapes existing side by side — "You can
create explicit join documents to represent many-to-many relationships... provides
flexibility and allows you to store additional metadata on the relationship itself,"
versus embedding "arrays of document IDs directly within documents" for the cases
where that's bounded and small [documented, docs.convex.dev/understanding/best-practices/relationship-structures].

Applied to `outfit_item`: an outfit's item list is unbounded in principle (nothing in
the domain caps it) and every wear-log or item-add would otherwise rewrite the whole
outfit document. A join table — one document per `(outfit, item)` pair, each carrying
`outfitId: v.id("outfits")` and `itemId: v.id("items")` — is the direct port of
today's `outfit_item` table, and is what the guidelines push toward.

**Read/write cost consequences at wardrobe scale (hundreds of items, low
thousands of wear events):**

- **Join-table reads** cost one indexed query per direction (e.g. "items in outfit
  X" via an index on `outfitId`; "outfits containing item Y" via an index on
  `itemId`), each returning a handful of small documents — the same two-hop pattern
  `queries.ts` already uses today (`outfitItem` joined to `item`/`wear_event`).
  [inferred from indexed-query mechanics, §3 below]
- **Embedded-array writes** would mean every `outfit_item` change patches the whole
  outfit document; at this scale (an outfit rarely exceeds a handful of items) the
  1MB ceiling is nowhere close, so the guideline's *size* argument barely bites — but
  its *reactivity* argument still does: a query subscribed to `outfits` would
  re-fire on every membership change to any outfit, not just the one that changed,
  because Convex's reactivity is table/query-scoped, not sub-document-scoped.
  [inferred]
- **Join-table reactivity** scopes a subscription to the exact rows a query's index
  range covers, so an item added to outfit A does not re-run a query already
  narrowed to outfit B. [inferred from query/index mechanics]

**Verdict for this ticket:** join table is both the documented-safe default and the
better reactivity fit; embedding is disqualified by the "unbounded list" rule
regardless of current small scale, since Convex's own guidance treats it as a
correctness rule, not a scale threshold.

---

## 2. Uniqueness constraints — what replaces the composite PK

**Documented: there is no database-enforced composite key, unique index, or
`CHECK`-equivalent in Convex. Uniqueness is convention-in-a-mutation only.**

> "Convex does **not provide** composite unique keys or database-enforced uniqueness
> constraints... this is validation-only, not enforcement." [documented,
> docs.convex.dev/understanding/best-practices/relationship-structures]

This is a **loud finding, not a footnote**: the domain glossary's own definition —
"**Outfit-item** — the join between an outfit and an item. Composite primary key
`(outfit_id, item_id)`: an item appears at most once per outfit" (`CONTEXT.md`) — has
no direct Convex mechanism. The `(outfit_id, item_id)` guarantee currently enforced by
SQLite's `PRIMARY KEY` becomes, on Convex, a **manual check-then-insert inside the
add-item-to-outfit mutation**: query the join table via an index on
`[outfitId, itemId]` for an existing row, and throw if one is found, before inserting.

The mitigating fact: Convex mutations are **full transactions** — "Convex mutations
are atomic," and the runtime serializes them via optimistic concurrency control
[documented, `convex/_generated/ai/guidelines.md` §Aggregate sync]. That means a
check-then-insert *inside a single mutation* is race-free the way it would not be in
a naively-written multi-statement SQL client — two concurrent "add this item to this
outfit" calls cannot both pass the check and both insert, because Convex's OCC will
retry/reject the loser. So the composite-PK guarantee is *recoverable* by convention,
just no longer *structural*: a bug in one mutation, or a second write path added
later that inserts into the join table directly, has nothing in the schema stopping
it from producing a duplicate.

A secondary, weaker tool: `.unique()` on a query throws if the query matches more than
one document [documented, `convex/_generated/ai/guidelines.md` §Query guidelines]. This
doesn't *prevent* a duplicate at write time, but it lets a read that assumes the
invariant (e.g. "the join row for this outfit+item") fail loudly rather than silently
picking one of several, which is a way to surface a violated invariant rather than
mask it.

**Domain-vocabulary flag:** "Outfit-item" as currently defined *is* its composite key
— the glossary entry states the uniqueness as the definition. Under Convex the term
still names the join document, but the uniqueness clause becomes a property the
*mutation layer* upholds, not the *storage layer*. Whether `CONTEXT.md`'s glossary
entry needs to be reworded to say so explicitly is a call for #97, but the underlying
mechanism genuinely changes, which is why this is flagged here rather than left
implicit.

---

## 3. Indexes — declaration, what they buy, and their limits

**Declaration** [documented, docs.convex.dev/database/reading-data/indexes/ and
`convex/_generated/ai/guidelines.md`]:

```ts
defineTable({ outfitId: v.id("outfits"), itemId: v.id("items") })
  .index("by_outfitId_and_itemId", ["outfitId", "itemId"])
  .index("by_itemId", ["itemId"])
```

- An index is an ordered list of fields; queries use `.withIndex("name", q =>
  q.eq("outfitId", x).eq("itemId", y))` to get a range scan instead of a table scan.
- **"Index fields must be queried in the same order they are defined."** Wanting both
  "items in outfit X" and "outfits containing item Y" needs **two separate indexes**
  (`by_outfitId`, `by_itemId`), not one two-field index reordered per query.
  [documented, `convex/_generated/ai/guidelines.md` §Schema guidelines]
- Naming convention the guidelines enforce: **"Always include all index fields in the
  index name"** — `["field1","field2"]` must be named `by_field1_and_field2`.
  [documented, same source]
- **`_creationTime` is silently appended as the final tiebreak column of every
  index** — an index on `["points"]` orders by `points`, then `_creationTime`; a plain
  table scan uses the implicit `by_creation_time` index. [documented,
  `convex/_generated/ai/guidelines.md` §Ordering]
- **Staged indexes**: adding an index to a large existing table normally blocks
  deploy until backfill completes; declaring `.index("by_field", { fields: ["field"],
  staged: true })` backfills asynchronously without blocking, but the index can't be
  *queried* until a later deploy removes the flag. [documented, same source] Not
  relevant at wardrobe scale (hundreds/thousands of rows) but worth knowing for the
  cutover deploy in #87.

**What indexes make cheap here:** exactly the two-hop reads `queries.ts` does today —
"items in outfit X" (index on `outfitId`), "wear events for outfit X" (index on
`outfitId` on `wear_event`), "outfits containing item Y" (index on `itemId`). A
composite index `by_outfitId_and_itemId` additionally makes the uniqueness check in
§2 a single indexed point-lookup rather than a scan.

**Limits** [documented, docs.convex.dev/production/state/limits — fetched as
current, applies to this deployment]:

| Limit | Value |
|---|---|
| Indexes per table | 32 |
| Fields per index | 16 |
| Index name length | 64 characters |
| Documents scanned per transaction | 32,000 |
| Data read per transaction | 16 MiB |
| Data written per transaction | 16 MiB |
| Documents written per transaction | 16,000 |

None of these are close to binding at wardrobe scale (four tables, well under a
dozen indexes total, hundreds/thousands of rows) — worth stating explicitly since it
rules out "will we hit a Convex ceiling" as a concern for #97.

---

## 4. Derived aggregates — the hard case

**Leading answer: at this scale, computing wear counts by reading and joining in a
query — the direct port of today's SQL aggregation — stays well inside Convex's
transaction limits, and is the simpler idiomatic default. `@convex-dev/aggregate` is
the documented idiomatic answer *only if/when* O(n) read-time aggregation becomes a
real cost, and it does not apply cleanly to a many-to-many-derived value like
per-item wear count without an added denormalization step — this is the genuine hard
case the ticket asked to investigate.**

### 4a. Plain read-time aggregation (no component)

Convex's own guidance is blunt about the naive approach's ceiling:

> "Never use `.collect().length` to count rows. Convex has no built-in count
> operator... When queries need aggregates over many rows — counts, sums,
> ranks/positions, or offset access, whole-table or within a key range — use the
> `@convex-dev/aggregate` component (O(log n) reads...)." [documented,
> `convex/_generated/ai/guidelines.md` §Query guidelines]

But "many rows" is the operative phrase. At wardrobe scale — hundreds of items, "a
few thousand" wear events (per the ticket's own framing) — a query that joins
`wear_event → outfit_item → item` and counts in JS reads at most a few thousand small
documents, far under the 32,000-documents-scanned / 16 MiB-read transaction ceiling
(§3 table). This is functionally the same shape as today's `itemWearAggregatesQuery`
in `src/db/queries.ts` (join `wear_event` to `outfit_item`, group by `itemId`), just
executed as a Convex query instead of a SQL aggregate — and it stays a genuinely
*derived, never-stored* read, upholding ADR-0004's stated invariant with the least
structural change.

### 4b. `@convex-dev/aggregate` — what it is and its real shape

[documented, github.com/get-convex/aggregate README, and
`convex/_generated/ai/guidelines.md` §Component guidelines. **Not installed** in this
repo yet — `node_modules/@convex-dev` currently has no packages — so this is
documentation-only, unverified against this project's actual dependency tree.]

- Mounted like any component: `app.use(aggregate)` in `convex/convex.config.ts`,
  multiple named instances for multiple aggregates (`app.use(aggregate, { name:
  "aggregateByItem" })`).
- `TableAggregate<{ Namespace, Key, DataModel, TableName }>` is defined against **one
  source table**, with a `sortKey: (doc) => ...` function computed **from that
  table's own document fields**, and an optional `namespace: (doc) => ...` to
  partition the structure (e.g. one sub-aggregate per game in the README's
  leaderboard example).
- Claims **O(log n)-time** `count()`, `sum()`, `at(index)` (offset access), and
  `indexOf(key)` (rank), "instead of the O(n) that would result from naive usage of
  `.collect()`."
- **Must be kept in sync with the source table in the same mutation as every write**
  — insert/patch/delete on the table is paired with `aggregate.insert` /
  `aggregate.replace` / `aggregate.delete` in the identical mutation, "because Convex
  mutations are atomic," never from a separate function. This is a documented rule,
  not a suggestion — drift between the table and the aggregate is exactly the
  ADR-0004 failure mode ("no denormalized counter can ever drift from reality...
  there is nothing to keep in sync") reintroduced *unless* every write path is
  disciplined about the pairing.
- Read cost per operation is stated qualitatively ("a few documents instead of every
  document," a tree-like internal structure) but **no exact document-read count per
  operation is given in the fetched documentation** [unknown — the README doesn't
  quote a number, and no aggregate package is installed locally to inspect].

### 4c. Why per-item wear count is the hard case, specifically

`TableAggregate`'s `sortKey` is a function of **one document from one table**. Wear
count, though, is not a field of any single `wear_event`, `outfit`, or `item`
document — it's the join-path count "reaching the item through every outfit that
contains it" (CONTEXT.md's own definition), i.e. a value computed *across* the
`outfit_item ↔ wear_event` many-to-many, exactly the SQL join `itemWearCountQuery`
performs today. There is no single table whose documents already carry "this item's
wear count" as a field to hand `sortKey`.

Two paths follow from that, both worth naming for #97 rather than picking one here:

- **Read-time join (§4a), no aggregate component.** Keeps the derived-never-stored
  invariant exactly as ADR-0004 states it, costs nothing extra to write, and is
  cheap enough at this scale (§4a). The "most worn / least worn" leaderboards
  (ADR-0012) would sort the resulting in-memory array in JS — an O(n log n) sort over
  at most a few hundred worn items, the same shape `leaderboards()` in
  `src/db/queries.ts` already does today.
- **Denormalize, then aggregate.** Introduce a new derived table — e.g. one row per
  `(itemId, wearEventId)` "wear-credit," fanned out by the wear-log mutation at write
  time (for a wear event on an outfit with 3 items, write 3 credit rows) — and run
  `TableAggregate` over *that* table with `namespace: (doc) => doc.itemId`, giving
  O(log n) `count()` per item and O(log n) rank/`at()` for leaderboards regardless of
  how large the wardrobe grows. This buys leaderboard scalability at the cost of: an
  extra table, a write-time fan-out (N extra writes per wear-log mutation, N = items
  in the outfit), and a synchronization obligation that is structurally the
  "denormalized counter" ADR-0004 rejected — mitigated, but not eliminated, by the
  same-transaction discipline in §4b.

**This is the loud finding for #97 to weigh:** the aggregate component is Convex's
idiomatic answer to "cheap derived aggregate," but it is idiomatic *for aggregates
native to a single table*. Wear count is native to a join. Using the component for
this specific derived value means either aggregating over the join table directly
(`outfit_item` — but that counts *outfit memberships*, not *wear events*, a different
number) or adding a new denormalized table purpose-built to carry the join result,
which is a real schema addition beyond a straight port of `item`/`outfit`/
`outfit_item`/`wear_event`.

---

## 5. What replaces FK cascade deletes

**Documented: nothing does, at the database level. Referential integrity is entirely
manual, and cascades are hand-written in mutation code.**

> "Convex delegates relationship complexity to developer code rather than providing
> database-level constraints, requiring manual validation and consistency management
> in mutations." ... "Referential integrity is entirely manual. Cascade deletes don't
> exist — you must manually implement deletion logic in mutations." [documented,
> docs.convex.dev/understanding/best-practices/relationship-structures]

`v.id("tableName")` is a **type-level** validator only — it type-checks that a field
holds an ID shaped for that table and guards against cross-table ID confusion, but
does **not** verify the referenced document still exists, and does **not** cascade
anything on delete [documented/inferred, `convex/_generated/ai/guidelines.md`
§Typescript guidelines + relationship-structures page above].

**What this means for ADR-0005's two cascade directions**, ported as explicit
mutation logic:

- **Delete an item** → the mutation must itself query the join table by the
  `by_itemId` index, delete every matching `outfit_item` row, and leave `wear_event`
  untouched (mirrors ADR-0005's "outfits survive minus that garment" rule).
- **Delete an outfit** → the mutation must query and delete every matching
  `outfit_item` row **and** every matching `wear_event` row (by an `outfitId` index
  on each).

The one thing that *does* carry over structurally: because a Convex mutation is a
single atomic transaction, a hand-written multi-step delete inside one mutation is
still all-or-nothing — there's no window where the item is gone but its join rows
survive, so the *atomicity* half of ADR-0005's guarantee survives even though the
*cascade* half is now application code rather than a database feature. Convex's own
guidelines flag the adjacent scaling concern: a mutation has a bounded documents-read/
written budget (§3 table), so bulk deletes on a table too large to fit one
transaction must batch and continue via `ctx.scheduler.runAfter` [documented,
`convex/_generated/ai/guidelines.md` §Query guidelines] — not a concern at wardrobe
scale, but the mechanism to know about if it ever were.

**Domain-vocabulary flag:** ADR-0005's cross-cutting invariant #1 in `CONTEXT.md`
("`PRAGMA foreign_keys = ON` on every connection... without it no cascade fires") has
no Convex analog to turn on — there is no pragma, no FK enforcement flag. The
invariant it protected (deletes cascade correctly) has to be re-stated as a property
of the delete mutations' code, most likely enforced by tests rather than a database
setting.

---

## 6. Document/field limits, validators, and the two closed-shape fields

**Numeric limits** [documented, docs.convex.dev/production/state/limits]:

| Limit | Value |
|---|---|
| Max document size | 1 MiB |
| Fields per document | 1,024 |
| Field name length (top-level) | 64 characters |
| Object nesting depth | 16 levels |
| Array elements | 8,192 max |

None of `item`, `outfit`, `outfit_item`, or `wear_event` come close on any axis — the
widest document (`item`) has ~7 fields; `Season` as an array caps at 4 real values
against an 8,192-element ceiling.

**Validator system** [documented, docs.convex.dev/database/schemas and
`convex/_generated/ai/guidelines.md`]: `v.*` builders type both `schema.ts` table
shapes and function `args`/return validators. Relevant primitives: `v.string()`,
`v.number()`, `v.boolean()`, `v.id(tableName)`, `v.array(values)`, `v.object({...})`,
`v.union(...)`, `v.literal(...)`, `v.optional(...)`.

**Category (closed 6-value enum)** — best typed as a literal union, which is
Convex's idiom for a closed set (there is no native `enum` type):

```ts
category: v.union(
  v.literal("Top"), v.literal("Bottom"), v.literal("Outerwear"),
  v.literal("Footwear"), v.literal("Accessory"), v.literal("Bag"),
)
```

Unlike the current SQLite schema — "validated in TypeScript rather than by a SQL
`CHECK` constraint" (schema.ts comment, CONTEXT.md glossary) — this **is** enforced
by Convex on every write, at the server, for every client (not just the one app
build): a document with a `category` outside the six literals fails schema
validation. This is a strict upgrade over today's TS-only enforcement, and a domain
note worth surfacing to #97: the ADR-0005-adjacent decision to skip a `CHECK`
constraint "so new values stay cheap to add by migration" was reasoning around
SQLite's specific migration friction — Convex's schema validators are a normal
code-and-redeploy change, so the original cost/benefit that led to *no* enforcement
may not transfer as-is.

**Season (JSON array on item only)** — a bounded array of the same literal union:

```ts
season: v.optional(v.array(
  v.union(v.literal("spring"), v.literal("summer"), v.literal("fall"), v.literal("winter"))
))
```

`v.optional(...)` replaces "column nullable, absent JSON means unset" — CONTEXT.md's
"null means unset, not year-round" rule carries over unchanged: an absent field (or
explicit `undefined`, which Convex normalizes toward `null`/absence per the
guidelines' Null-type note) is "unset," a 4-element array is "year-round," and there
is still deliberately no "all-season" literal.

---

## 7. Pagination and reactive query behaviour for a grid

**`usePaginatedQuery` / `.paginate()`** [documented,
docs.convex.dev/database/reading-data/paginated-queries and
`convex/_generated/ai/guidelines.md` §Pagination]:

```ts
export const listItems = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: (ctx, args) =>
    ctx.db.query("items").withIndex("by_creationTime").order("desc").paginate(args.paginationOpts),
});
```

- `paginationOpts` carries `numItems` (initial page-size *target*, not a guaranteed
  max under reactive pagination), a `cursor`, and optional `endCursor` /
  `maximumRowsRead` / `maximumBytesRead` bounds. The result carries `page`, `isDone`,
  `continueCursor`, and optional split-page fields for oversized pages.
- **Cursor-based, not offset-based** — matches Convex's reactive model rather than
  SQL's `LIMIT/OFFSET`.
- **Fully reactive per page, with an explicit size caveat:**

  > "Paginated queries are completely reactive. Your React components will
  > automatically rerender if items in your paginated list are added, removed or
  > changed." ... "If you request a page of 10 items and then one item is removed,
  > this page may 'shrink' to only have 9 items. Similarly if new items are added, a
  > page may 'grow' beyond its initial size." [documented,
  > docs.convex.dev/database/reading-data/paginated-queries]

For the Wardrobe grid specifically: logging or un-logging a wear, adding/removing an
item from an outfit, or deleting an item all live-update whichever page currently
shows the affected row — the same "no manual refresh, ever" property `useLiveQuery`
gives today, but per-loaded-page rather than per-table. The trade-off worth flagging
for #97: page boundaries are **not stable** across live writes ("may grow/shrink"),
which is a mild UX difference from today's SQLite reads (`useItems`, `useWardrobeItems`)
that always re-run as one full, freshly-sorted array — a paginated grid needs to
decide whether a shifting page boundary during a live re-sort (e.g. the
most/least-worn sort reordering under a fresh wear log) is acceptable or needs an
unpaginated `.take(n)` read instead, given the wardrobe's already-small scale.

---

## Findings requiring #97's attention (domain-vocabulary bends)

Per the ticket's instruction, these are flagged loudly because a Convex constraint
forces (or pressures) a domain term to bend, not left as a footnote:

1. **"Outfit-item" is defined by its composite-key uniqueness** in CONTEXT.md, and
   Convex has no structural equivalent (§2) — the guarantee moves from the schema to
   the mutation layer, recoverable via transactional check-then-insert but no longer
   enforced for every write path automatically.
2. **ADR-0005's cascade-delete invariant has no on/off switch to port** — there is no
   Convex analog to `PRAGMA foreign_keys = ON`; the cascades themselves become
   hand-written, tested mutation code (§5).
3. **Wear count's "derived, never stored" mechanism (ADR-0004) has two viable
   futures that pull in different directions** (§4c): stay derived via a read-time
   join (truest to the ADR's own reasoning, cheap at this scale) vs. adopt
   `@convex-dev/aggregate` over a *new* denormalized join-credit table for
   guaranteed-cheap leaderboards at any future scale (reintroduces a synchronized
   counter structurally similar to what ADR-0004 rejected, mitigated by
   transactional sync). This is the single biggest open question for #97 to
   adjudicate, not resolve here.

---

## Sources

- `convex/_generated/ai/guidelines.md` (this repo, pinned to installed `convex@1.43.0`) — function/schema/query/mutation/component/pagination/testing guidelines, fetched directly from the repo.
- https://docs.convex.dev/database/schemas — schema definition, `v.*` validators, literal unions.
- https://docs.convex.dev/database/reading-data/indexes/ — index declaration, range queries, ordering.
- https://docs.convex.dev/production/state/limits — document/table/transaction/function numeric limits.
- https://docs.convex.dev/understanding/best-practices/relationship-structures — join tables vs embedded arrays, referential integrity, uniqueness.
- https://docs.convex.dev/database/reading-data/paginated-queries — `usePaginatedQuery`, `.paginate()` reactivity.
- https://github.com/get-convex/aggregate (README, fetched via raw.githubusercontent.com) — `@convex-dev/aggregate` `TableAggregate`, `sortKey`/`namespace`, O(log n) claims, same-transaction sync requirement. **Not installed in this repo** — verify against `node_modules/@convex-dev/aggregate` if/when #97 selects it.
- `src/db/schema.ts`, `src/db/queries.ts`, `CONTEXT.md`, `docs/adr/0004-wear-stats-derived-never-stored.md`, `docs/adr/0005-hard-cascade-deletes-with-fk-enforcement.md`, `docs/adr/0012-stats-read-only-leaderboards-category-filter-disjoint.md` (this repo) — the existing relational model and invariants being ported.
- `research/expo-foundation.md` (this repo) — format precedent for this document.
