import { eq, inArray } from 'drizzle-orm';

import { db } from './db/client';
import { itemDeleteImpactQuery } from './db/queries';
import { item, outfit } from './db/schema';
import { itemImageFile } from './item-images';

/**
 * §8.3 / §8.4 — the whole **Item delete** story in one module: read the impact at
 * the moment of the tap, plan the confirm as data, and execute the delete.
 *
 * The confirm is assembled by a single pure function, `planItemDelete`, rather
 * than by the screen wiring three copy helpers together. That is the load-bearing
 * decision: the message names the outfits and the cleanup button carries their
 * ids, and both are derived from **the same `impact` in one pass** — so they can
 * no longer disagree. The screen renders the plan and nothing about it decides
 * what a delete means.
 *
 * The two confirms deliberately do not feel equally scary: an item delete is
 * nearly harmless (its outfits survive minus the garment and not one wear event
 * dies), so this one reassures. The outfit confirm — the one that warns, because
 * an outfit's wears cascade — lives in `@/deletes` beside `@/delete-copy`.
 */

/** One outfit's stake in an item delete: enough to say what it loses. */
export type DeleteImpactOutfit = {
  id: number;
  name: string | null;
  /** `itemCount === 1` is the §8.4 last-item case — this item is its sole garment. */
  itemCount: number;
  /** The wears cleaning that outfit up would cost — the confirm is never silent about it. */
  wearCount: number;
};

/**
 * One button of the confirm, as data. `outfitIds` **is** the delete payload:
 * empty on `Delete item only`, and exactly the §8.4 last-item outfit ids on the
 * cleanup action. `style` is the RN Alert union directly, so the screen needs no
 * translation — the §8.4 rule that delete-only is *not* destructive and cleanup
 * *is* is encoded here, where it's testable.
 */
export type ItemDeleteAction = {
  label: string;
  style: 'default' | 'destructive';
  outfitIds: number[];
};

/**
 * The item confirm rendered as data: a title, the body copy, and the ordered
 * delete actions. The screen maps `actions` onto Alert buttons and appends its
 * own inert Cancel — every action here is a real, meaningful delete.
 */
export type ItemDeletePlan = {
  title: string;
  message: string;
  actions: ItemDeleteAction[];
};

/** §8.3 — the containing outfits and their stakes, read at the moment of the tap. */
export function readItemDeleteImpact(itemId: number): DeleteImpactOutfit[] {
  return itemDeleteImpactQuery(db, itemId).all();
}

/** The names shown before the copy falls back to a "+N more" tail. */
const NAMED_OUTFITS = 2;

/** Outfits are titled at the user's option; the app-wide fallback is one string. */
const UNTITLED = 'Untitled outfit';

