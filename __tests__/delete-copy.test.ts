import {
  itemDeleteActions,
  itemDeleteMessage,
  lastItemOutfits,
  outfitDeleteMessage,
  zeroItemOutfitLabel,
  type DeleteImpactOutfit,
} from '@/delete-copy';

function anOutfit(overrides: Partial<DeleteImpactOutfit> = {}): DeleteImpactOutfit {
  return { id: 1, name: 'Weekday default', itemCount: 4, wearCount: 0, ...overrides };
}

/**
 * §8.3 — the two confirms deliberately do not feel equally scary, and the copy
 * is where that asymmetry lives. These are the exact strings the spec quotes,
 * pinned so a reword has to be deliberate.
 */
describe('itemDeleteMessage — the item confirm reassures (§8.3)', () => {
  it('says nothing else changes when the item is in no outfit', () => {
    expect(itemDeleteMessage([])).toBe('Nothing else changes.');
  });

  it('names the outfits and promises wear history is untouched', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default' }),
      anOutfit({ id: 2, name: 'Smart evening' }),
      anOutfit({ id: 3, name: 'Rainy day' }),
      anOutfit({ id: 4, name: 'Beach' }),
    ];

    expect(itemDeleteMessage(outfits)).toBe(
      'Used in 4 outfits — Weekday default, Smart evening +2 more. ' +
        "They'll keep their other items, and your wear history won't change.",
    );
  });

  it('drops the "+N more" tail and singularizes at one outfit', () => {
    expect(itemDeleteMessage([anOutfit({ name: 'Weekday default' })])).toBe(
      "Used in 1 outfit — Weekday default. It'll keep its other items, and your wear " +
        "history won't change.",
    );
  });

  it('falls back to the app-wide name for an untitled outfit', () => {
    expect(itemDeleteMessage([anOutfit({ name: null })])).toContain(
      'Used in 1 outfit — Untitled outfit.',
    );
  });
});

describe('itemDeleteMessage — the last-item third outcome (§8.4)', () => {
  it('names the outfit and the wear cost of cleaning it up', () => {
    const outfits = [anOutfit({ name: 'Weekday default', itemCount: 1, wearCount: 12 })];

    expect(itemDeleteMessage(outfits)).toBe(
      "Used in 1 outfit — Weekday default. Your wear history won't change.\n\n" +
        'This is the last item in an outfit — "Weekday default".\n' +
        "Keep it and it'll have no garments left, but its 12 wears keep counting.\n" +
        'Delete it too and those 12 wears disappear from your stats.',
    );
  });

  it('agrees verb and article at a single wear', () => {
    const message = itemDeleteMessage([anOutfit({ itemCount: 1, wearCount: 1 })]);

    expect(message).toContain('but its 1 wear keeps counting.');
    expect(message).toContain('Delete it too and that 1 wear disappears from your stats.');
  });

  it('never dangles a wear promise when the doomed outfit was never worn', () => {
    const message = itemDeleteMessage([anOutfit({ itemCount: 1, wearCount: 0 })]);

    expect(message).toContain("Keep it and it'll have no garments left.");
    expect(message).not.toContain('wears');
  });

  it('pluralizes the whole paragraph across several last-item outfits', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default', itemCount: 1, wearCount: 12 }),
      anOutfit({ id: 2, name: 'Smart evening', itemCount: 1, wearCount: 3 }),
    ];

    expect(itemDeleteMessage(outfits)).toBe(
      "Used in 2 outfits — Weekday default, Smart evening. Your wear history won't change.\n\n" +
        'This is the last item in 2 outfits — "Weekday default", "Smart evening".\n' +
        "Keep them and they'll have no garments left, but their 15 wears keep counting.\n" +
        'Delete them too and those 15 wears disappear from your stats.',
    );
  });

  it('reassures only about the outfits that actually survive with garments', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default', itemCount: 4 }),
      anOutfit({ id: 2, name: 'Smart evening', itemCount: 1, wearCount: 3 }),
    ];

    expect(itemDeleteMessage(outfits)).toContain(
      "The others keep their remaining items, and your wear history won't change.",
    );
  });
});

describe('lastItemOutfits — the one rule the message and the buttons share (§8.4)', () => {
  it('keeps only the outfits this item is the sole garment of', () => {
    const emptied = anOutfit({ id: 2, name: 'Smart evening', itemCount: 1 });

    expect(lastItemOutfits([anOutfit({ id: 1, itemCount: 4 }), emptied])).toEqual([emptied]);
  });

  it('is empty when every containing outfit keeps other garments', () => {
    expect(lastItemOutfits([anOutfit({ itemCount: 2 })])).toEqual([]);
  });
});

describe('itemDeleteActions — item-only is the default, cleanup is opt-in (§8.4)', () => {
  it('offers a single destructive action when no outfit is emptied', () => {
    expect(itemDeleteActions(0)).toEqual({ confirm: 'Delete Item', cleanup: null });
  });

  it('offers the third outcome, singular, when one outfit is emptied', () => {
    expect(itemDeleteActions(1)).toEqual({
      confirm: 'Delete item only',
      cleanup: 'Delete item + outfit',
    });
  });

  it('counts the outfits in the cleanup label when several are emptied', () => {
    expect(itemDeleteActions(2).cleanup).toBe('Delete item + 2 outfits');
  });
});

describe('outfitDeleteMessage — the outfit confirm warns (§8.3)', () => {
  it('names the wears that die and the items whose counts will drop', () => {
    expect(outfitDeleteMessage({ wearCount: 12, itemCount: 4 })).toBe(
      'Its 12 wears will be deleted too, so the wear counts on its 4 items will drop. ' +
        'The items themselves stay in your wardrobe.',
    );
  });

  it('singularizes down to one wear and one item', () => {
    expect(outfitDeleteMessage({ wearCount: 1, itemCount: 1 })).toBe(
      'Its 1 wear will be deleted too, so the wear count on its 1 item will drop. ' +
        'The item itself stays in your wardrobe.',
    );
  });

  it('promises nothing about wear counts for an outfit never worn', () => {
    expect(outfitDeleteMessage({ wearCount: 0, itemCount: 4 })).toBe(
      'It has never been worn, so no wear counts change. Its 4 items stay in your wardrobe.',
    );
  });

  it('handles the §8.4 zero-item outfit, whose wears still die', () => {
    expect(outfitDeleteMessage({ wearCount: 12, itemCount: 0 })).toBe(
      'Its 12 wears will be deleted too. It has no items left, so nothing leaves your wardrobe.',
    );
    expect(outfitDeleteMessage({ wearCount: 0, itemCount: 0 })).toBe(
      'It has never been worn and has no items left. Nothing else changes.',
    );
  });
});

describe('zeroItemOutfitLabel — a legal, labelled state (§8.4)', () => {
  it('says the wears still count, because they really did happen', () => {
    expect(zeroItemOutfitLabel(12)).toBe(
      'Every item in this outfit was deleted — its 12 wears still count toward your stats.',
    );
    expect(zeroItemOutfitLabel(1)).toBe(
      'Every item in this outfit was deleted — its 1 wear still counts toward your stats.',
    );
  });

  it('claims no stats for an emptied outfit that was never worn', () => {
    expect(zeroItemOutfitLabel(0)).toBe('Every item in this outfit was deleted.');
  });
});
