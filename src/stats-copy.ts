import type { StatsScope } from '@/db/queries';

/**
 * The §9.4 head's own name — the label over the `k = 1–2` ranked rows, and the
 * title of the dashed card that stands in for the ranking at `k = 0`. One
 * constant so the empty slot is named the same as the thing that fills it.
 */
export const MOST_WORN_HEADING = 'Most worn';

/** `wearCountLabel(1)` → `"1 wear"`; `wearCountLabel(12)` → `"12 wears"`. */
export function wearCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'wear' : 'wears'}`;
}

/**
 * The caption under a sub-tab list. Neither list has a header row, so nothing
 * else says which way it is sorted — and the sort *is* the argument each list
 * makes ("least used" indicts, "oldest additions" explains).
 */
export function listCaption(tab: 'least' | 'never'): string {
  return tab === 'least' ? 'Ranked from least used' : 'Oldest additions first';
}

/**
 * §9.5 head empty-state copy, chosen by **why** the leaderboard is empty (`k = 0`
 * happens at `n = 0` or `n = 1`):
 *
 * - `n = 0` (nothing worn in scope) → the honest fresh-install line: it states
 *   the precondition and still leaves the full wardrobe on the Never-worn tab
 *   below.
 * - `n = 1` (one worn item) → **names the actual reason** rather than showing a
 *   blank, and names the category when the filter is what shrank the set to one.
 */
export function mostWornEmptyCopy(wornCount: number, scope: StatsScope): string {
  if (wornCount === 0) {
    return 'No ranking yet — log a wear and your top items show up here.';
  }
  const subject = scope ? `one item in ${scope}` : 'one item';
  return `Only ${subject} has been worn — a leaderboard needs at least two.`;
}

/**
 * §9.4 never-worn empty state — the one genuinely *good* empty state in the app:
 * an empty Never tab means the whole scope has been worn, so it reads as praise,
 * not absence. Title + body because it renders in the dashed card, whose bold
 * line carries the verdict and whose body carries the scope.
 *
 * The body narrows to the active category: under a filter, "your wardrobe" would
 * claim something the screen isn't showing — five unworn coats can sit one filter
 * away from an empty Footwear tab.
 */
export function neverWornEmptyCopy(scope: StatsScope): { title: string; body: string } {
  const subject = scope ? scope : 'your wardrobe';
  return {
    title: 'Everything’s been worn',
    body: `Nothing in ${subject} is sitting unused.`,
  };
}
