import { itemOutfitsQuery, itemStatsQuery } from '@/db/queries';
import { item, outfit, outfitItem } from '@/db/schema';
import { logWear } from '@/wear-log';

/**
 * §8.1 item detail is all derived reads: the stats strip is `count`/`max` over
 * `wear_event` reached through *every* containing outfit (the §3 double-count
 * rule), and the "In outfits" rail is `outfit_item` joined back to `outfit` with
 * the same lowest-id cover the cards use. Proven against the in-memory
 * better-sqlite3 the other query tests use — a mock can't prove SQL.
 */
jest.mock('@/db/client', () => {
  const BetterSqlite3 = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const schema = require('@/db/schema');
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db };
});

const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

function seedItems(...ids: number[]) {
  db.insert(item)
    .values(ids.map((id) => ({ id, imageFile: `${id}.jpg`, category: 'Top' as const })))
    .run();
}

function seedOutfit(id: number, itemIds: number[], name: string | null = `Outfit ${id}`) {
  db.insert(outfit).values({ id, name }).run();
  if (itemIds.length > 0) {
    db.insert(outfitItem)
      .values(itemIds.map((itemId) => ({ outfitId: id, itemId })))
      .run();
  }
}

const stats = (itemId: number) => itemStatsQuery(db, itemId).all()[0];
const outfits = (itemId: number) => itemOutfitsQuery(db, itemId).all();

beforeEach(() => {
  db.delete(outfit).run();
  db.delete(item).run();
});

describe('itemStatsQuery — derived wear facts through containing outfits', () => {
  it('reads zero wears and a null last-worn for an item never worn', () => {
    seedItems(1);
    seedOutfit(10, [1]);

    expect(stats(1)).toEqual({ wearCount: 0, lastWorn: null });
  });

  it('counts one wear per containing outfit and reads the latest day', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    logWear(10, '2026-07-20');
    logWear(20, '2026-07-23');

    expect(stats(1)).toEqual({ wearCount: 2, lastWorn: '2026-07-23' });
  });

  it('double-counts a shared item worn the same day in two outfits (§3)', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    logWear(10, '2026-07-23');
    logWear(20, '2026-07-23');

    expect(stats(1)).toEqual({ wearCount: 2, lastWorn: '2026-07-23' });
  });

  it('ignores wears of outfits that do not contain the item', () => {
    seedItems(1, 2);
    seedOutfit(10, [1]);
    seedOutfit(20, [2]);
    logWear(20, '2026-07-23');

    expect(stats(1)).toEqual({ wearCount: 0, lastWorn: null });
  });
});

describe('itemOutfitsQuery — the "In outfits" rail', () => {
  it('lists every containing outfit with its lowest-id cover, newest first', () => {
    seedItems(3, 7);
    seedOutfit(10, [7, 3], 'Weekday');
    seedOutfit(20, [3], 'Weekend');

    expect(outfits(3)).toEqual([
      { id: 20, name: 'Weekend', coverImage: '3.jpg' },
      { id: 10, name: 'Weekday', coverImage: '3.jpg' },
    ]);
  });

  it('is empty for an item in no outfit', () => {
    seedItems(1);

    expect(outfits(1)).toEqual([]);
  });
});
