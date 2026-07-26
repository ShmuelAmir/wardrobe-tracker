/**
 * §8.3 / §8.4 — the delete confirmation copy, as pure functions.
 *
 * **The two confirms deliberately do not feel equally scary, because the
 * asymmetry is real, and it inverts the intuition.** Deleting an item is nearly
 * harmless: its outfits survive minus the garment and no wear event dies.
 * Deleting an *outfit* is what destroys history: its `wear_event` rows cascade,
 * so every containing item's derived count drops. The item confirm reassures;
 * the outfit confirm warns.
 *
 * Copy lives here rather than inline in the two screens because these strings
 * *are* the feature — every clause is a claim about what the schema will do, and
 * a claim is worth pinning in a test.
 */

/** The names shown before the copy falls back to a "+N more" tail. */
const NAMED_OUTFITS = 2;

/** Outfits are titled at the user's option; the app-wide fallback is one string. */
const UNTITLED = 'Untitled outfit';

function countedWears(count: number): string {
  return count === 1 ? '1 wear' : `${count} wears`;
}

function countedItems(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

function countedOutfits(count: number): string {
  return count === 1 ? '1 outfit' : `${count} outfits`;
}

/**
 * One outfit's stake in a delete: enough to say what it loses. `itemCount === 1`
 * is the §8.4 last-item case — this item is the outfit's only garment — and
 * `wearCount` is the history that cleaning it up would cost.
 */
export type DeleteImpactOutfit = {
  id: number;
  name: string | null;
  itemCount: number;
  wearCount: number;
};

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
function lastItemParagraph(doomed: DeleteImpactOutfit[]): string {
  const many = doomed.length > 1;
  const wears = doomed.reduce((total, outfit) => total + outfit.wearCount, 0);

  const subject = many ? `${doomed.length} outfits` : 'an outfit';
  const heading = `This is the last item in ${subject} — ${nameOutfits(doomed, true)}.`;

  const keep = many ? "Keep them and they'll have no garments left" : "Keep it and it'll have no garments left";
  const kept =
    wears === 0
      ? `${keep}.`
      : `${keep}, but ${many ? 'their' : 'its'} ${countedWears(wears)} ${wears === 1 ? 'keeps' : 'keep'} counting.`;

  const cleanup = many ? 'Delete them too and' : 'Delete it too and';
  const cleaned =
    wears === 0
      ? `${cleanup} ${many ? "they're" : "it's"} gone from your outfits.`
      : `${cleanup} ${wears === 1 ? 'that 1 wear disappears' : `those ${wears} wears disappear`} from your stats.`;

  return [heading, kept, cleaned].join('\n');
}

/**
 * §8.3 — the item confirm's body. Deleting an item is nearly harmless, and this
 * says so with the *real* outfit names and count. An item in no outfit gets the
 * shortest honest line there is.
 */
export function itemDeleteMessage(outfits: DeleteImpactOutfit[]): string {
  if (outfits.length === 0) return 'Nothing else changes.';

  const doomed = outfits.filter((outfit) => outfit.itemCount === 1);
  const survivors = outfits.length - doomed.length;
  const usage = `Used in ${countedOutfits(outfits.length)} — ${nameOutfits(outfits, false)}. ${survivalClause(
    outfits.length,
    survivors,
  )}`;

  return doomed.length === 0 ? usage : [usage, lastItemParagraph(doomed)].join('\n\n');
}

/**
 * §8.4 — the confirm's buttons. `Delete item only` is the **default**; cleanup
 * is opt-in, never automatic (auto-deletion was rejected: it destroys history
 * with no confirm). With nothing to clean up there is no third outcome at all,
 * and the single action reads as the plain iOS row label it was reached from.
 */
export type ItemDeleteActions = { confirm: string; cleanup: string | null };

export function itemDeleteActions(lastItemOutfits: number): ItemDeleteActions {
  if (lastItemOutfits === 0) return { confirm: 'Delete Item', cleanup: null };
  return {
    confirm: 'Delete item only',
    cleanup:
      lastItemOutfits === 1 ? 'Delete item + outfit' : `Delete item + ${lastItemOutfits} outfits`,
  };
}

/** What an outfit delete destroys — both counts are derived reads (§3). */
export type OutfitDeleteImpact = { wearCount: number; itemCount: number };

/**
 * §8.3 — the outfit confirm's body, and the one that **warns**. The outfit's
 * `wear_event` rows cascade, so the sentence leads with the history that dies
 * and only then reassures about the garments, which don't.
 */
export function outfitDeleteMessage({ wearCount, itemCount }: OutfitDeleteImpact): string {
  const doomed = `Its ${countedWears(wearCount)} will be deleted too`;

  if (itemCount === 0) {
    // §8.4's zero-item outfit: nothing leaves the wardrobe, but the wears still die.
    return wearCount === 0
      ? 'It has never been worn and has no items left. Nothing else changes.'
      : `${doomed}. It has no items left, so nothing leaves your wardrobe.`;
  }

  if (wearCount === 0) {
    return `It has never been worn, so no wear counts change. Its ${countedItems(itemCount)} ${
      itemCount === 1 ? 'stays' : 'stay'
    } in your wardrobe.`;
  }

  return (
    `${doomed}, so the wear ${itemCount === 1 ? 'count' : 'counts'} on its ${countedItems(itemCount)} ` +
    `will drop. ${itemCount === 1 ? 'The item itself stays' : 'The items themselves stay'} in your wardrobe.`
  );
}

/**
 * §8.4 — the label on a garment-less outfit. The state is **legal**, not broken:
 * every item in it was deleted one at a time and the cleanup was declined each
 * time. Its wears keep counting **because those wears really did happen**, and
 * the label says exactly that rather than apologizing for an empty grid.
 */
export function zeroItemOutfitLabel(wearCount: number): string {
  if (wearCount === 0) return 'Every item in this outfit was deleted.';
  return (
    `Every item in this outfit was deleted — its ${countedWears(wearCount)} still ` +
    `${wearCount === 1 ? 'counts' : 'count'} toward your stats.`
  );
}
