import {
  computeStats,
  itemWearAggregatesQuery,
  leaderboards,
  partitionWear,
  type ItemWearAggregate,
} from '@/db/queries';
import { item, outfit, outfitItem, type Item } from '@/db/schema';
import { logWear } from '@/wear-log';

/**
 * §9.2/§9.3/§9.7 are the load-bearing Stats rules: the worn-set aggregate
 * (per wear-event, doubled across shared outfits), the `k = min(5, floor(n/2))`
 * cap, the two exact-reverse orderings that keep the leaderboards disjoint, and
 * never-worn oldest-first. The aggregate is proven against the same in-memory
 * better-sqlite3 the other query tests use; the slicing/ordering is pure JS.
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

function seedOutfit(id: number, itemIds: number[]) {
  db.insert(outfit).values({ id }).run();
  if (itemIds.length > 0) {
    db.insert(outfitItem)
      .values(itemIds.map((itemId) => ({ outfitId: id, itemId })))
      .run();
  }
}

const aggregates = () => itemWearAggregatesQuery(db).all();

beforeEach(() => {
  db.delete(outfit).run();
  db.delete(item).run();
});

/** A plain item row for the pure-function tests, no database round-trip. */
function anItem(id: number, overrides: Partial<Item> = {}): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category: 'Top',
    name: `Item ${id}`,
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(2026, 0, id),
    ...overrides,
  };
}

/** A worn aggregate row for the pure-function tests. */
function agg(itemId: number, wearCount: number, lastWorn: string): ItemWearAggregate {
  return { itemId, wearCount, lastWorn };
}

describe('itemWearAggregatesQuery — the derived per-item wear facts', () => {
  it('counts one row per wear-event, doubling an item shared by two worn outfits', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    // Same day, two outfits both containing item 1 → two events, counted twice.
    logWear(10, '2026-07-23');
    logWear(20, '2026-07-23');
    logWear(10, '2026-07-20');

    expect(aggregates()).toEqual([{ itemId: 1, wearCount: 3, lastWorn: '2026-07-23' }]);
  });

  it('omits an item that is never worn (the inner join excludes it)', () => {
    seedItems(1, 2);
    seedOutfit(10, [1]); // item 2 is in no worn outfit
    logWear(10, '2026-07-23');

    expect(aggregates()).toEqual([{ itemId: 1, wearCount: 1, lastWorn: '2026-07-23' }]);
  });
});

describe('leaderboards — k = min(5, floor(n/2)) and disjointness', () => {
  const worn = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      // Distinct counts so ordering is unambiguous; item i+1 worn i+1 times.
      ({ ...anItem(i + 1), wearCount: i + 1, lastWorn: `2026-07-${String(10 + i).padStart(2, '0')}` }),
    );

  it('n = 1 → both lists empty', () => {
    const { k, mostWorn, leastWorn } = leaderboards(worn(1));
    expect(k).toBe(0);
    expect(mostWorn).toEqual([]);
    expect(leastWorn).toEqual([]);
  });

  it('n = 2..3 → one row each', () => {
    expect(leaderboards(worn(2)).k).toBe(1);
    expect(leaderboards(worn(3)).k).toBe(1);
  });

  it('caps at 5 however large n is', () => {
    expect(leaderboards(worn(20)).k).toBe(5);
    expect(leaderboards(worn(11)).k).toBe(5);
  });

  it('never places the same item in both lists on an even, small n', () => {
    const { mostWorn, leastWorn } = leaderboards(worn(8)); // k = 4
    const overlap = mostWorn.filter((m) => leastWorn.some((l) => l.id === m.id));
    expect(overlap).toEqual([]);
    expect(mostWorn).toHaveLength(4);
    expect(leastWorn).toHaveLength(4);
  });

  it('keeps fully-tied rows disjoint via the id-direction reversal', () => {
    // Four items tied on both wear count and last-worn day: only id separates.
    const tied = [1, 2, 3, 4].map((id) => ({ ...anItem(id), wearCount: 5, lastWorn: '2026-07-15' }));
    const { mostWorn, leastWorn } = leaderboards(tied); // k = 2

    // most-worn takes highest ids (4,3); least-worn takes lowest ids (1,2).
    expect(mostWorn.map((r) => r.id)).toEqual([4, 3]);
    expect(leastWorn.map((r) => r.id)).toEqual([1, 2]);
    const overlap = mostWorn.filter((m) => leastWorn.some((l) => l.id === m.id));
    expect(overlap).toEqual([]);
  });

  it('orders most-worn by count then recency then id, least-worn the exact reverse', () => {
    const rows = [
      { ...anItem(1), wearCount: 2, lastWorn: '2026-07-10' },
      { ...anItem(2), wearCount: 5, lastWorn: '2026-07-11' },
      { ...anItem(3), wearCount: 5, lastWorn: '2026-07-12' },
      { ...anItem(4), wearCount: 1, lastWorn: '2026-07-01' },
    ];
    const { mostWorn, leastWorn } = leaderboards(rows); // k = 2

    expect(mostWorn.map((r) => r.id)).toEqual([3, 2]); // 5@12, 5@11
    expect(leastWorn.map((r) => r.id)).toEqual([4, 1]); // 1@01, 2@10
  });
});

describe('partitionWear — worn vs never-worn split', () => {
  it('splits by presence of an aggregate and sorts never-worn oldest-first', () => {
    const items = [
      anItem(1, { createdAt: new Date(2026, 0, 3) }),
      anItem(2, { createdAt: new Date(2026, 0, 1) }),
      anItem(3, { createdAt: new Date(2026, 0, 2) }),
    ];
    const { worn, neverWorn } = partitionWear(items, [agg(1, 4, '2026-07-20')]);

    expect(worn.map((w) => w.id)).toEqual([1]);
    expect(worn[0].wearCount).toBe(4);
    // 2 (Jan 1) before 3 (Jan 2) — oldest created first.
    expect(neverWorn.map((n) => n.id)).toEqual([2, 3]);
  });

  it('breaks a same-created tie by ascending id for never-worn', () => {
    const created = new Date(2026, 0, 1);
    const items = [anItem(7, { createdAt: created }), anItem(3, { createdAt: created })];
    const { neverWorn } = partitionWear(items, []);
    expect(neverWorn.map((n) => n.id)).toEqual([3, 7]);
  });
});

describe('computeStats — filter scoping', () => {
  it('re-scopes both lists to the category and drops out-of-scope items', () => {
    const items = [
      anItem(1, { category: 'Top' }),
      anItem(2, { category: 'Bottom' }),
      anItem(3, { category: 'Top' }),
    ];
    const aggs = [agg(1, 5, '2026-07-20'), agg(2, 9, '2026-07-21')];

    const all = computeStats(items, aggs, null);
    expect(all.wornCount).toBe(2);

    const tops = computeStats(items, aggs, 'Top');
    expect(tops.wornCount).toBe(1); // only item 1 is a worn Top
    expect(tops.neverWorn.map((n) => n.id)).toEqual([3]); // item 3 Top, unworn
    // item 2 (Bottom, worn) is out of scope entirely
    expect(tops.mostWorn.every((m) => m.category === 'Top')).toBe(true);
  });
});
