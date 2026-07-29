import { eq } from 'drizzle-orm';

import { db } from './db/client';
import { outfitDeleteImpactQuery } from './db/queries';
import { outfit } from './db/schema';
import type { OutfitDeleteImpact } from './delete-copy';

/**
 * §4.5 / §8.3 — the **outfit** delete, and the read that lets its confirm make a
 * concrete promise. (The item delete and its confirm live in `@/item-delete`.)
 *
 * This is the delete that **destroys history**: an outfit's `wear_event` rows
 * cascade, so every containing item's derived wear count drops. The items
 * themselves stay in the wardrobe, and **no file is removed** — outfits own no
 * images, so the cascade is pure rows (§4.5), and there is no ADR-0008 file
 * ordering to uphold here.
 */

/** §8.3 — the wears that will die and the items whose counts will drop. */
export function readOutfitDeleteImpact(outfitId: number): OutfitDeleteImpact {
  const row = outfitDeleteImpactQuery(db, outfitId).get();
  return { itemCount: row?.itemCount ?? 0, wearCount: row?.wearCount ?? 0 };
}

/**
 * §8.3 — delete an outfit. Its `wear_event` rows cascade, so every containing
 * item's derived wear count drops; the items and their files are untouched.
 */
export function deleteOutfit(outfitId: number): void {
  db.delete(outfit).where(eq(outfit.id, outfitId)).run();
}
