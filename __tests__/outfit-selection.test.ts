import { frontLoadRail } from '@/outfit-selection';
import type { Item } from '@/db/schema';

function anItem(id: number): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category: 'Top',
    name: null,
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(),
  };
}

/**
 * §6.1.1 — a selected item **reorders to the front of its rail**, latest tap
 * frontmost, and the unselected tail keeps its feed order. This is the one bit
 * of builder ordering the AC pins, so it's a pure function with its own test.
 */
describe('frontLoadRail', () => {
  const rail = [anItem(1), anItem(2), anItem(3), anItem(4)];

  it('leaves the rail untouched when nothing is selected', () => {
    expect(frontLoadRail(rail, []).map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it('floats a single selected item to the front', () => {
    expect(frontLoadRail(rail, [3]).map((i) => i.id)).toEqual([3, 1, 2, 4]);
  });

  it('orders multiple picks latest-tap-first, then the feed tail', () => {
    // Tapped 2 then 4: the most recent (4) sits ahead of 2.
    expect(frontLoadRail(rail, [2, 4]).map((i) => i.id)).toEqual([4, 2, 1, 3]);
  });

  it('ignores selected ids that belong to other rails', () => {
    expect(frontLoadRail(rail, [99, 2]).map((i) => i.id)).toEqual([2, 1, 3, 4]);
  });
});
