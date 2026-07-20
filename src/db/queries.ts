import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from './client';
import { item, type Item } from './schema';

/**
 * Every item, newest first — the Wardrobe grid's backing query. This is only
 * §9.6's default `recent` sort; the category filter and the `most`/`least`
 * sorts arrive as nav params with the Stats "See all →" entry point, which is
 * the ticket that gives them somewhere to be set from.
 *
 * `createdAt` is ms-granular, so two items saved in the same millisecond would
 * otherwise order arbitrarily; `id` breaks the tie the same way §9.7's queries
 * do.
 *
 * `useLiveQuery` re-runs this whenever a write touches the table, so callers
 * never refresh by hand. Screens go through this hook rather than reaching for
 * `db` directly, which keeps the reactive path the only path.
 */
export function useItems(): { items: Item[]; loading: boolean } {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(item)
      .orderBy(desc(item.createdAt), desc(item.id)),
  );

  // `data` is `[]` both before the first read resolves and for a genuinely
  // empty wardrobe; `updatedAt` is what tells the two apart. Getting this wrong
  // flashes the zero-state hero on every cold start.
  return { items: data ?? [], loading: updatedAt === undefined };
}
