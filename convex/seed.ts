import { v } from 'convex/values';

import { internal } from './_generated/api';
import { action, internalMutation } from './_generated/server';
import { CATEGORIES } from './schema';

/**
 * PROTOTYPE — fills the deployment with enough wardrobe to render a real grid,
 * pulling stand-in photos off picsum.photos.
 *
 * Doubles as a live check of #92's central claim: an action can `fetch` an
 * arbitrary URL and hand the body straight to `ctx.storage.store(blob)` with no
 * `"use node"` anywhere in the file.
 */

const NAMES = [
  'Oxford shirt',
  'Selvedge denim',
  'Wool overcoat',
  'White sneakers',
  'Leather belt',
  'Canvas tote',
  'Linen tee',
  'Chino trousers',
  'Quilted jacket',
  'Chelsea boots',
  'Knit scarf',
  'Weekender bag',
  'Striped polo',
  'Corduroy pants',
  'Rain shell',
  'Running shoes',
  'Field watch',
  'Backpack',
];

export const wardrobe = action({
  args: { count: v.optional(v.number()) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, args) => {
    const count = Math.min(args.count ?? 18, NAMES.length);
    let inserted = 0;

    for (let index = 0; index < count; index += 1) {
      const response = await fetch(`https://picsum.photos/seed/wardrobe${index}/900/900.jpg`);
      if (!response.ok) continue;
      const image = await ctx.storage.store(await response.blob());

      await ctx.runMutation(internal.seed.insertItem, {
        image,
        category: CATEGORIES[index % CATEGORIES.length],
        name: NAMES[index],
        brand: index % 3 === 0 ? 'Everlane' : undefined,
      });
      inserted += 1;
    }

    return { inserted };
  },
});

export const insertItem = internalMutation({
  args: {
    image: v.id('_storage'),
    category: v.union(...CATEGORIES.map((name) => v.literal(name))),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert('items', { userId: 'solo', ...args });
    return null;
  },
});

/** Wipes the prototype wardrobe, files included, so a reseed starts clean. */
export const clear = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('items')
      .withIndex('by_user', (q) => q.eq('userId', 'solo'))
      .take(500);
    for (const row of rows) {
      await ctx.storage.delete(row.image);
      await ctx.db.delete('items', row._id);
    }
    return rows.length;
  },
});
