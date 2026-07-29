/**
 * §8.3 / §8.4 — the **outfit** delete copy, as pure functions. (The item confirm
 * is assembled in `@/item-delete`, which reads and warns from its own copy.)
 *
 * **The two confirms deliberately do not feel equally scary, because the
 * asymmetry is real, and it inverts the intuition.** Deleting an item is nearly
 * harmless: its outfits survive minus the garment and no wear event dies.
 * Deleting an *outfit* is what destroys history: its `wear_event` rows cascade,
 * so every containing item's derived count drops. The item confirm reassures;
 * the outfit confirm warns.
 *
 * Copy lives here rather than inline in the screen because these strings *are*
 * the feature — every clause is a claim about what the schema will do, and a
 * claim is worth pinning in a test.
 */

/** `counted(1, 'wear')` → `"1 wear"`; `counted(12, 'wear')` → `"12 wears"`. */
function counted(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** What an outfit delete destroys — both counts are derived reads (§3). */
export type OutfitDeleteImpact = { wearCount: number; itemCount: number };

/**
 * §8.3 — the outfit confirm's body, and the one that **warns**. The outfit's
 * `wear_event` rows cascade, so the sentence leads with the history that dies
 * and only then reassures about the garments, which don't.
 */
export function outfitDeleteMessage({ wearCount, itemCount }: OutfitDeleteImpact): string {
  const wearsDie = `Its ${counted(wearCount, 'wear')} will be deleted too`;

  if (itemCount === 0) {
    // §8.4's zero-item outfit: nothing leaves the wardrobe, but the wears still die.
    return wearCount === 0
      ? 'It has never been worn and has no items left. Nothing else changes.'
      : `${wearsDie}. It has no items left, so nothing leaves your wardrobe.`;
  }

  if (wearCount === 0) {
    return `It has never been worn, so no wear counts change. Its ${counted(itemCount, 'item')} ${
      itemCount === 1 ? 'stays' : 'stay'
    } in your wardrobe.`;
  }

  return (
    `${wearsDie}, so the wear ${itemCount === 1 ? 'count' : 'counts'} on its ` +
    `${counted(itemCount, 'item')} will drop. ` +
    `${itemCount === 1 ? 'The item itself stays' : 'The items themselves stay'} in your wardrobe.`
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
    `Every item in this outfit was deleted — its ${counted(wearCount, 'wear')} still ` +
    `${wearCount === 1 ? 'counts' : 'count'} toward your stats.`
  );
}
