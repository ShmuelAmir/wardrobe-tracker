import { asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from './client';
import { item, outfit, outfitItem, wearEvent, type Category, type Item, type Outfit } from './schema';

/**
 * Every item, newest first — the Wardrobe grid's backing query. This is only
 * §9.6's default `recent` sort; the category filter and the `most`/`least`
 * sorts arrive as nav params with the Stats "See all →" entry point, which is
 * the ticket that gives them somewhere to be set from.
 *
 * `createdAt` is ms-granular, so two items saved in the same millisecond would
 * otherwise order arbitrarily; `id` breaks the tie the same way §9.7's queries
 * do.
 *
 * `useLiveQuery` re-runs this whenever a write touches the table, so callers
 * never refresh by hand. Screens go through this hook rather than reaching for
 * `db` directly, which keeps the reactive path the only path.
 */
export function useItems(): { items: Item[]; loading: boolean } {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(item)
      .orderBy(desc(item.createdAt), desc(item.id)),
  );

  // `data` is `[]` both before the first read resolves and for a genuinely
  // empty wardrobe; `updatedAt` is what tells the two apart. Getting this wrong
  // flashes the zero-state hero on every cold start.
  return { items: data ?? [], loading: updatedAt === undefined };
}

/**
 * §6.2 — the occasion chip vocabulary, **built from the user's own history**,
 * not a shipped enum. Most-used first, alphabetical tiebreak, capped at 8, so
 * the Save sheet stays in thumb reach at outfit #200. `COLLATE NOCASE` on the
 * group is what folds `work`/`Work` into one chip; normalization at save
 * (§6.2) is what keeps that fold honest.
 *
 * A fresh install has zero outfits, so this returns `[]` — the Save sheet is a
 * bare text field until outfit #2, with **no seeding** (§6.2).
 */
export const OCCASION_CHIP_CAP = 8;

/**
 * The §6.2 vocabulary query, extracted so it can be run against a real SQLite in
 * tests: most-used first, alphabetical tiebreak, capped, `COLLATE NOCASE` on the
 * group to fold `work`/`Work` into one chip. Typed against the app db, but any
 * drizzle-sqlite connection satisfies the same builder API.
 */
export function occasionChipsQuery(database: typeof db) {
  return database
    .select({ occasion: outfit.occasion })
    .from(outfit)
    .where(isNotNull(outfit.occasion))
    .groupBy(sql`${outfit.occasion} collate nocase`)
    // Same NOCASE collation on the tiebreak as on the group, so equal-count
    // chips sort truly alphabetically rather than ASCII (uppercase-first).
    .orderBy(desc(count()), asc(sql`${outfit.occasion} collate nocase`))
    .limit(OCCASION_CHIP_CAP);
}

export function useOccasionChips(): string[] {
  const { data } = useLiveQuery(occasionChipsQuery(db));

  return (data ?? [])
    .map((row) => row.occasion)
    .filter((occasion): occasion is string => occasion !== null);
}

/**
 * A single outfit and its items — the landing target after Save (§6.1.5). Full
 * Detail (wear logging, stats strip, edit) is §8.5's ticket; this is the read
 * that lets Save arrive somewhere real. `null` outfit means the id doesn't
 * resolve; `loading` distinguishes a pre-read blank from a genuine miss.
 */
export type OutfitDetail = { outfit: Outfit; items: Item[] };

export function useOutfitDetail(id: number): { detail: OutfitDetail | null; loading: boolean } {
  const outfitQuery = useLiveQuery(db.select().from(outfit).where(eq(outfit.id, id)));
  const itemsQuery = useLiveQuery(
    db
      .select()
      .from(outfitItem)
      .innerJoin(item, eq(outfitItem.itemId, item.id))
      .where(eq(outfitItem.outfitId, id)),
  );

  const loading = outfitQuery.updatedAt === undefined || itemsQuery.updatedAt === undefined;
  const row = outfitQuery.data?.[0];
  const items = (itemsQuery.data ?? []).map((joined) => joined.item);

  return { detail: row ? { outfit: row, items } : null, loading };
}

