/**
 * SPEC.md §3.2 — the two closed vocabularies an item is classified by, and
 * nothing else.
 *
 * They sit in the domain tier rather than beside the table that stores them so
 * that importing a *value* costs a bundle nothing: a module that needs the six
 * category strings would otherwise drag `drizzle-orm/sqlite-core` along with
 * them, 23.8 kB against 786 bytes for the wardrobe-view parser.
 * `__tests__/domain-db-free.test.ts` holds that direction in place, and
 * `db/schema.ts` re-exports both so the storage tier still reads as one place.
 */

/** Six values, closed. On SQLite the column is `text`, typed only here (§3.2). */
export const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'] as const;
export type Category = (typeof CATEGORIES)[number];

/** No "all-season" value — year-round means all four selected (§3.2). */
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
