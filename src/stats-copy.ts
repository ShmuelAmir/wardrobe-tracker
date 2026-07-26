import type { StatsScope } from '@/db/queries';

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