/**
 * §8.5 stats strip — times worn / first worn / last worn, **all derived** from
 * `wear_event`, never stored (§3 rule 7). `count()` reads 0 and `min`/`max` read
 * `null` for an outfit never worn, so the strip needs no separate empty case.
 * Extracted as a pure query so it runs against a real SQLite in tests.
 */
export type OutfitStats = { timesWorn: number; firstWorn: string | null; lastWorn: string | null };

export function outfitStatsQuery(database: typeof db, id: number) {
  return database
    .select({
      timesWorn: count(),
      firstWorn: sql<string | null>`min(${wearEvent.wornOn})`,
      lastWorn: sql<string | null>`max(${wearEvent.wornOn})`,
    })
    .from(wearEvent)
    .where(eq(wearEvent.outfitId, id));
}

export function useOutfitStats(id: number): OutfitStats {
  const { data } = useLiveQuery(outfitStatsQuery(db, id));
  const row = data?.[0];
  return {
    timesWorn: row?.timesWorn ?? 0,
    firstWorn: row?.firstWorn ?? null,
    lastWorn: row?.lastWorn ?? null,
  };
}

/**
 * §8.5 wear history sheet — one row per `wear_event`, newest day first (`id`
 * breaks a same-day tie, as §9.7's queries do). This is the durable un-log path:
 * each row carries its own event id so Remove deletes just that day's log.
 */
export type WearRow = { id: number; wornOn: string };

export function wearHistoryQuery(database: typeof db, id: number) {
  return database
    .select({ id: wearEvent.id, wornOn: wearEvent.wornOn })
    .from(wearEvent)
    .where(eq(wearEvent.outfitId, id))
    .orderBy(desc(wearEvent.wornOn), desc(wearEvent.id));
}

export function useWearHistory(id: number): WearRow[] {
  const { data } = useLiveQuery(wearHistoryQuery(db, id));
  return data ?? [];
}

/**
 * A single item's wear count — the §3 invariant made a query: **per wear-event**,
 * reaching the item through *every* outfit that contains it. Two outfits sharing
 * the item and both worn the same day count twice, intentionally. Joining
 * `outfit_item` to `wear_event` on the outfit id is what produces that double —
 * one join row per (containing outfit × its wear).
 */
export function itemWearCountQuery(database: typeof db, itemId: number) {
  return database
    .select({ count: count() })
    .from(outfitItem)
    .innerJoin(wearEvent, eq(wearEvent.outfitId, outfitItem.outfitId))
    .where(eq(outfitItem.itemId, itemId));
}

/**
 * §8.1 item detail — the read-only page's single item, rooted at `item` so an
 * §8.2 edit (name, category, season, replaced photo) re-runs it in place. `null`
 * item means the id doesn't resolve; `loading` distinguishes a pre-read blank
 * from a genuine miss, the same trap `useItems`/`useOutfitDetail` guard.
 */
export function useItemDetail(id: number): { item: Item | null; loading: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(item).where(eq(item.id, id)));
  return { item: data?.[0] ?? null, loading: updatedAt === undefined };
}

/**
 * §8.1 stats strip — an item's wear count and last-worn day, both derived from
 * `wear_event` reached through *every* outfit that contains the item, never
 * stored (§3 rule 4/7). Rooted at `wear_event` so a wear logged anywhere re-runs
 * it; the inner join to `outfit_item` is what both scopes the events to this
 * item and produces the §3 double-count when two containing outfits are worn the
 * same day (one join row per containing outfit × its wear). An item never worn
 * yields an empty join, so `count()` reads 0 and `max` reads `null` with no
 * separate empty case — the same shape as `outfitStatsQuery`.
 */
export type ItemStats = { wearCount: number; lastWorn: string | null };

export function itemStatsQuery(database: typeof db, itemId: number) {
  return database
    .select({
      wearCount: count(),
      lastWorn: sql<string | null>`max(${wearEvent.wornOn})`,
    })
    .from(wearEvent)
    .innerJoin(outfitItem, eq(outfitItem.outfitId, wearEvent.outfitId))
    .where(eq(outfitItem.itemId, itemId));
}

