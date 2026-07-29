import { itemStatsQuery } from '@/db/queries';
import { item, outfit, outfitItem, wearEvent } from '@/db/schema';
import { deleteOutfit, readOutfitDeleteImpact } from '@/deletes';
import { logWear } from '@/wear-log';

/**
 * §4.5 / §8.3 — the **outfit** delete and the read that describes it. Proven
 * against the in-memory better-sqlite3 the other query suites use, because the
 * claims the confirm makes are claims about **SQL cascades** (`PRAGMA
 * foreign_keys = ON`, ADR-0005) — a mock could not prove a single one of them.
 * (The item delete's cascade behaviour is proven in `item-delete.test.ts`.)
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

// Outfits own no images (§4.5), so the file half is here only to prove no unlink
// ever fires on an outfit delete.
const mockUnlinked: string[] = [];
jest.mock('@/item-images', () => ({
  itemImageFile: (imageFile: string) => ({
    delete: () => {
      mockUnlinked.push(imageFile);
    },
  }),
}));

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

const wearCountOf = (itemId: number) => itemStatsQuery(db, itemId).all()[0].wearCount;
const outfitIds = () => db.select().from(outfit).all().map((row) => row.id);
const itemIds = () => db.select().from(item).all().map((row) => row.id);

beforeEach(() => {
  db.delete(wearEvent).run();
  db.delete(outfit).run();
  db.delete(item).run();
  mockUnlinked.length = 0;
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
