import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * PROTOTYPE SCHEMA — throwaway, written to make ticket #95's vertical slice run.
 * The real data-model decision belongs to #97; treat everything here as a
 * sketch that happens to compile, not as an adjudicated shape.
 *
 * It does exercise the three things #91 flagged: Category/Season become real
 * server-side unions, `outfit_item` is a join table rather than an embedded
 * array, and nothing stores a wear count.
 */

export const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'] as const;
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;

const category = v.union(...CATEGORIES.map((name) => v.literal(name)));
const season = v.union(...SEASONS.map((name) => v.literal(name)));

export default defineSchema({
  items: defineTable({
    // Every table carries `userId` from day one (map Notes: multi-tenant-ready).
    userId: v.string(),
    // The storage id replaces the native build's bare filename.
    image: v.id('_storage'),
    category,
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    season: v.optional(v.array(season)),
    sourceUrl: v.optional(v.string()),
  }).index('by_user', ['userId']),

  outfits: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    occasion: v.optional(v.string()),
  }).index('by_user', ['userId']),

  outfitItems: defineTable({
    outfitId: v.id('outfits'),
    itemId: v.id('items'),
  })
    .index('by_outfit', ['outfitId'])
    .index('by_item', ['itemId']),

  wearEvents: defineTable({
    userId: v.string(),
    outfitId: v.id('outfits'),
    /** "YYYY-MM-DD" — day-granular, as in the native build. */
    wornOn: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_outfit', ['outfitId']),
});