export function useItemStats(itemId: number): ItemStats {
  const { data } = useLiveQuery(itemStatsQuery(db, itemId));
  const row = data?.[0];
  return { wearCount: row?.wearCount ?? 0, lastWorn: row?.lastWorn ?? null };
}

/**
 * §8.1 "In outfits" rail — the outfits containing this item, each tapping
 * through to its own detail. Rooted at `outfit_item` so adding or removing the
 * item from an outfit re-runs it; the cover is the same lowest-id-item read the
 * cards use (§7.1), written as literal table-qualified SQL for the reason
 * `outfitCoversQuery` spells out. Newest outfit first, matching the app's other
 * lists. An item in no outfit yields `[]` — the rail's empty case, which the
 * screen renders as the copy that *explains* a zero wear count.
 */
export type ItemOutfit = { id: number; name: string | null; coverImage: string | null };

export function itemOutfitsQuery(database: typeof db, itemId: number) {
  return database
    .select({
      id: outfit.id,
      name: outfit.name,
      coverImage: sql<string | null>`(
        select item.image_file
        from outfit_item
        join item on item.id = outfit_item.item_id
        where outfit_item.outfit_id = outfit.id
        order by item.id
        limit 1
      )`,
    })
    .from(outfitItem)
    .innerJoin(outfit, eq(outfit.id, outfitItem.outfitId))
    .where(eq(outfitItem.itemId, itemId))
    .orderBy(desc(outfit.id));
}

export function useItemOutfits(itemId: number): ItemOutfit[] {
  const { data } = useLiveQuery(itemOutfitsQuery(db, itemId));
  return data ?? [];
}

/**
 * §8.3/§8.4 — everything the **item** delete confirm is allowed to claim: the
 * containing outfits, each with its own item count and wear count. The item
 * count is what identifies a §8.4 last-item outfit (`itemCount === 1`); the wear
 * count is the history that cleaning that outfit up would cost, and the confirm
 * is never silent about it.
 *
 * A one-shot read, not a hook: the confirm is a single alert raised on a tap,
 * and it must describe the wardrobe **at the moment of the tap** rather than
 * re-render under the user.
 *
 * Newest outfit first, matching the "In outfits" rail, so the names in the
 * confirm arrive in the order the item's own detail page just showed them.
 */
export function itemDeleteImpactQuery(database: typeof db, itemId: number) {
  return database
    .select({
      id: outfit.id,
      name: outfit.name,
      // Literal, table-qualified SQL for the reason `outfitCoversQuery` spells
      // out: interpolated columns render unqualified inside a raw `sql`
      // template, which would leave the correlation to the outer `outfit`
      // ambiguous against the joined `outfit_item`.
      itemCount: sql<number>`(
        select count(*) from outfit_item where outfit_item.outfit_id = outfit.id
      )`,
      wearCount: sql<number>`(
        select count(*) from wear_event where wear_event.outfit_id = outfit.id
      )`,
    })
    .from(outfitItem)
    .innerJoin(outfit, eq(outfit.id, outfitItem.outfitId))
    .where(eq(outfitItem.itemId, itemId))
    .orderBy(desc(outfit.id));
}

/**
 * §8.3 — everything the **outfit** delete confirm is allowed to claim: the wear
 * count that will cascade away, and the item count whose derived wear counts
 * will therefore drop. Rooted at `outfit` so a garment-less, never-worn outfit
 * (§8.4) still reads a row of zeros rather than nothing at all.
 */
export function outfitDeleteImpactQuery(database: typeof db, id: number) {
  return database
    .select({
      itemCount: sql<number>`(
        select count(*) from outfit_item where outfit_item.outfit_id = outfit.id
      )`,
      wearCount: sql<number>`(
        select count(*) from wear_event where wear_event.outfit_id = outfit.id
      )`,
    })
    .from(outfit)
    .where(eq(outfit.id, id));
}

