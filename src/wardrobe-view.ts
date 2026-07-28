import { CATEGORIES, type Category } from '@/db/schema';

/**
 * §9.6 — the Wardrobe tab's **arrived-at** state, expressed as nav params.
 *
 * The screen has no filter or sort control of its own in v1; the only way into a
 * shortened list is Stats' "See all →". Keeping sort and category as *params*
 * rather than screen state is the ticket's real deliverable: the standalone
 * control this defers (the known v2 ask) becomes a new entry point that sets the
 * same params, not a rework of the screen.
 *
 * This module is the whole vocabulary of that state — parse, serialize, title,
 * chips — so the screen renders it and nothing else decides what it means.
 */

/** `recent` is the default; `most`/`least` mirror the two §9.2 leaderboards. */
export const WARDROBE_SORTS = ['recent', 'most', 'least'] as const;
export type WardrobeSort = (typeof WARDROBE_SORTS)[number];

export type WardrobeView = { sort: WardrobeSort; category: Category | null };

/** The whole wardrobe, newest first — what the tab shows when tapped directly. */
export const DEFAULT_WARDROBE_VIEW: WardrobeView = { sort: 'recent', category: null };

/**
 * Params as `useLocalSearchParams` hands them over: a value can be missing, a
 * string, or (on a repeated key) an array of strings.
 */
export type WardrobeParams = { sort?: string | string[]; category?: string | string[] };

const first = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

/**
 * Params → view, **total**: the tab is reachable by deep link and by a cleared
 * chip, so an empty, unknown, or malformed value degrades to the default rather
 * than reaching a comparator that has no idea what to do with it.
 */
export function parseWardrobeView(params: WardrobeParams): WardrobeView {
  const sort = WARDROBE_SORTS.find((candidate) => candidate === first(params.sort));
  const category = CATEGORIES.find((candidate) => candidate === first(params.category));
  return { sort: sort ?? DEFAULT_WARDROBE_VIEW.sort, category: category ?? null };
}

/**
 * View → params, the inverse. A default is written as an **empty** param, not an
 * omitted one: `router.setParams` merges, so clearing a chip by omission would
 * leave the old value standing and the chip would refuse to go away.
 */
export function wardrobeParams(view: WardrobeView): { sort: string; category: string } {
  return {
    sort: view.sort === DEFAULT_WARDROBE_VIEW.sort ? '' : view.sort,
    category: view.category ?? '',
  };
}

/**
 * The title reflects the active **category** (`Footwear`), so the shortened list
 * is explained before you reach the chips. A sort alone doesn't shorten anything
 * — the rows are still the whole wardrobe — so it leaves the title alone.
 */
export function wardrobeTitle(view: WardrobeView): string {
  return view.category ?? 'Wardrobe';
}

const SORT_LABEL: Record<WardrobeSort, string> = {
  recent: 'Recently added',
  most: 'Most worn',
  least: 'Least worn',
};

/** A chip carries its own "cleared" params, so the screen just applies them. */
export type WardrobeChip = {
  key: 'category' | 'sort';
  label: string;
  clearedParams: { sort: string; category: string };
};

/**
 * One chip per **active** param, each carrying the params that drop *only
 * itself* (§9.6). The independence is the decision: a single "Clear all" can't
 * express "drop the category but keep the most-worn sort". Category leads, since
 * it's the param that changed which rows are on screen.
 */
export function wardrobeChips(view: WardrobeView): WardrobeChip[] {
  const chips: WardrobeChip[] = [];
  if (view.category !== null) {
    chips.push({
      key: 'category',
      label: view.category,
      clearedParams: wardrobeParams({ ...view, category: null }),
    });
  }
  if (view.sort !== DEFAULT_WARDROBE_VIEW.sort) {
    chips.push({
      key: 'sort',
      label: SORT_LABEL[view.sort],
      clearedParams: wardrobeParams({ ...view, sort: DEFAULT_WARDROBE_VIEW.sort }),
    });
  }
  return chips;
}
