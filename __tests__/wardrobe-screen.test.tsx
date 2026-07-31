import { render, screen, userEvent } from '@testing-library/react-native';

import WardrobeTab from '@/app/(tabs)/index';
import type { Item } from '@/db/schema';

const mockUseWardrobeItems = jest.fn();
jest.mock('@/db/queries', () => ({
  useWardrobeItems: (view: unknown) => mockUseWardrobeItems(view),
}));

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockParams = jest.fn(() => ({}));
jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams(),
}));

function anItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    imageFile: 'a3f2c1de.jpg',
    category: 'Top',
    name: 'Grey tee',
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/** The default arrival: no params, whole wardrobe, newest first. */
function returns(items: Item[], overrides: { loading?: boolean; wardrobeEmpty?: boolean } = {}) {
  mockUseWardrobeItems.mockReturnValue({
    items,
    wardrobeEmpty: items.length === 0,
    loading: false,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.mockReturnValue({});
});

/**
 * §7.5 — the zero state *is* the onboarding, so what it says and how it is
 * framed are product decisions, not styling. Hence assertions on the copy
 * leading with the product-link path and on the nav bar being gone.
 */
describe('Wardrobe with zero items', () => {
  beforeEach(() => {
    returns([]);
  });

  it('renders the full-bleed hero, not the grid', async () => {
    await render(<WardrobeTab />);

    expect(screen.getByTestId('wardrobe-hero')).toBeOnTheScreen();
    expect(screen.queryByTestId('wardrobe-grid')).toBeNull();
  });

  it('leads its copy with the product-link path, the highest-quality source (§5)', async () => {
    await render(<WardrobeTab />);

    expect(screen.getByTestId('wardrobe-hero-body')).toHaveTextContent(/product link/i);
    expect(screen.getByText('Add your first item')).toBeOnTheScreen();
  });

  it('opens the add-item wizard from the hero CTA — the only entry point while the header is hidden', async () => {
    const user = userEvent.setup();
    await render(<WardrobeTab />);

    await user.press(screen.getByText('Add your first item'));

    expect(mockPush).toHaveBeenCalledWith('/add-item');
  });

  it('hides the nav bar — the hero is the only full-bleed screen in the app', async () => {
    await render(<WardrobeTab />);

    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerShown: false }));
  });
});

describe('Wardrobe with items', () => {
  it('renders a cover grid instead of the hero, one cell per item', async () => {
    returns([anItem({ id: 1 }), anItem({ id: 2, imageFile: 'b7e4d0aa.jpg' })]);

    await render(<WardrobeTab />);

    expect(screen.getByTestId('wardrobe-grid')).toBeOnTheScreen();
    expect(screen.queryByTestId('wardrobe-hero')).toBeNull();
    expect(screen.getAllByTestId(/^item-cell-/)).toHaveLength(2);
  });

  it('brings the nav bar back', async () => {
    returns([anItem()]);

    await render(<WardrobeTab />);

    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerShown: true }));
  });

  it('fits every tile with cover, which is what replaces stored thumbnails (§10.8)', async () => {
    returns([anItem()]);

    await render(<WardrobeTab />);

    expect(screen.getByTestId('item-image-1').props.contentFit).toBe('cover');
  });

  // #74 — the Wardrobe grid is the *labelled* variant: each tile carries the
  // item's name beneath it. (The shared grid on outfit Detail stays unlabelled.)
  it('labels each tile with the item name (the Wardrobe-scoped variant)', async () => {
    returns([anItem({ id: 1, name: 'Grey tee' })]);

    await render(<WardrobeTab />);

    expect(screen.getByTestId('item-label-1')).toHaveTextContent('Grey tee');
  });

  it('falls back to the category when a tile has no name', async () => {
    returns([anItem({ id: 1, name: null, category: 'Footwear' })]);

    await render(<WardrobeTab />);

    expect(screen.getByTestId('item-label-1')).toHaveTextContent('Footwear');
  });

  it('shows nothing rather than flashing the hero while the first read is in flight', async () => {
    returns([], { loading: true });

    await render(<WardrobeTab />);

    expect(screen.queryByTestId('wardrobe-hero')).toBeNull();
    expect(screen.queryByTestId('wardrobe-grid')).toBeNull();
  });
});

/**
 * §9.6 — the arrived-at state. There is **no standalone filter surface in v1**:
 * everything below is state the screen was *navigated into*, which is why the
 * assertions are about params in and params out rather than about controls.
 */
describe('arrived from Stats "See all →" (§9.6)', () => {
  beforeEach(() => {
    mockParams.mockReturnValue({ sort: 'most', category: 'Footwear' });
    returns([anItem({ id: 1, category: 'Footwear' })]);
  });

  it('reads the sort and category straight off the nav params', async () => {
    await render(<WardrobeTab />);

    expect(mockUseWardrobeItems).toHaveBeenCalledWith({ sort: 'most', category: 'Footwear' });
  });

  it('titles the screen with the category, so the shortened list is explained first', async () => {
    await render(<WardrobeTab />);

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerTitle: 'Footwear' }),
    );
  });

  it('shows one removable chip per active param', async () => {
    await render(<WardrobeTab />);

    expect(screen.getByTestId('wardrobe-chip-category')).toBeOnTheScreen();
    expect(screen.getByTestId('wardrobe-chip-sort')).toBeOnTheScreen();
    expect(screen.getByText('Footwear')).toBeOnTheScreen();
    expect(screen.getByText('Most worn')).toBeOnTheScreen();
  });

  // The independence is §9.6's decision: a single "Clear all" could not express
  // "drop the category but keep the most-worn sort".
  it('clears the category and keeps the sort', async () => {
    const user = userEvent.setup();
    await render(<WardrobeTab />);

    await user.press(screen.getByTestId('wardrobe-chip-clear-category'));

    expect(mockSetParams).toHaveBeenCalledWith({ sort: 'most', category: '' });
  });

  it('clears the sort and keeps the category', async () => {
    const user = userEvent.setup();
    await render(<WardrobeTab />);

    await user.press(screen.getByTestId('wardrobe-chip-clear-sort'));

    expect(mockSetParams).toHaveBeenCalledWith({ sort: '', category: 'Footwear' });
  });

  // The rows can go empty under a filter the user is still holding — an item
  // deleted while the category is active. That is a shortened list to clear a
  // chip from, never §7.5's first-run onboarding.
  it('keeps the chips and explains the gap when the filter empties the grid', async () => {
    returns([], { wardrobeEmpty: false });

    await render(<WardrobeTab />);

    expect(screen.queryByTestId('wardrobe-hero')).toBeNull();
    expect(screen.getByTestId('wardrobe-chip-category')).toBeOnTheScreen();
    expect(screen.getByTestId('wardrobe-filtered-empty')).toHaveTextContent(/Footwear/);
  });
});

describe('arrived at directly — no standalone filter or sort control (§9.6)', () => {
  it('shows the plain grid: no chips, no controls, the generic title', async () => {
    returns([anItem()]);

    await render(<WardrobeTab />);

    expect(screen.queryByTestId('wardrobe-chip-category')).toBeNull();
    expect(screen.queryByTestId('wardrobe-chip-sort')).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerTitle: 'Wardrobe' }),
    );
  });

  it('defaults the sort to recent', async () => {
    returns([anItem()]);

    await render(<WardrobeTab />);

    expect(mockUseWardrobeItems).toHaveBeenCalledWith({ sort: 'recent', category: null });
  });
});
