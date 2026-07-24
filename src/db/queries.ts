import { asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

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
