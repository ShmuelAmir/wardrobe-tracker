import {
  mergeOutfitCards,
  outfitCoversQuery,
  outfitWearAggregatesQuery,
  type OutfitCover,
} from '@/db/queries';
import { item, outfit, outfitItem } from '@/db/schema';
import { logWear } from '@/wear-log';

/**
 * §7.1/§7.2 are database rules: the cover is a `min(item.id)` correlated read,
 * the wear aggregate is `max`/`count` over `wear_event`, and the sort is
 * `last_worn DESC NULLS LAST`. Proven against the same in-memory better-sqlite3
 * the other query tests use — a mock can't prove SQL.
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

const covers = () => outfitCoversQuery(db).all();
const aggregates = () => outfitWearAggregatesQuery(db).all();
const cards = () => mergeOutfitCards(covers(), aggregates());

beforeEach(() => {
  db.delete(outfit).run();
  db.delete(item).run();
});

describe('outfitCoversQuery — cover and item count', () => {
  it('picks the lowest-id item as the cover and counts the set', () => {
    seedItems(3, 7, 5);
    seedOutfit(10, [7, 3, 5]);

    const row = covers().find((c) => c.id === 10);

    expect(row?.coverImage).toBe('3.jpg');
    expect(row?.itemCount).toBe(3);
  });

  it('reports a garment-less outfit with a null cover and zero count (§8.4)', () => {
    seedOutfit(10, []);

    const row = covers().find((c) => c.id === 10);

    expect(row?.coverImage).toBeNull();
    expect(row?.itemCount).toBe(0);
  });
});

describe('outfitWearAggregatesQuery — derived wear facts', () => {
  it('reads the latest day and the wear count, and omits never-worn outfits', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-23');

    const rows = aggregates();

    expect(rows).toEqual([{ outfitId: 10, lastWorn: '2026-07-23', timesWorn: 2 }]);
  });
});

describe('mergeOutfitCards — the §7.2 sort', () => {
  it('orders worn newest-first, then every never-worn below regardless of created date', () => {
    seedItems(1);
    // 30 is created last but never worn; 10 and 20 are worn.
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    seedOutfit(30, [1]);
    logWear(10, '2026-07-20');
    logWear(20, '2026-07-23');

    expect(cards().map((c) => c.id)).toEqual([20, 10, 30]);
  });

  it('breaks a same-day tie by newest outfit first, deterministically', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    logWear(10, '2026-07-23');
    logWear(20, '2026-07-23');

    expect(cards().map((c) => c.id)).toEqual([20, 10]);
  });

  it('defaults an unworn outfit to null last-worn and zero times-worn', () => {
    const cover: OutfitCover = {
      id: 5,
      name: 'Aspirational',
      occasion: null,
      createdAt: new Date(),
      coverImage: null,
      itemCount: 0,
    };

    expect(mergeOutfitCards([cover], [])).toEqual([
      { ...cover, lastWorn: null, timesWorn: 0 },
    ]);
  });
});
