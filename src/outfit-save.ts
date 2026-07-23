import { eq, sql } from 'drizzle-orm';

import { db } from './db/client';
import { outfit, outfitItem } from './db/schema';

/**
 * §6.1 — the fields a committed outfit carries. No season (§6.3); wear stats are
 * derived (§3), so absent. `itemIds` is the builder's selection; order is a
 * session-only concern (front-of-rail, §6.1.1), so the join carries no rank.
 */
export type NewOutfit = {
  name: string | null;
  occasion: string | null;
  itemIds: number[];
};

/**
 * §6.2 — trim and **collapse internal whitespace** before anything else looks at
 * an occasion. `"  work  formal "` and `"work formal"` are the same tag; without
 * this the case-insensitive match below would still splinter them. Empty after
 * collapsing is not a value — the caller reads that as `null`.
 */
export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * §6.2 — normalize the typed occasion against history. Collapse whitespace; an
 * empty result is no occasion. Otherwise match **case-insensitively** against
 * every existing occasion and, on a hit, store the **existing** spelling — first
 * spelling wins and stays canonical, so `WORK` reuses `Work` while `NYE` is
 * never mangled to `Nye`. A miss stores the value exactly as typed.
 *
 * The match runs against *all* outfits, not the capped chip list (§6.2): a tag
 * that has sunk below the 8-chip cap must still be reused, not re-created.
 */
export function resolveOccasion(raw: string | null): string | null {
  const collapsed = collapseWhitespace(raw ?? '');
  if (collapsed.length === 0) return null;

  const existing = db
    .select({ occasion: outfit.occasion })
    .from(outfit)
    .where(sql`${outfit.occasion} collate nocase = ${collapsed}`)
    .limit(1)
    .get();

  return existing?.occasion ?? collapsed;
}

/**
 * §6.1 — commit a built outfit and return its new id so the caller can land on
 * its Detail screen (§6.1.5). The outfit row and its join rows go in one
 * transaction: a half-written outfit with no items would be a nonsense state the
 * builder's own "≥1 item" gate exists to prevent.
 */
export function saveOutfit(input: NewOutfit): number {
  const name = collapseWhitespace(input.name ?? '') || null;
  const occasion = resolveOccasion(input.occasion);

  return db.transaction((tx) => {
    const created = tx
      .insert(outfit)
      .values({ name, occasion })
      .returning({ id: outfit.id })
      .get();

    if (input.itemIds.length > 0) {
      tx.insert(outfitItem)
        .values(input.itemIds.map((itemId) => ({ outfitId: created.id, itemId })))
        .run();
    }

    return created.id;
  });
}

/**
 * §8.5 Edit item set — re-save an existing outfit's name, occasion, and item
 * set. The item set is replaced wholesale (delete-then-insert the join rows) in
 * one transaction, mirroring the builder's own semantics. **Wear history is
 * untouched**: `wear_event` belongs to the outfit, not the join, so re-picking
 * the garments never disturbs a single logged day.
 */
export function updateOutfit(id: number, input: NewOutfit): void {
  const name = collapseWhitespace(input.name ?? '') || null;
  const occasion = resolveOccasion(input.occasion);

  db.transaction((tx) => {
    tx.update(outfit).set({ name, occasion }).where(eq(outfit.id, id)).run();
    tx.delete(outfitItem).where(eq(outfitItem.outfitId, id)).run();
    if (input.itemIds.length > 0) {
      tx.insert(outfitItem)
        .values(input.itemIds.map((itemId) => ({ outfitId: id, itemId })))
        .run();
    }
  });
}
