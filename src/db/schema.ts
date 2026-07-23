import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * SPEC.md §3.2. Four tables and nothing else: wear stats are derived on read
 * (§3.1 rule 4), so no `wear_count` or `last_worn` column exists here — or may
 * be added.
 */

/** Fixed enum, validated in TypeScript rather than by a SQL `CHECK` (§3.1 rule 1). */
export const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'] as const;
export type Category = (typeof CATEGORIES)[number];

/** No "all-season" value — year-round means all four selected (§3.1 rule 2). */
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const item = sqliteTable('item', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Bare filename, e.g. "a3f2c1de.jpg" — never a path (§4.2). */
  imageFile: text('image_file').notNull(),
  category: text('category').$type<Category>().notNull(),
  name: text('name'),
  brand: text('brand'),
  /** JSON array, e.g. ["winter","fall"]; null means unset, not year-round. */
  season: text('season', { mode: 'json' }).$type<Season[]>(),
  /** Auto-set on web import (§5.1). */
  sourceUrl: text('source_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const outfit = sqliteTable('outfit', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  /** Free text, single value (§6.2). */
  occasion: text('occasion'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const outfitItem = sqliteTable(
  'outfit_item',
  {
    outfitId: integer('outfit_id')
      .notNull()
      .references(() => outfit.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.outfitId, t.itemId] })],
);

export const wearEvent = sqliteTable('wear_event', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  outfitId: integer('outfit_id')
    .notNull()
    .references(() => outfit.id, { onDelete: 'cascade' }),
  /** "YYYY-MM-DD" — day-granular, backfillable via date picker (§3.1 rule 6). */
  wornOn: text('worn_on').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Item = typeof item.$inferSelect;
export type Outfit = typeof outfit.$inferSelect;
