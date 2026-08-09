import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Category, Season } from '@/item-taxonomy';

/**
 * SPEC.md §3.2. Four tables and nothing else: wear stats are derived on read
 * (§3.1 rule 1), so no `wear_count` or `last_worn` column exists here — or may
 * be added.
 */

/**
 * Re-exported, not defined here, so that importing the vocabulary doesn't
 * require importing Drizzle — see `@/item-taxonomy`. A call site still gets the
 * whole storage vocabulary from this one module.
 */
export { CATEGORIES, SEASONS, type Category, type Season } from '@/item-taxonomy';

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