/**
 * §7.1/§7.2 — the Outfits tab backing data: every outfit as a card carrying its
 * cover, item count, and the two derived wear facts (last worn, times worn) the
 * rail and list both sort and filter on. Wear stats are derived, never stored
 * (§3 rule 4), so they can only be read from `wear_event`.
 *
 * The tab needs *live* wear and membership data — "Wore it" and its Undo must
 * reorder the rail the instant they write, and an item delete (§8.3) must shrink
 * the item count under it — but `useLiveQuery` re-runs only when **its own `from`
 * table** changes (it tracks a single table). A wear touches `wear_event` and an
 * item delete cascades into `outfit_item`; neither touches `outfit`, so a single
 * query rooted at `outfit` would react to neither. That forces the three-way
 * split — identity from `outfit`, membership from `outfit_item`, wear facts from
 * `wear_event` — which `useOutfitCards` merges. Each write re-runs exactly the
 * read whose table it changed.
 */
export type OutfitRow = {
  id: number;
  name: string | null;
  occasion: string | null;
  createdAt: Date;
};

/** Every outfit's own row, rooted at `outfit` so a create/edit/delete re-runs it. */
export function outfitRowsQuery(database: typeof db) {
  return database
    .select({
      id: outfit.id,
      name: outfit.name,
      occasion: outfit.occasion,
      createdAt: outfit.createdAt,
    })
    .from(outfit);
}

/**
 * Per-outfit cover and item count, rooted at `outfit_item` so **deleting an item
 * re-runs it** (§8.3 — the cascade lands here, never on `outfit`). The cover is
 * the outfit's lowest-id item, a stable deterministic pick since the join
 * carries no rank (§6.1).
 *
 * Grouping over the join rows can't produce a garment-less outfit, exactly as the
 * wear aggregate can't produce a never-worn one; §8.4's zero-item outfit is
 * simply absent here and merged back in as `coverImage: null, itemCount: 0`,
 * which the card renders as a neutral tile rather than a broken image.
 */
export type OutfitMembership = { outfitId: number; coverImage: string | null; itemCount: number };

export function outfitMembershipsQuery(database: typeof db) {
  return database
    .select({
      outfitId: outfitItem.outfitId,
      // Written as literal, table-qualified SQL rather than drizzle column refs:
      // interpolated columns render **unqualified** inside a raw `sql` template,
      // which would leave the outer correlation ambiguous against the aliased
      // inner copy of the same table. Correlating on `outfit_item.outfit_id` is
      // safe inside the aggregate because it *is* the grouping key. The
      // identifiers are the schema's own table/column names (§3.2).
      coverImage: sql<string | null>`(
        select item.image_file
        from outfit_item member
        join item on item.id = member.item_id
        where member.outfit_id = outfit_item.outfit_id
        order by item.id
        limit 1
      )`,
      itemCount: count(),
    })
    .from(outfitItem)
    .groupBy(outfitItem.outfitId);
}

/**
 * Per-outfit wear aggregate, rooted at `wear_event` so a logged or un-logged
 * wear re-runs it. Only outfits with `≥ 1` wear appear — grouping over the
 * events themselves can't produce a never-worn outfit — which is exactly the
 * rail's `wears ≥ 1` scope (§7.1); the never-worn outfits are supplied by the
 * outfit rows read and merged back in as `timesWorn: 0`.
 */
export type WearAggregate = { outfitId: number; lastWorn: string | null; timesWorn: number };

export function outfitWearAggregatesQuery(database: typeof db) {
  return database
    .select({
      outfitId: wearEvent.outfitId,
      lastWorn: sql<string | null>`max(${wearEvent.wornOn})`,
      timesWorn: count(),
    })
    .from(wearEvent)
    .groupBy(wearEvent.outfitId);
}

export type OutfitCard = OutfitRow & {
  coverImage: string | null;
  itemCount: number;
  lastWorn: string | null;
  timesWorn: number;
};

/**
 * §7.2 sort — `last_worn DESC NULLS LAST`: worn outfits newest-first, then
 * **every** never-worn outfit below regardless of created date (`COALESCE(last_worn,
 * created)` was rejected, §7.2). `worn_on` is `YYYY-MM-DD`, so a plain string
 * compare is a date compare. A same-day tie (and the never-worn bucket) falls
 * back to newest outfit first, which keeps the order stable and deterministic.
 */
function compareCards(a: OutfitCard, b: OutfitCard): number {
  if (a.lastWorn !== b.lastWorn) {
    if (a.lastWorn === null) return 1;
    if (b.lastWorn === null) return -1;
    return a.lastWorn < b.lastWorn ? 1 : -1;
  }
  return b.id - a.id;
}

