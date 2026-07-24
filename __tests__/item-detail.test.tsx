import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import ItemDetailScreen from '@/app/item/[id]';
import type { ItemOutfit, ItemStats } from '@/db/queries';
import type { Item } from '@/db/schema';

// expo-image's <Image> is a native view; a testID-preserving stand-in lets the
// hero be queried and its onError invoked without a real decoder.
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
const mockUseItemStats = jest.fn<ItemStats, []>();
const mockUseItemOutfits = jest.fn<ItemOutfit[], []>();
jest.mock('@/db/queries', () => ({
  useItemDetail: () => mockUseItemDetail(),
  useItemStats: () => mockUseItemStats(),
  useItemOutfits: () => mockUseItemOutfits(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '3' }),
  useRouter: () => ({ push: mockPush }),
  // Render the nav bar's headerRight so the Edit affordance is queryable; the
  // real Stack.Screen only registers options with the navigator.
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => unknown } }) =>
      options?.headerRight?.() ?? null,
  },
}));

const noStats: ItemStats = { wearCount: 0, lastWorn: null };

/** An ISO `YYYY-MM-DD` string `days` before today, for a deterministic days-since. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseItemStats.mockReturnValue(noStats);
  mockUseItemOutfits.mockReturnValue([]);
  mockUseItemDetail.mockReturnValue({ item: anItem(), loading: false });
});

describe('item detail — hero, name & brand', () => {
  it('renders the hero image, name and brand', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-hero-image')).toBeOnTheScreen();
    expect(screen.getByText('Runner')).toBeOnTheScreen();
    expect(screen.getByText('Nike')).toBeOnTheScreen();
  });

  it('degrades a missing image file to a category placeholder, not a broken tile', async () => {
    await render(<ItemDetailScreen />);

    await act(async () => screen.getByTestId('item-hero-image').props.onError());

    expect(screen.getByTestId('item-hero-placeholder')).toHaveTextContent('Footwear');
    expect(screen.queryByTestId('item-hero-image')).toBeNull();
  });

  it('shows nothing while the read is in flight', async () => {
    mockUseItemDetail.mockReturnValue({ item: null, loading: true });

    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-detail-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('item-detail')).toBeNull();
  });

  it('reports a vanished item rather than a broken page', async () => {
    mockUseItemDetail.mockReturnValue({ item: null, loading: false });

    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-detail-missing')).toBeOnTheScreen();
  });
});

describe('item detail — stats strip', () => {
  it('derives wear count, days since last worn and outfits count', async () => {
    mockUseItemStats.mockReturnValue({ wearCount: 5, lastWorn: isoDaysAgo(4) });
    mockUseItemOutfits.mockReturnValue([
      { id: 10, name: 'A', coverImage: '3.jpg' },
      { id: 20, name: 'B', coverImage: '3.jpg' },
    ]);

    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-stat-wears')).toHaveTextContent('5');
    expect(screen.getByTestId('item-stat-days')).toHaveTextContent('4');
    expect(screen.getByTestId('item-stat-outfits')).toHaveTextContent('2');
  });

  it('shows a dash for days since worn when the item has never been worn', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-stat-wears')).toHaveTextContent('0');
    expect(screen.getByTestId('item-stat-days')).toHaveTextContent('—');
  });
});

describe('item detail — fields', () => {
  it('renders category, added date, and "Any season" for a null season', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-field-category')).toHaveTextContent('Footwear');
    expect(screen.getByTestId('item-field-season')).toHaveTextContent('Any season');
    expect(screen.getByTestId('item-field-added')).toHaveTextContent('Jan 15, 2026');
  });

  it('lists selected seasons in canonical order', async () => {
    mockUseItemDetail.mockReturnValue({
      item: anItem({ season: ['winter', 'spring'] }),
      loading: false,
    });

    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-field-season')).toHaveTextContent('Spring, Winter');
  });

  it('omits Source for an item with no source_url', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.queryByTestId('item-source')).toBeNull();
  });

  it('shows Source as the hostname and opens it externally for a web-imported item', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUseItemDetail.mockReturnValue({
      item: anItem({ sourceUrl: 'https://www.zara.com/us/en/shirt-p123.html' }),
      loading: false,
    });

    const user = userEvent.setup();
    await render(<ItemDetailScreen />);

    const source = screen.getByTestId('item-source');
    expect(source).toHaveTextContent('zara.com');

    await user.press(source);
    expect(openURL).toHaveBeenCalledWith('https://www.zara.com/us/en/shirt-p123.html');
  });
});

describe('item detail — nav bar & in-outfits rail', () => {
  it('offers Edit in the nav bar and no delete anywhere on the screen', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('item-edit')).toBeOnTheScreen();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it('opens the edit route from the nav bar', async () => {
    const user = userEvent.setup();
    await render(<ItemDetailScreen />);

    await user.press(screen.getByTestId('item-edit'));

    expect(mockPush).toHaveBeenCalledWith('/item/3/edit');
  });

  it('lists containing outfits and taps through to outfit detail', async () => {
    mockUseItemOutfits.mockReturnValue([{ id: 20, name: 'Weekend', coverImage: '3.jpg' }]);

    const user = userEvent.setup();
    await render(<ItemDetailScreen />);

    await user.press(screen.getByTestId('in-outfit-20'));

    expect(mockPush).toHaveBeenCalledWith('/outfit/20');
  });

  it('explains a zero wear count when the item is in no outfit', async () => {
    await render(<ItemDetailScreen />);

    expect(screen.getByTestId('in-outfits-empty')).toHaveTextContent(
      "Not in any outfit yet — that's why it has never been worn.",
    );
  });
});
