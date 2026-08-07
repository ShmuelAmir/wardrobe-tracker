import { v } from 'convex/values';

import { query } from './_generated/server';

/**
 * PROTOTYPE — the wardrobe grid's one read (#95).
 *
 * No auth yet (#100 owns that), so the single user is a hard-coded string. The
 * shape of the return is the interesting part: the client needs a *URL* per
 * item, and Convex only hands those out server-side, so the read fans out one
 * `storage.getUrl` per row rather than returning raw storage ids.
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id('items'),
      _creationTime: v.number(),
      category: v.string(),
      name: v.union(v.string(), v.null()),
      brand: v.union(v.string(), v.null()),
      imageUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('items')
      .withIndex('by_user', (q) => q.eq('userId', 'solo'))
      .order('desc')
      .take(args.limit ?? 100);

    return await Promise.all(
      rows.map(async (row) => ({
        _id: row._id,
        _creationTime: row._creationTime,
        category: row.category,
        name: row.name ?? null,
        brand: row.brand ?? null,
        imageUrl: await ctx.storage.getUrl(row.image),
      })),
    );
  },
});