/** `counted(1, 'wear')` → `"1 wear"`; `counted(12, 'wear')` → `"12 wears"`. */
function counted(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * §8.4 — the outfits this item is the **last garment** in, and so the ones the
 * cleanup action would delete. One rule, called once inside the plan, so the
 * paragraph that names them and the button that carries their ids read the same
 * set by construction.
 */
function lastItemOutfits(outfits: DeleteImpactOutfit[]): DeleteImpactOutfit[] {
  return outfits.filter((outfit) => outfit.itemCount === 1);
}

/**
 * Name the outfits, capped: the first two, then a `+N more` tail. Naming *some*
 * of them is what makes the confirm concrete ("oh, that one") without turning an
 * alert into a list.
 */
function nameOutfits(outfits: DeleteImpactOutfit[], quoted: boolean): string {
  const names = outfits
    .slice(0, NAMED_OUTFITS)
    .map((outfit) => outfit.name ?? UNTITLED)
    .map((name) => (quoted ? `"${name}"` : name));
  const rest = outfits.length - NAMED_OUTFITS;
  return rest > 0 ? `${names.join(', ')} +${rest} more` : names.join(', ');
}

/**
 * The reassurance half of the item confirm — and it is only allowed to promise
 * what survives. An outfit this item empties keeps no "other items", so the
 * clause is written from the *surviving* outfits, not the total.
 */
function survivalClause(total: number, survivors: number): string {
  if (survivors === 0) return "Your wear history won't change.";
  if (survivors < total) {
    return "The others keep their remaining items, and your wear history won't change.";
  }
  return total === 1
    ? "It'll keep its other items, and your wear history won't change."
    : "They'll keep their other items, and your wear history won't change.";
}

/**
 * §8.4 — the third-outcome paragraph, shown only when this item is the **last
 * garment** in one or more outfits. **The offer is never silent about the wear
 * cost:** losing wear history is the one thing an item delete otherwise never
 * does, so it is named here rather than slipped in as tidying. A never-worn
 * doomed outfit has no cost to name, so the sentence simply doesn't claim one.
 */
function lastItemParagraph(emptied: DeleteImpactOutfit[]): string {
  const many = emptied.length > 1;
  const wears = emptied.reduce((total, outfit) => total + outfit.wearCount, 0);

  const subject = many ? `${emptied.length} outfits` : 'an outfit';
  const heading = `This is the last item in ${subject} — ${nameOutfits(emptied, true)}.`;

  const keep = many
    ? "Keep them and they'll have no garments left"
    : "Keep it and it'll have no garments left";
  const kept =
    wears === 0
      ? `${keep}.`
      : `${keep}, but ${many ? 'their' : 'its'} ${counted(wears, 'wear')} ${
          wears === 1 ? 'keeps' : 'keep'
        } counting.`;

  const cleanup = many ? 'Delete them too and' : 'Delete it too and';
  const cleaned =
    wears === 0
      ? // Nothing to name: a never-worn outfit has no wear cost, and inventing
        // one would be its own kind of dishonesty.
        `${cleanup} ${many ? "they're" : "it's"} gone from your outfits.`
      : `${cleanup} ${
          wears === 1 ? 'that 1 wear disappears' : `those ${wears} wears disappear`
        } from your stats.`;

  return [heading, kept, cleaned].join('\n');
}

/**
 * §8.3 — the item confirm's body. Deleting an item is nearly harmless, and this
 * says so with the *real* outfit names and count. An item in no outfit gets the
 * shortest honest line there is.
 */
function itemDeleteMessage(outfits: DeleteImpactOutfit[]): string {
  if (outfits.length === 0) return 'Nothing else changes.';

  const emptied = lastItemOutfits(outfits);
  const survivors = outfits.length - emptied.length;
  const usage =
    `Used in ${counted(outfits.length, 'outfit')} — ${nameOutfits(outfits, false)}. ` +
    survivalClause(outfits.length, survivors);

  return emptied.length === 0 ? usage : [usage, lastItemParagraph(emptied)].join('\n\n');
}

/**
 * §8.4 — the confirm's ordered delete actions. `Delete item only` is the
 * **default** and comes first; cleanup is opt-in, never automatic (auto-deletion
 * was rejected: it destroys history with no confirm). With nothing to clean up
 * there is no third outcome at all, and the single action reads as the plain iOS
 * row label it was reached from — and it, not the absent cleanup, is the
 * destructive one, because deleting the item alone is the only thing happening.
 *
 * The cleanup action carries **exactly** the last-item outfit ids, from the same
 * `lastItemOutfits` read the message paragraph names, so button and copy cannot
 * describe different sets.
 */
function itemDeleteActions(outfits: DeleteImpactOutfit[]): ItemDeleteAction[] {
  const emptied = lastItemOutfits(outfits);
  if (emptied.length === 0) {
    return [{ label: 'Delete Item', style: 'destructive', outfitIds: [] }];
  }

  const cleanupLabel = `Delete item + ${
    emptied.length === 1 ? 'outfit' : `${emptied.length} outfits`
  }`;
  return [
    // Not styled destructive: deleting the item alone costs no wear history, and
    // only the outcome that does should look like it might.
    { label: 'Delete item only', style: 'default', outfitIds: [] },
    { label: cleanupLabel, style: 'destructive', outfitIds: emptied.map((outfit) => outfit.id) },
  ];
}

/**
 * §8.3 / §8.4 — the confirm as one object. Title, body, and the ordered delete
 * actions all derive from the single `impact`, so the message that names the
 * doomed outfits and the button that deletes them are guaranteed to agree.
 */
export function planItemDelete(impact: DeleteImpactOutfit[]): ItemDeletePlan {
  return {
    title: 'Delete this item?',
    message: itemDeleteMessage(impact),
    actions: itemDeleteActions(impact),
  };
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
 *
 * **Row first, then the file** (ADR-0008). §3.1's cascade is a *SQL* cascade: it
 * deletes rows, and SQLite knows nothing about files, so app code has to unlink.
 * Killed after the row, we leave a file with no row (invisible, ~300KB, swept at
 * startup); killed after the file, we'd leave a row pointing at nothing, on an
 * item the user **didn't** delete. So the unlink is best-effort and its failure
 * is swallowed — it must never block or roll back a delete the user asked for.
 * §4.6's startup sweep reclaims whatever is left behind.
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
