import { eq, inArray } from 'drizzle-orm';

import { db } from './db/client';
import { itemDeleteImpactQuery, outfitDeleteImpactQuery } from './db/queries';
import { item, outfit } from './db/schema';
import type { DeleteImpactOutfit, OutfitDeleteImpact } from './delete-copy';
import { itemImageFile } from './item-images';

/**
 * §4.5 / §8.3 / §8.4 — the two deletes, and the reads that let their confirms
 * make concrete promises.
 *
 * **Row first, then the file** (ADR-0008). §3.1's cascade is a *SQL* cascade: it
 * deletes rows, and SQLite knows nothing about files, so app code has to unlink.
 * The order is what decides the failure mode, and the failure modes aren't
 * symmetric — killed after the row, we leave a file with no row (invisible,
 * ~300KB, swept at startup); killed after the file, we'd leave a row pointing at
 * nothing, on an item the user **didn't** delete, unfixable in-app.
 *
 * > Always fail toward an orphan, never toward a dangling reference.
 *
 * The unlink is therefore best-effort and its failure is swallowed: it must
 * never block or roll back a delete the user asked for. §4.6's startup sweep
 * reclaims whatever is left behind.
 */

/** §8.3 — the containing outfits and their stakes, read at the moment of the tap. */
export function readItemDeleteImpact(itemId: number): DeleteImpactOutfit[] {
  return itemDeleteImpactQuery(db, itemId).all();
}

/** §8.3 — the wears that will die and the items whose counts will drop. */
export function readOutfitDeleteImpact(outfitId: number): OutfitDeleteImpact {
  const row = outfitDeleteImpactQuery(db, outfitId).get();
  return { itemCount: row?.itemCount ?? 0, wearCount: row?.wearCount ?? 0 };
}

/**
 * §8.3 — delete an item, and optionally the outfits it would empty (§8.4's
 * opt-in third outcome). The item's own delete is nearly harmless: its outfits
 * survive minus the garment and **not one `wear_event` dies**, because wears
 * belong to the outfit, not to the join.
 *
 * `alsoDeleteOutfitIds` is the *only* way an item delete can cost wear history,
 * which is why it is an explicit argument the confirm has to have named — never
 * an inference this function makes on its own. Both deletes share a transaction:
 * the user chose one outcome, so a half-applied one is not a state to leave.
 */
export function deleteItem(
  itemId: number,
  imageFile: string,
  alsoDeleteOutfitIds: number[] = [],
): void {
  db.transaction((tx) => {
    if (alsoDeleteOutfitIds.length > 0) {
      tx.delete(outfit).where(inArray(outfit.id, alsoDeleteOutfitIds)).run();
    }
    tx.delete(item).where(eq(item.id, itemId)).run();
  });

  try {
    itemImageFile(imageFile).delete();
  } catch {
    // Best-effort (§4.5) — the row is already gone, so what's left is an orphan
    // and the startup sweep (§4.6) reclaims it.
  }
}

/**
 * §8.3 — delete an outfit. **This is the delete that destroys history:** its
 * `wear_event` rows cascade, so every containing item's derived wear count
 * drops. The items themselves stay in the wardrobe, and **no file is removed** —
 * outfits own no images, so the cascade is pure rows (§4.5).
 */
export function deleteOutfit(outfitId: number): void {
  db.delete(outfit).where(eq(outfit.id, outfitId)).run();
}