/**
 * Join the three reads and apply the §7.2 sort. The outfit rows drive the set —
 * an outfit missing from *either* aggregate is a real outfit with nothing to
 * aggregate, so it defaults to a garment-less (§8.4) and/or never-worn card
 * rather than disappearing.
 */
export function mergeOutfitCards(
  rows: OutfitRow[],
  memberships: OutfitMembership[],
  aggregates: WearAggregate[],
): OutfitCard[] {
  const membershipOf = new Map(memberships.map((row) => [row.outfitId, row]));
  const wearsOf = new Map(aggregates.map((row) => [row.outfitId, row]));
  return rows
    .map((row) => {
      const membership = membershipOf.get(row.id);
      const wears = wearsOf.get(row.id);
      return {
        ...row,
        coverImage: membership?.coverImage ?? null,
        itemCount: membership?.itemCount ?? 0,
        lastWorn: wears?.lastWorn ?? null,
        timesWorn: wears?.timesWorn ?? 0,
      };
    })
    .sort(compareCards);
}

/** The rail shows at most the 5 most recently worn outfits (§7.1). */
export const WEAR_AGAIN_RAIL_SIZE = 5;

export function useOutfitCards(): { cards: OutfitCard[]; loading: boolean } {
  const rows = useLiveQuery(outfitRowsQuery(db));
  const memberships = useLiveQuery(outfitMembershipsQuery(db));
  const aggregates = useLiveQuery(outfitWearAggregatesQuery(db));

  // Every read must have resolved once; any still `undefined` is a genuine
  // pre-read blank, not an empty tab (same trap as `useItems`).
  const loading =
    rows.updatedAt === undefined ||
    memberships.updatedAt === undefined ||
    aggregates.updatedAt === undefined;

  const cards = useMemo(
    () => mergeOutfitCards(rows.data ?? [], memberships.data ?? [], aggregates.data ?? []),
    [rows.data, memberships.data, aggregates.data],
  );

  return { cards, loading };
}

/**
 * §9 Stats — the per-item wear aggregate, rooted at `wear_event` so a logged or
 * un-logged wear re-runs it (the tab is read-only, but a wear logged on the
 * Outfits tab must be reflected when this one is already mounted — the same
 * single-table `useLiveQuery` constraint that forces the §7 covers/aggregate
 * split). Grouping over the events themselves can't produce a never-worn item,
 * so only worn items appear here; the never-worn set is every item **without** a
 * row here, supplied by the items read and split back in JS (§9.7).
 *
 * `wearCount` is **per wear-event, reaching the item through every outfit that
 * contains it** (§3 rule): joining `outfit_item` to `wear_event` on the outfit
 * id yields one row per (containing outfit × its wear), so an item in two
 * outfits both worn the same day counts twice — intentionally.
 */
export type ItemWearAggregate = { itemId: number; wearCount: number; lastWorn: string };

export function itemWearAggregatesQuery(database: typeof db) {
  return database
    .select({
      itemId: outfitItem.itemId,
      wearCount: count(wearEvent.id),
      lastWorn: sql<string>`max(${wearEvent.wornOn})`,
    })
    .from(wearEvent)
    .innerJoin(outfitItem, eq(outfitItem.outfitId, wearEvent.outfitId))
    .groupBy(outfitItem.itemId);
}

/** A worn item carries its two derived facts alongside the full item row. */
export type WornItem = Item & { wearCount: number; lastWorn: string };

/** `null` = the `All` scope; otherwise the six categories (§9.1). */
export type StatsScope = Category | null;

/**
 * Most worn: `wear_count DESC, last_worn DESC, id DESC` (§9.2). `worn_on` is
 * `YYYY-MM-DD`, so a string compare is a date compare. `id` never renders — it's
 * the deterministic final tiebreak that stops a live re-render reshuffling tied
 * rows.
 */
function mostWornOrder(a: WornItem, b: WornItem): number {
  return b.wearCount - a.wearCount || b.lastWorn.localeCompare(a.lastWorn) || b.id - a.id;
}

