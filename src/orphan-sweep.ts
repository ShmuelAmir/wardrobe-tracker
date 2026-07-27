import { db } from './db/client';
import { item } from './db/schema';
import { itemImageFile, listItemImageFiles } from './item-images';

/**
 * §4.6 / ADR-0008 — the reconciliation that keeps disk and database honest.
 *
 * §3.1's cascade is a **SQL** cascade: nothing in the schema will ever remove
 * an image, so app code must — and app code can be interrupted. This is the
 * cleanup for what interruption leaves behind, from either source: a delete
 * killed after the row commit (§4.5 is row-first, and swallows a failed
 * unlink), and a save killed between the file move and the insert (§4.4 is
 * file-first). Both leave the same harmless shape — a file with no row — and
 * this is what reclaims it.
 *
 * > ⚠️ **Startup only. Never on a timer, never in the background.** Save is
 * > "move file → insert row", so there is a real window where a legitimate
 * > file sits on disk with no row yet. A concurrent sweep would delete it out
 * > from under an in-flight save. Running once, after migrations resolve and
 * > before the UI can open the wizard, rules that race out *by construction*
 * > rather than by locking. `migration-gate.tsx` is the only caller.
 *
 * Cheap enough to be unconditional: one directory listing plus one column over
 * ~200 rows.
 */
export function sweepOrphanImages(): void {
  try {
    // Listing **before** the query, not after, is the safe order even here: a
    // file that lands between the two calls is simply absent from the listing,
    // whereas the reverse order would read a row set that predates it and take
    // the file for a stray.
    const onDisk = listItemImageFiles();
    if (onDisk.length === 0) return;

    const referenced = new Set(
      db
        .select({ imageFile: item.imageFile })
        .from(item)
        .all()
        .map((row) => row.imageFile),
    );

    let reclaimed = 0;
    for (const imageFile of onDisk) {
      if (referenced.has(imageFile)) continue;
      try {
        itemImageFile(imageFile).delete();
        reclaimed += 1;
      } catch (error) {
        // One locked file is not a reason to abandon the rest; the next launch
        // gets another go at it.
        console.warn(`[orphan-sweep] could not unlink ${imageFile}`, error);
      }
    }

    if (reclaimed > 0) console.log(`[orphan-sweep] reclaimed ${reclaimed} orphaned image(s)`);
  } catch (error) {
    // Housekeeping the user never asked for must never cost them a launch, so
    // every failure — an unreadable directory, a query that throws — dies here
    // as a log. Nothing about the sweep is ever surfaced (§4.6).
    console.warn('[orphan-sweep] skipped', error);
  }
}
