import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ItemEditScreen from '@/app/item/[id]/edit';
import type { DeleteImpactOutfit } from '@/item-delete';
import type { CaptureResult } from '@/photo-capture';
import type { Item } from '@/db/schema';

// expo-image's <Image> is a native view; a testID-preserving stand-in lets the
// preview be queried and its onError invoked without a real decoder.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

function anItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 3,
    imageFile: '3.jpg',
    category: 'Footwear',
    name: 'Runner',
    brand: 'Nike',
    season: null,
    sourceUrl: null,
    createdAt: new Date(2026, 0, 15),
    ...overrides,
  };
}

const mockUseItemDetail = jest.fn();
jest.mock('@/db/queries', () => ({
  useItemDetail: () => mockUseItemDetail(),
}));

const mockUpdateItem = jest.fn(async (..._args: unknown[]) => {});
jest.mock('@/item-save', () => ({
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
}));

const mockCaptureFromCamera = jest.fn<Promise<CaptureResult>, []>();
const mockCaptureFromLibrary = jest.fn<Promise<CaptureResult>, []>();
jest.mock('@/photo-capture', () => ({
  captureFromCamera: () => mockCaptureFromCamera(),
  captureFromLibrary: () => mockCaptureFromLibrary(),
}));

// `@/item-delete` imports the real db client at module top; stub it so the
// module evaluates under jsdom. The read and the write are the only db-touching
// members — stub those, and let the **real** `planItemDelete` assemble the
// confirm so this render test exercises the true button→outfit-id wiring.
jest.mock('@/db/client', () => ({ db: {} }));

const mockReadItemDeleteImpact = jest.fn<DeleteImpactOutfit[], [number]>();
const mockDeleteItem = jest.fn();
jest.mock('@/item-delete', () => ({
  ...jest.requireActual('@/item-delete'),
  readItemDeleteImpact: (id: number) => mockReadItemDeleteImpact(id),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
}));

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '3' }),
  useRouter: () => ({ back: mockBack, dismissTo: mockDismissTo }),
  // Render both nav-bar slots so Cancel and Save are queryable; the real
  // Stack.Screen only registers options with the navigator.
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerLeft?: () => unknown; headerRight?: () => unknown };
    }) => (
      <>
        {options?.headerLeft?.() ?? null}
        {options?.headerRight?.() ?? null}
      </>
    ),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseItemDetail.mockReturnValue({ item: anItem(), loading: false });
  mockReadItemDeleteImpact.mockReturnValue([]);
});

