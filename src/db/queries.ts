import { asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from './client';
import { item, outfit, outfitItem, wearEvent, type Item, type Outfit } from './schema';

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
 * §7.1/§7.2 — the Outfits tab backing data: every outfit as a card carrying its
 * cover, item count, and the two derived wear facts (last worn, times worn) the
 * rail and list both sort and filter on. Wear stats are derived, never stored
 * (§3 rule 4), so they can only be read from `wear_event`.
 *
 * The tab needs *live* wear data — "Wore it" and its Undo must reorder the rail
 * and list the instant they write — but `useLiveQuery` re-runs only when **its
 * own `from` table** changes (it tracks a single table). A wear touches
 * `wear_event`, not `outfit`, so a query rooted at `outfit` would never react to
 * a log. That forces the split: the covers read is rooted at `outfit`, the wear
 * aggregate at `wear_event`, and `useOutfitCards` merges them — so a wear log
 * re-runs the aggregate and the merge, and a new outfit re-runs the covers.
 */
export type OutfitCover = {
  id: number;
  name: string | null;
  occasion: string | null;
  createdAt: Date;
  coverImage: string | null;
  itemCount: number;
};

/**
 * Every outfit with its cover and item count, rooted at `outfit` so it reacts to
 * outfits being created, edited, or deleted. The cover is the outfit's
 * lowest-id item — a stable, deterministic pick (the join carries no rank, §6.1)
 * — and is `null` for a garment-less outfit (§8.4), which the card renders as a
 * neutral tile rather than a broken image.
 */
export function outfitCoversQuery(database: typeof db) {
  return database
    .select({
      id: outfit.id,
      name: outfit.name,
      occasion: outfit.occasion,
      createdAt: outfit.createdAt,
      // Written as literal, table-qualified SQL rather than drizzle column refs:
      // interpolated columns render **unqualified** inside a raw `sql` template,
      // which would leave the outer correlation (`outfit.id`) ambiguous against
      // the joined `item`. The identifiers are the schema's own table/column
      // names (§3.2), the same ones §3.3 spells out by hand.
      coverImage: sql<string | null>`(
        select item.image_file
        from outfit_item
        join item on item.id = outfit_item.item_id
        where outfit_item.outfit_id = outfit.id
        order by item.id
        limit 1
      )`,
      itemCount: sql<number>`(
        select count(*) from outfit_item where outfit_item.outfit_id = outfit.id
      )`,
    })
    .from(outfit);
}

/**
 * Per-outfit wear aggregate, rooted at `wear_event` so a logged or un-logged
 * wear re-runs it. Only outfits with `≥ 1` wear appear — grouping over the
 * events themselves can't produce a never-worn outfit — which is exactly the
 * rail's `wears ≥ 1` scope (§7.1); the never-worn outfits are supplied by the
 * covers read and merged back in as `timesWorn: 0`.
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

export type OutfitCard = OutfitCover & { lastWorn: string | null; timesWorn: number };

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

/** Join the covers read to the wear aggregate and apply the §7.2 sort. */
export function mergeOutfitCards(covers: OutfitCover[], aggregates: WearAggregate[]): OutfitCard[] {
  const byOutfit = new Map(aggregates.map((row) => [row.outfitId, row]));
  return covers
    .map((cover) => {
      const agg = byOutfit.get(cover.id);
      return { ...cover, lastWorn: agg?.lastWorn ?? null, timesWorn: agg?.timesWorn ?? 0 };
    })
    .sort(compareCards);
}

/** The rail shows at most the 5 most recently worn outfits (§7.1). */
export const WEAR_AGAIN_RAIL_SIZE = 5;

export function useOutfitCards(): { cards: OutfitCard[]; loading: boolean } {
  const covers = useLiveQuery(outfitCoversQuery(db));
  const aggregates = useLiveQuery(outfitWearAggregatesQuery(db));

  // Both reads must have resolved once; either still `undefined` is a genuine
  // pre-read blank, not an empty tab (same trap as `useItems`).
  const loading = covers.updatedAt === undefined || aggregates.updatedAt === undefined;

  const cards = useMemo(
    () => mergeOutfitCards(covers.data ?? [], aggregates.data ?? []),
    [covers.data, aggregates.data],
  );

  return { cards, loading };
}