/**
 * Least worn: the **exact reverse** of `mostWornOrder`, including the `id`
 * direction (§9.2). The reversal is load-bearing, not cosmetic: it's the only
 * thing that keeps the two `floor(n/2)` slices disjoint when rows tie fully —
 * `id ASC` in both lists would put the same item first in each.
 */
function leastWornOrder(a: WornItem, b: WornItem): number {
  return a.wearCount - b.wearCount || a.lastWorn.localeCompare(b.lastWorn) || a.id - b.id;
}

/**
 * Split a scoped item set into the worn set (with derived facts, most-worn
 * order) and the never-worn set (oldest created first, §9.3). An item is worn
 * iff it has an aggregate row; never-worn is the complement, so no separate
 * `notExists` query is needed.
 */
export function partitionWear(
  items: Item[],
  aggregates: ItemWearAggregate[],
): { worn: WornItem[]; neverWorn: Item[] } {
  const byItem = new Map(aggregates.map((row) => [row.itemId, row]));
  const worn: WornItem[] = [];
  const neverWorn: Item[] = [];
  for (const row of items) {
    const agg = byItem.get(row.id);
    if (agg) worn.push({ ...row, wearCount: agg.wearCount, lastWorn: agg.lastWorn });
    else neverWorn.push(row);
  }
  worn.sort(mostWornOrder);
  neverWorn.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  return { worn, neverWorn };
}

/**
 * The two leaderboards from the worn set (§9.2). `k = min(5, floor(n/2))` caps
 * both to guarantee **no item is ever in both** — unfiltered the cap never
 * binds, filtered it's the normal case. Edge cases fall out: `n = 1` → both
 * empty; `n = 2..3` → one row each.
 */
export function leaderboards(worn: WornItem[]): {
  k: number;
  mostWorn: WornItem[];
  leastWorn: WornItem[];
} {
  const k = Math.min(5, Math.floor(worn.length / 2));
  return {
    k,
    mostWorn: [...worn].sort(mostWornOrder).slice(0, k),
    leastWorn: [...worn].sort(leastWornOrder).slice(0, k),
  };
}

export type StatsData = {
  /** Worn items in scope — `n` in the §9.2 sizing rule. */
  wornCount: number;
  k: number;
  mostWorn: WornItem[];
  leastWorn: WornItem[];
  neverWorn: Item[];
};

/**
 * The whole Stats derivation for one category scope (§9): filter the items to
 * scope, split worn/never-worn, then size and slice the leaderboards. Pure, so
 * the invariants are testable without a render.
 */
export function computeStats(
  items: Item[],
  aggregates: ItemWearAggregate[],
  scope: StatsScope,
): StatsData {
  const inScope = scope ? items.filter((row) => row.category === scope) : items;
  const { worn, neverWorn } = partitionWear(inScope, aggregates);
  const { k, mostWorn, leastWorn } = leaderboards(worn);
  return { wornCount: worn.length, k, mostWorn, leastWorn, neverWorn };
}

/**
 * §9 Stats backing hook. Two live reads merged in JS: every item (reacts to
 * adds/edits) and the per-item wear aggregate (reacts to logs). `scope` filters
 * in JS — the wardrobe is personal-scale (§9.7), so one read serves every
 * segment of the category filter without a re-query.
 */
export function useStats(scope: StatsScope): { data: StatsData; loading: boolean } {
  const items = useLiveQuery(db.select().from(item));
  const aggregates = useLiveQuery(itemWearAggregatesQuery(db));

  const loading = items.updatedAt === undefined || aggregates.updatedAt === undefined;

  const data = useMemo(
    () => computeStats(items.data ?? [], aggregates.data ?? [], scope),
    [items.data, aggregates.data, scope],
  );

  return { data, loading };
}

/**
 * §4.6 — the database half of the startup orphan sweep's diff: every filename
 * a row still claims. One column over ~200 rows, which is what lets the sweep
 * be unconditional. Extracted like the other reads so it runs against a real
 * SQLite in tests.
 */
export function itemImageFilesQuery(database: typeof db) {
  return database.select({ imageFile: item.imageFile }).from(item);
}
