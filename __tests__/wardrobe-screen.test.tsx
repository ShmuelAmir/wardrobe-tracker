import { render, screen, userEvent } from '@testing-library/react-native';

import WardrobeTab from '@/app/(tabs)/index';
import type { Item } from '@/db/schema';

const mockUseItems = jest.fn();
jest.mock('@/db/queries', () => ({ useItems: () => mockUseItems() }));

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush }),
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

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * §7.5 — the zero state *is* the onboarding, so what it says and how it is
 * framed are product decisions, not styling. Hence assertions on the copy
 * leading with the product-link path and on the nav bar being gone.
 */
describe('Wardrobe with zero items', () => {
  beforeEach(() => {
    mockUseItems.mockReturnValue({ items: [], loading: false });
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
    mockUseItems.mockReturnValue({
      items: [anItem({ id: 1 }), anItem({ id: 2, imageFile: 'b7e4d0aa.jpg' })],
      loading: false,
    });

    await render(<WardrobeTab />);

    expect(screen.getByTestId('wardrobe-grid')).toBeOnTheScreen();
    expect(screen.queryByTestId('wardrobe-hero')).toBeNull();
    expect(screen.getAllByTestId(/^item-cell-/)).toHaveLength(2);
  });

  it('brings the nav bar back', async () => {
    mockUseItems.mockReturnValue({ items: [anItem()], loading: false });

    await render(<WardrobeTab />);

    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerShown: true }));
  });

  it('fits every tile with cover, which is what replaces stored thumbnails (§10.8)', async () => {
    mockUseItems.mockReturnValue({ items: [anItem()], loading: false });

    await render(<WardrobeTab />);

    expect(screen.getByTestId('item-image-1').props.contentFit).toBe('cover');
  });

  it('shows nothing rather than flashing the hero while the first read is in flight', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: true });

    await render(<WardrobeTab />);

    expect(screen.queryByTestId('wardrobe-hero')).toBeNull();
    expect(screen.queryByTestId('wardrobe-grid')).toBeNull();
  });
});
