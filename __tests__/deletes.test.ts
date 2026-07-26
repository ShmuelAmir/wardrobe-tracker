import { itemStatsQuery } from '@/db/queries';
import { item, outfit, outfitItem, wearEvent } from '@/db/schema';
import { deleteItem, deleteOutfit, readItemDeleteImpact, readOutfitDeleteImpact } from '@/deletes';
import { logWear } from '@/wear-log';

/**
 * §4.5 / §8.3 / §8.4 — the deletes and the reads that describe them. Proven
 * against the in-memory better-sqlite3 the other query suites use, because the
 * claims the confirms make are claims about **SQL cascades** (`PRAGMA
 * foreign_keys = ON`, ADR-0005) — a mock could not prove a single one of them.
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

// The filesystem half of §4.5. Sampling the row count *at unlink time* — not
// just recording that an unlink happened — is what lets a test assert the
// ordering rule rather than merely the two effects.
const mockUnlinked: string[] = [];
let mockUnlinkThrows = false;
let mockRowsAtUnlink: number | null = null;
jest.mock('@/item-images', () => ({
  itemImageFile: (imageFile: string) => ({
    delete: () => {
      mockUnlinked.push(imageFile);
      mockRowsAtUnlink = mockCountItems();
      if (mockUnlinkThrows) throw new Error('unlink failed');
    },
  }),
}));

const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

const mockCountItems = () => db.select().from(item).all().length;

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

const wearCountOf = (itemId: number) => itemStatsQuery(db, itemId).all()[0].wearCount;
const outfitIds = () => db.select().from(outfit).all().map((row) => row.id);
const itemIds = () => db.select().from(item).all().map((row) => row.id);
const itemIdsIn = (id: number) =>
  db
    .select()
    .from(outfitItem)
    .all()
    .filter((row) => row.outfitId === id)
    .map((row) => row.itemId);

beforeEach(() => {
  db.delete(wearEvent).run();
  db.delete(outfit).run();
  db.delete(item).run();
  mockUnlinked.length = 0;
  mockRowsAtUnlink = null;
  mockUnlinkThrows = false;
});

describe('readItemDeleteImpact — what the item confirm is allowed to claim', () => {
  it('reads nothing for an item in no outfit', () => {
    seedItems(1);

    expect(readItemDeleteImpact(1)).toEqual([]);
  });

  it('carries each containing outfit with its own item and wear counts', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2], 'Weekday default');
    seedOutfit(20, [1], 'Smart evening');
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');
    logWear(20, '2026-07-22');

    expect(readItemDeleteImpact(1)).toEqual([
      { id: 20, name: 'Smart evening', itemCount: 1, wearCount: 1 },
      { id: 10, name: 'Weekday default', itemCount: 2, wearCount: 2 },
    ]);
  });

  it('ignores outfits that do not contain the item', () => {
    seedItems(1, 2);
    seedOutfit(10, [2]);

    expect(readItemDeleteImpact(1)).toEqual([]);
  });
});

describe('readOutfitDeleteImpact — what the outfit confirm is allowed to claim', () => {
  it('reads the wear count that will die and the item count that will drop', () => {
    seedItems(1, 2, 3);
    seedOutfit(10, [1, 2, 3]);
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');

    expect(readOutfitDeleteImpact(10)).toEqual({ itemCount: 3, wearCount: 2 });
  });

  it('reads zeros for a never-worn, garment-less outfit rather than nothing', () => {
    seedOutfit(10, []);

    expect(readOutfitDeleteImpact(10)).toEqual({ itemCount: 0, wearCount: 0 });
  });
});

describe('deleteItem — nearly harmless, and row-first (§4.5, §8.3)', () => {
  it('leaves the outfits intact minus that garment, with wear history unchanged', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2]);
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');

    deleteItem(1, '1.jpg');

    expect(itemIds()).toEqual([2]);
    expect(outfitIds()).toEqual([10]);
    expect(itemIdsIn(10)).toEqual([2]);
    // The surviving garment's derived count is untouched — no wear event died.
    expect(wearCountOf(2)).toBe(2);
  });

  it('removes the row before the file — always fail toward an orphan (ADR-0008)', () => {
    seedItems(1);

    deleteItem(1, '1.jpg');

    expect(mockUnlinked).toEqual(['1.jpg']);
    // Zero rows at the moment the unlink ran: the row was already gone, so a
    // kill here leaves a file with no row, never a row with no file.
    expect(mockRowsAtUnlink).toBe(0);
  });

  it('swallows a failed unlink rather than rolling back a delete the user asked for', () => {
    seedItems(1);
    mockUnlinkThrows = true;

    expect(() => deleteItem(1, '1.jpg')).not.toThrow();
    expect(itemIds()).toEqual([]);
  });

  it('leaves a reachable zero-item outfit whose wears still count when cleanup is declined', () => {
    seedItems(1);
    seedOutfit(10, [1], 'Weekday default');
    logWear(10, '2026-07-20');

    deleteItem(1, '1.jpg');

    expect(outfitIds()).toEqual([10]);
    expect(itemIdsIn(10)).toEqual([]);
    expect(readOutfitDeleteImpact(10)).toEqual({ itemCount: 0, wearCount: 1 });
  });

  it('takes the named outfits with it when cleanup is opted into, and only those', () => {
    seedItems(1, 2);
    seedOutfit(10, [1], 'Weekday default');
    seedOutfit(20, [1, 2], 'Smart evening');
    logWear(10, '2026-07-20');
    logWear(20, '2026-07-21');

    deleteItem(1, '1.jpg', [10]);

    expect(outfitIds()).toEqual([20]);
    expect(itemIds()).toEqual([2]);
    // Outfit 10's wear died with it; outfit 20's did not.
    expect(wearCountOf(2)).toBe(1);
    expect(mockUnlinked).toEqual(['1.jpg']);
  });
});

describe('deleteOutfit — this is what destroys history (§8.3)', () => {
  it('drops its items’ wear counts while the items stay in the wardrobe', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2], 'Weekday default');
    seedOutfit(20, [1], 'Smart evening');
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');
    logWear(20, '2026-07-22');
    expect(wearCountOf(1)).toBe(3);

    deleteOutfit(10);

    // The §8.3 prototype check, in miniature: the shared item's count drops to
    // just the wears that reach it through the outfit that survived.
    expect(wearCountOf(1)).toBe(1);
    expect(wearCountOf(2)).toBe(0);
    expect(itemIds()).toEqual([1, 2]);
    expect(outfitIds()).toEqual([20]);
  });

  it('removes no files — outfits own no images (§4.5)', () => {
    seedItems(1);
    seedOutfit(10, [1]);

    deleteOutfit(10);

    expect(mockUnlinked).toEqual([]);
  });
});
