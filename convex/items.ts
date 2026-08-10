import { query } from './_generated/server';
import { requireOwner } from './owner';

/**
 * The whole wardrobe, newest first — §7.1's default view for a bare `/`, which
 * is also what tells the grid apart from the zero state.
 *
 * It takes **no arguments at all**: not the sort, which §9's parser resolves
 * client-side from the URL, and above all not a `userId` (invariant #1). There
 * is no pagination — 200 items is one `.collect()`, and a page boundary is
 * unstable under the re-sorts a wear log triggers (§3.1 rule 6).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireOwner(ctx);

    return await ctx.db
      .query('items')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});
