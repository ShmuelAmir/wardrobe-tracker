import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ItemEditScreen from '@/app/item/[id]/edit';
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

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '3' }),
  useRouter: () => ({ back: mockBack }),
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
