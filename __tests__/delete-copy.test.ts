import { outfitDeleteMessage, zeroItemOutfitLabel } from '@/delete-copy';

/**
 * §8.3 — the two confirms deliberately do not feel equally scary, and the copy
 * is where that asymmetry lives. These are the outfit-side strings the spec
 * quotes, pinned so a reword has to be deliberate. (The item confirm's copy is
 * proven through `planItemDelete` in `item-delete.test.ts`.)
 */
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
