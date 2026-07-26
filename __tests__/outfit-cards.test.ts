import { eq } from 'drizzle-orm';

import {
  mergeOutfitCards,
  outfitMembershipsQuery,
  outfitRowsQuery,
  outfitWearAggregatesQuery,
  type OutfitRow,
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

const rows = () => outfitRowsQuery(db).all();
const memberships = () => outfitMembershipsQuery(db).all();
const aggregates = () => outfitWearAggregatesQuery(db).all();
const cards = () => mergeOutfitCards(rows(), memberships(), aggregates());

beforeEach(() => {
  db.delete(outfit).run();
  db.delete(item).run();
});

describe('outfitMembershipsQuery — cover and item count, rooted at the join', () => {
  it('picks the lowest-id item as the cover and counts the set', () => {
    seedItems(3, 7, 5);
    seedOutfit(10, [7, 3, 5]);

    expect(memberships()).toEqual([{ outfitId: 10, coverImage: '3.jpg', itemCount: 3 }]);
  });

  it('keeps each outfit’s cover to its own members', () => {
    seedItems(1, 2);
    seedOutfit(10, [2]);
    seedOutfit(20, [1, 2]);

    expect(memberships()).toEqual([
      { outfitId: 10, coverImage: '2.jpg', itemCount: 1 },
      { outfitId: 20, coverImage: '1.jpg', itemCount: 2 },
    ]);
  });

  it('omits a garment-less outfit, which the merge reads back as zero (§8.4)', () => {
    seedOutfit(10, []);

    expect(memberships()).toEqual([]);

    const card = cards().find((c) => c.id === 10);
    expect(card?.coverImage).toBeNull();
    expect(card?.itemCount).toBe(0);
  });

  /**
   * The reason membership is its own read: an item delete cascades into
   * `outfit_item` and never touches `outfit`, so a card whose count came from a
   * query rooted at `outfit` would go stale under a mounted Outfits tab
   * (`useLiveQuery` tracks a single table).
   */
  it('shrinks the count and re-picks the cover when an item is deleted (§8.3)', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2]);

    db.delete(item).where(eq(item.id, 1)).run();

    expect(memberships()).toEqual([{ outfitId: 10, coverImage: '2.jpg', itemCount: 1 }]);
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

  it('defaults an outfit missing from both aggregates rather than dropping it', () => {
    const row: OutfitRow = {
      id: 5,
      name: 'Aspirational',
      occasion: null,
      createdAt: new Date(),
    };

    expect(mergeOutfitCards([row], [], [])).toEqual([
      { ...row, coverImage: null, itemCount: 0, lastWorn: null, timesWorn: 0 },
    ]);
  });
});