describe('item edit — load states', () => {
  it('shows nothing while the row read is in flight', async () => {
    mockUseItemDetail.mockReturnValue({ item: null, loading: true });

    await render(<ItemEditScreen />);

    expect(screen.getByTestId('item-edit-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('item-edit-form')).toBeNull();
  });

  it('reports a vanished item rather than a broken form', async () => {
    mockUseItemDetail.mockReturnValue({ item: null, loading: false });

    await render(<ItemEditScreen />);

    expect(screen.getByTestId('item-edit-missing')).toBeOnTheScreen();
  });
});

describe('item edit — the shared Review screen, pre-filled from the row', () => {
  it('pre-fills the fields from the row, not from page metadata', async () => {
    mockUseItemDetail.mockReturnValue({
      item: anItem({ category: 'Outerwear', name: 'Parka', brand: 'Acme', season: ['winter'] }),
      loading: false,
    });

    await render(<ItemEditScreen />);

    expect(screen.getByTestId('category-chip-Outerwear').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('review-name').props.value).toBe('Parka');
    expect(screen.getByTestId('review-brand').props.value).toBe('Acme');
    expect(screen.getByTestId('season-chip-winter').props.accessibilityState.selected).toBe(true);
  });

  it('carries a Delete Item row at the bottom (Edit-mode only)', async () => {
    await render(<ItemEditScreen />);

    expect(screen.getByTestId('item-delete')).toBeOnTheScreen();
  });
});

describe('item edit — Cancel / Save nav bar', () => {
  it('Save commits the edited fields, omits source_url, and returns to detail', async () => {
    const user = userEvent.setup();
    await render(<ItemEditScreen />);

    await user.clear(screen.getByTestId('review-name'));
    await user.type(screen.getByTestId('review-name'), 'Trail runner');
    await user.press(screen.getByTestId('item-edit-save'));

    expect(mockUpdateItem).toHaveBeenCalledWith(
      3,
      { category: 'Footwear', name: 'Trail runner', brand: 'Nike', season: null },
      null,
    );
    // source_url is preserved by absence — never part of the submission.
    expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('sourceUrl');
    expect(mockBack).toHaveBeenCalled();
  });

  it('Cancel abandons without writing', async () => {
    const user = userEvent.setup();
    await render(<ItemEditScreen />);

    await user.type(screen.getByTestId('review-name'), 'edited');
    await user.press(screen.getByTestId('item-edit-cancel'));

    expect(mockUpdateItem).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('item edit — replace photo', () => {
  it('runs the standard pipeline: a replacement capture is committed with the old file', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockCaptureFromLibrary.mockResolvedValue({
      status: 'captured',
      capture: { uri: 'file:///cache/new.jpg', width: 4032, height: 3024, uuid: 'newuuid' },
    });

    const user = userEvent.setup();
    await render(<ItemEditScreen />);

    // Tapping Replace photo offers the two sources; pick "Choose from Library".
    await user.press(screen.getByTestId('item-edit-replace'));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const library = buttons.find((b) => b.text === 'Choose from Library');
    await act(async () => {
      await library?.onPress?.();
    });

    await user.press(screen.getByTestId('item-edit-save'));

    expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({ category: 'Footwear' }), {
      image: { uri: 'file:///cache/new.jpg', width: 4032, height: 3024, uuid: 'newuuid' },
      previousImageFile: '3.jpg',
    });
  });

  it('keeps the current photo when no replacement is picked', async () => {
    const user = userEvent.setup();
    await render(<ItemEditScreen />);

    await user.press(screen.getByTestId('item-edit-save'));

    // Third arg null — a plain field update, no replace-photo run.
    expect(mockUpdateItem.mock.calls[0][2]).toBeNull();
  });
});

/**
 * §8.3 / §8.4 — Delete lives at the bottom of Edit, and its confirm surfaces the
 * **concrete** impact read at the moment of the tap. Deleting an item is nearly
 * harmless, so the confirm reassures; the one case where it can cost history —
 * emptying an outfit — is an explicit, opt-in third outcome.
 */
function pressedButtons(alert: jest.SpyInstance) {
  const call = alert.mock.calls.at(-1);
  return (call?.[2] ?? []) as { text: string; style?: string; onPress?: () => void }[];
}

describe('item edit — delete confirm (§8.3)', () => {
  it('reassures with "Nothing else changes" for an item in no outfit', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<ItemEditScreen />);

    await user.press(screen.getByTestId('item-delete'));

    expect(mockReadItemDeleteImpact).toHaveBeenCalledWith(3);
    expect(alert.mock.calls.at(-1)?.[1]).toBe('Nothing else changes.');
    const buttons = pressedButtons(alert);
    expect(buttons.map((b) => b.text)).toEqual(['Delete Item', 'Cancel']);
    // With no third outcome to weigh it against, the single action is the
    // destructive one.
    expect(buttons[0].style).toBe('destructive');
  });

  it('names the real outfits and promises wear history is untouched', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockReadItemDeleteImpact.mockReturnValue([
      { id: 10, name: 'Weekday default', itemCount: 4, wearCount: 12 },
      { id: 20, name: 'Smart evening', itemCount: 3, wearCount: 2 },
    ]);

    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));

    expect(alert.mock.calls.at(-1)?.[1]).toBe(
      'Used in 2 outfits — Weekday default, Smart evening. ' +
        "They'll keep their other items, and your wear history won't change.",
    );
  });

  it('deletes the row and its one file, then leaves the item behind entirely', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));

    await act(async () => {
      pressedButtons(alert).find((b) => b.text === 'Delete Item')?.onPress?.();
    });

    expect(mockDeleteItem).toHaveBeenCalledWith(3, '3.jpg', []);
    // Both Edit and the detail underneath it are describing a row that no longer
    // exists, so the delete leaves the pair rather than popping into a tombstone.
    expect(mockDismissTo).toHaveBeenCalledWith('/');
  });

  it('writes nothing when the confirm is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));

    const cancel = pressedButtons(alert).find((b) => b.text === 'Cancel');
    expect(cancel?.style).toBe('cancel');
    expect(cancel?.onPress).toBeUndefined();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });
});

describe('item edit — the last-item third outcome (§8.4)', () => {
  const lastItemIn = (...outfits: DeleteImpactOutfit[]) =>
    mockReadItemDeleteImpact.mockReturnValue(outfits);

  it('offers all three outcomes with the wear cost named, item-only first', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    lastItemIn({ id: 10, name: 'Weekday default', itemCount: 1, wearCount: 12 });

    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));

    const buttons = pressedButtons(alert);
    expect(buttons.map((b) => b.text)).toEqual([
      'Delete item only',
      'Delete item + outfit',
      'Cancel',
    ]);
    // Item-only is the default: first, and the one outcome here that isn't
    // styled destructive, because it's the one that costs no wear history.
    expect(buttons[0].style).toBe('default');
    expect(buttons[1].style).toBe('destructive');
    // The offer is never silent about the wear cost.
    expect(alert.mock.calls.at(-1)?.[1]).toContain(
      'Delete it too and those 12 wears disappear from your stats.',
    );
  });

  it('keeps the emptied outfit when item-only is chosen — cleanup is opt-in', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    lastItemIn({ id: 10, name: 'Weekday default', itemCount: 1, wearCount: 12 });

    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));
    await act(async () => {
      pressedButtons(alert).find((b) => b.text === 'Delete item only')?.onPress?.();
    });

    expect(mockDeleteItem).toHaveBeenCalledWith(3, '3.jpg', []);
  });

  it('takes only the outfits it named when cleanup is chosen, pluralized', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    lastItemIn(
      { id: 10, name: 'Weekday default', itemCount: 1, wearCount: 12 },
      { id: 20, name: 'Smart evening', itemCount: 1, wearCount: 3 },
      { id: 30, name: 'Rainy day', itemCount: 5, wearCount: 9 },
    );

    const user = userEvent.setup();
    await render(<ItemEditScreen />);
    await user.press(screen.getByTestId('item-delete'));
    await act(async () => {
      pressedButtons(alert).find((b) => b.text === 'Delete item + 2 outfits')?.onPress?.();
    });

    // Outfit 30 survives — it keeps its other garments, so it was never offered.
    expect(mockDeleteItem).toHaveBeenCalledWith(3, '3.jpg', [10, 20]);
  });
});
