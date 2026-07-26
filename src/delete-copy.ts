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

/** `counted(1, 'wear')` → `"1 wear"`; `counted(12, 'wear')` → `"12 wears"`. */
function counted(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
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
 * §8.4 — the outfits this item is the **last garment** in, and so the ones the
 * third outcome would clean up. Exported because the message and the buttons
 * must name the same set: the confirm screen builds its cleanup action from this
 * list, and `itemDeleteMessage` writes its paragraph from it, so the rule lives
 * in one place rather than being re-derived at each call site.
 */
export function lastItemOutfits(outfits: DeleteImpactOutfit[]): DeleteImpactOutfit[] {
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
export function itemDeleteMessage(outfits: DeleteImpactOutfit[]): string {
  if (outfits.length === 0) return 'Nothing else changes.';

  const emptied = lastItemOutfits(outfits);
  const survivors = outfits.length - emptied.length;
  const usage =
    `Used in ${counted(outfits.length, 'outfit')} — ${nameOutfits(outfits, false)}. ` +
    survivalClause(outfits.length, survivors);

  return emptied.length === 0 ? usage : [usage, lastItemParagraph(emptied)].join('\n\n');
}

/**
 * §8.4 — the confirm's buttons. `Delete item only` is the **default**; cleanup
 * is opt-in, never automatic (auto-deletion was rejected: it destroys history
 * with no confirm). With nothing to clean up there is no third outcome at all,
 * and the single action reads as the plain iOS row label it was reached from.
 */
export type ItemDeleteActions = { confirm: string; cleanup: string | null };

export function itemDeleteActions(emptiedOutfits: number): ItemDeleteActions {
  if (emptiedOutfits === 0) return { confirm: 'Delete Item', cleanup: null };
  return {
    confirm: 'Delete item only',
    cleanup: `Delete item + ${emptiedOutfits === 1 ? 'outfit' : `${emptiedOutfits} outfits`}`,
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
