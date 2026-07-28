import type { WardrobeView } from '@/db/queries';
import { parseWardrobeView, wardrobeChips, wardrobeParams, wardrobeTitle } from '@/wardrobe-view';

/**
 * §9.6 — the Wardrobe's sort and category are **nav params**, not screen state.
 * That is the whole point of the ticket: a later standalone filter (the known v2
 * ask) is then a new entry point to this same state, not a rework. So the
 * parse/serialize round trip and the per-chip clearing are unit-level rules
 * here, with the screen left to render them.
 */

const view = (overrides: Partial<WardrobeView> = {}): WardrobeView => ({
  sort: 'recent',
  category: null,
  ...overrides,
});

describe('parsing the nav params (§9.6)', () => {
  it('defaults to the whole wardrobe, most recent first, when arrived at without params', () => {
    expect(parseWardrobeView({})).toEqual(view());
  });

  it('reads the sort and the category the Stats "See all →" carried over', () => {
    expect(parseWardrobeView({ sort: 'most', category: 'Footwear' })).toEqual(
      view({ sort: 'most', category: 'Footwear' }),
    );
    expect(parseWardrobeView({ sort: 'least' })).toEqual(view({ sort: 'least' }));
  });

  // The tab is reachable by deep link and by a cleared chip, so anything that
  // isn't one of the three sorts or six categories has to degrade to the
  // default rather than sort by a value no comparator knows.
  it('falls back to the defaults for empty, unknown, or malformed values', () => {
    expect(parseWardrobeView({ sort: '', category: '' })).toEqual(view());
    expect(parseWardrobeView({ sort: 'oldest', category: 'Hats' })).toEqual(view());
    expect(parseWardrobeView({ sort: ['most', 'least'], category: ['Bag'] })).toEqual(
      view({ sort: 'most', category: 'Bag' }),
    );
  });
});

describe('serializing back to nav params', () => {
  it('round-trips a view through the params a navigation carries', () => {
    const arrived = view({ sort: 'least', category: 'Top' });

    expect(parseWardrobeView(wardrobeParams(arrived))).toEqual(arrived);
  });

  // Clearing is expressed as an *empty* param rather than a missing one:
  // `router.setParams` merges, so an absent key would leave the old value
  // standing and the chip would refuse to go away.
  it('spells a cleared param as empty, not as absent', () => {
    expect(wardrobeParams(view())).toEqual({ sort: '', category: '' });
  });
});

describe('the title explains the shortened list before the chips do (§9.6)', () => {
  it('reflects the active category instead of the generic Wardrobe', () => {
    expect(wardrobeTitle(view({ category: 'Footwear' }))).toBe('Footwear');
  });

  it('stays Wardrobe when only the sort is active — the row set is still everything', () => {
    expect(wardrobeTitle(view({ sort: 'most' }))).toBe('Wardrobe');
    expect(wardrobeTitle(view())).toBe('Wardrobe');
  });
});

describe('one removable chip per active param, each clearing independently (§9.6)', () => {
  it('shows no chips when nothing is active', () => {
    expect(wardrobeChips(view())).toEqual([]);
  });

  it('names the category and the leaderboard the sort came from', () => {
    expect(wardrobeChips(view({ sort: 'most', category: 'Footwear' })).map((c) => c.label)).toEqual([
      'Footwear',
      'Most worn',
    ]);
    expect(wardrobeChips(view({ sort: 'least' })).map((c) => c.label)).toEqual(['Least worn']);
  });

  // The independence is the decision (§9.6): a single "Clear all" cannot
  // express "drop the category but keep the most-worn sort".
  it('drops the category and keeps the sort', () => {
    const [category] = wardrobeChips(view({ sort: 'most', category: 'Footwear' }));

    expect(parseWardrobeView(category.clearedParams)).toEqual(view({ sort: 'most' }));
  });

  it('drops the sort and keeps the category', () => {
    const [, sort] = wardrobeChips(view({ sort: 'most', category: 'Footwear' }));

    expect(parseWardrobeView(sort.clearedParams)).toEqual(view({ category: 'Footwear' }));
  });
});
