import { computeStats, computeWardrobe, type ItemWearAggregate } from '@/db/queries';
import type { Item } from '@/db/schema';

/**
 * §9.6 — the Wardrobe's arrived-at sorts. The load-bearing rule is not the
 * ordering in isolation but its **relationship to the leaderboard tapped from**:
 * "See all" means *more rows of the same question*, so the destination has to be
 * a strict superset of the rows tapped from **starting where they started**.
 * That is asserted here directly against `computeStats`, since the two
 * derivations drifting apart is exactly the failure the user would see as "this
 * isn't the list I tapped".
 */

function anItem(id: number, overrides: Partial<Item> = {}): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category: 'Top',
    name: `Item ${id}`,
    brand: null,
    season: null,
    sourceUrl: null,
    // Ascending ids are ascending created dates unless a test says otherwise.
    createdAt: new Date(2026, 0, id),
    ...overrides,
  };
}

const worn = (itemId: number, wearCount: number, lastWorn: string): ItemWearAggregate => ({
  itemId,
  wearCount,
  lastWorn,
});

const ids = (rows: { id: number }[]) => rows.map((row) => row.id);

describe('the default sort (§9.6)', () => {
  it('is most recently added first, id breaking a same-millisecond tie', () => {
    const sameMoment = new Date(2026, 5, 1);
    const items = [
      anItem(1, { createdAt: sameMoment }),
      anItem(2, { createdAt: new Date(2026, 4, 1) }),
      anItem(3, { createdAt: sameMoment }),
    ];

    const rows = computeWardrobe(items, [], { sort: 'recent', category: null });

    expect(ids(rows)).toEqual([3, 1, 2]);
  });
});

describe('the category filter (§9.6)', () => {
  it('narrows the grid to the arrived-at category under every sort', () => {
    const items = [anItem(1), anItem(2, { category: 'Footwear' }), anItem(3, { category: 'Bag' })];

    for (const sort of ['recent', 'most', 'least'] as const) {
      expect(ids(computeWardrobe(items, [], { sort, category: 'Footwear' }))).toEqual([2]);
    }
  });
});

describe('the most/least sorts rank worn items exactly as the leaderboards do (§9.2)', () => {
  const items = [1, 2, 3, 4, 5, 6].map((id) => anItem(id));
  const aggregates = [
    worn(1, 5, '2026-07-01'),
    worn(2, 9, '2026-07-02'),
    worn(3, 1, '2026-07-03'),
    worn(4, 5, '2026-07-04'),
    worn(5, 2, '2026-07-05'),
    worn(6, 1, '2026-07-06'),
  ];

  it('orders most-worn by wear count, then last worn, then id — all descending', () => {
    const rows = computeWardrobe(items, aggregates, { sort: 'most', category: null });

    expect(ids(rows)).toEqual([2, 4, 1, 5, 6, 3]);
  });

  it('orders least-worn as the exact reverse', () => {
    const rows = computeWardrobe(items, aggregates, { sort: 'least', category: null });

    expect(ids(rows)).toEqual([3, 6, 5, 1, 4, 2]);
  });
});

/**
 * The acceptance criterion stated as a property: whichever leaderboard you tap
 * "See all" from, its rows are the **head** of what you land on, in the same
 * order, with the rest of the wardrobe below them.
 */
describe('the destination is a strict superset of the rows tapped from (§9.2)', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((id) =>
    anItem(id, { category: id % 2 === 0 ? 'Footwear' : 'Top' }),
  );
  const aggregates = [
    worn(1, 4, '2026-07-01'),
    worn(2, 7, '2026-07-02'),
    worn(3, 2, '2026-07-03'),
    worn(4, 1, '2026-07-04'),
    worn(5, 9, '2026-07-05'),
    worn(6, 3, '2026-07-06'),
  ];

  it.each([null, 'Footwear'] as const)('holds for the %s scope, both lists', (scope) => {
    const stats = computeStats(items, aggregates, scope);
    expect(stats.k).toBeGreaterThan(0);

    const most = computeWardrobe(items, aggregates, { sort: 'most', category: scope });
    const least = computeWardrobe(items, aggregates, { sort: 'least', category: scope });

    expect(ids(most).slice(0, stats.k)).toEqual(ids(stats.mostWorn));
    expect(ids(least).slice(0, stats.k)).toEqual(ids(stats.leastWorn));
    // Strict superset: the leaderboard is capped at k, the grid is not.
    expect(most.length).toBeGreaterThan(stats.k);
  });
});

/**
 * Never-worn items are a **separate question** (§9.2/§9.3), so they never
 * displace leaderboard rows — including on the least-worn sort, where a wall of
 * zeros on top would bury the once-worn coat the user tapped through to see.
 * They trail both sorts in §9.3's own order, oldest added first.
 */
describe('never-worn items trail both sorts, oldest added first (§9.3)', () => {
  const items = [1, 2, 3, 4].map((id) => anItem(id));
  const aggregates = [worn(3, 2, '2026-07-01'), worn(4, 6, '2026-07-02')];

  it.each(['most', 'least'] as const)('keeps the zeros below the worn rows on %s', (sort) => {
    const rows = computeWardrobe(items, aggregates, { sort, category: null });

    // 4 and 3 are the two worn items, in whichever order the sort ranks them.
    expect(ids(rows).slice(0, 2).sort()).toEqual([3, 4]);
    expect(ids(rows).slice(2)).toEqual([1, 2]);
  });
});
