import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireOwner } from './owner';
import { category, season } from './schema';

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

/**
 * The one-shot, authenticated URL the browser POSTs the normalized image to
 * (§4.4). Upload is a separate round trip from the insert on purpose: the client
 * holds the resulting storage id, so a failed insert **retries carrying the same
 * id** rather than re-uploading — ADR-0010's never-restart-a-flow, at the
 * network layer.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * The wizard's commit (§5.6) — the only path that inserts an item.
 *
 * The row carries the storage id **and** the serving URL, because `getUrl` is
 * not derivable from the id: without the denormalized copy every reactive re-run
 * of the grid would cost a `_storage` read per item (§4.3). It is resolved here,
 * once, at insert.
 *
 * A `null` from `getUrl` means the id names no stored file — the upload never
 * landed, or its file is already gone — so there is nothing to point a row at
 * and the insert must not happen.
 */
export const create = mutation({
  args: {
    image: v.id('_storage'),
    category,
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    season: v.optional(v.array(season)),
    // §8.1 — the resolved product page a web import came from, and the one field
    // in the app that points out of it. Absent on every other source.
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx);
    const imageUrl = await ctx.storage.getUrl(args.image);

    if (imageUrl === null) {
      throw new Error('That image is no longer stored');
    }

    return await ctx.db.insert('items', { userId, imageUrl, ...args });
  },
});
