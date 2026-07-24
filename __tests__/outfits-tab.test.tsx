import { render, screen, userEvent } from '@testing-library/react-native';

import OutfitsTab from '@/app/(tabs)/outfits';
import type { OutfitCard } from '@/db/queries';

const mockUseItems = jest.fn();
const mockUseOutfitCards = jest.fn();
jest.mock('@/db/queries', () => ({
  useItems: () => mockUseItems(),
  useOutfitCards: () => mockUseOutfitCards(),
  WEAR_AGAIN_RAIL_SIZE: 5,
}));

const mockLogWear = jest.fn();
const mockRemoveWear = jest.fn();
jest.mock('@/wear-log', () => ({
  logWear: (...args: unknown[]) => mockLogWear(...args),
  removeWear: (...args: unknown[]) => mockRemoveWear(...args),
  isoToday: () => '2026-07-24',
}));

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
}));

function aCard(overrides: Partial<OutfitCard> = {}): OutfitCard {
  return {
    id: 1,
    name: 'Weekday default',
    occasion: null,
    createdAt: new Date(),
    coverImage: 'a3f2c1de.jpg',
    itemCount: 3,
    lastWorn: null,
    timesWorn: 0,
    ...overrides,
  };
}

/** The common "wardrobe has items" precondition; each test supplies the cards. */
function withCards(cards: OutfitCard[]) {
  mockUseItems.mockReturnValue({ items: [{ id: 1, category: 'Top' }], loading: false });
  mockUseOutfitCards.mockReturnValue({ cards, loading: false });
}

beforeEach(() => jest.clearAllMocks());

/**
 * §7.5 — the two Outfits zero states are different screens. The gated one is a
 * precondition and carries no create button; the empty one is an invitation and
 * does. The nav-bar `+` (§7.3) tracks the same line.
 */
describe('Outfits zero states', () => {
  it('gates on an empty wardrobe with no create button and a hidden +', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: false });
    mockUseOutfitCards.mockReturnValue({ cards: [], loading: false });

    await render(<OutfitsTab />);

    expect(screen.getByTestId('outfits-gated')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfits-new-outfit')).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerRight: undefined }));
  });

  it('sends the gated screen to the Wardrobe rather than offering to create', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: false });
    mockUseOutfitCards.mockReturnValue({ cards: [], loading: false });
    const user = userEvent.setup();

    await render(<OutfitsTab />);
    await user.press(screen.getByTestId('outfits-go-to-wardrobe'));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows the ordinary empty with a live + once there are items but no outfits', async () => {
    withCards([]);

    await render(<OutfitsTab />);

    expect(screen.getByTestId('outfits-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfits-gated')).toBeNull();
    const headerRight = mockSetOptions.mock.calls.at(-1)?.[0].headerRight;
    expect(headerRight).toEqual(expect.any(Function));
  });

  it('opens the builder from the empty state and the +', async () => {
    withCards([]);
    const user = userEvent.setup();

    await render(<OutfitsTab />);
    await user.press(screen.getByTestId('outfits-new-outfit'));

    expect(mockPush).toHaveBeenCalledWith('/outfit-builder');
  });

  it('holds the screen blank while either read is still in flight', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: true });
    mockUseOutfitCards.mockReturnValue({ cards: [], loading: false });

    await render(<OutfitsTab />);

    expect(screen.getByTestId('outfits-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfits-gated')).toBeNull();
    expect(mockSetOptions).not.toHaveBeenCalled();
  });
});

/**
 * §7.1 — the rail is the fast path: the 5 most recently worn outfits, worn ones
 * only, and it doesn't render at all when nothing has ever been worn.
 */
describe('Wear again rail', () => {
  it('lists only worn outfits, never-worn never appearing', async () => {
    withCards([
      aCard({ id: 1, lastWorn: '2026-07-23', timesWorn: 2 }),
      aCard({ id: 2, lastWorn: null, timesWorn: 0 }),
    ]);

    await render(<OutfitsTab />);

    expect(screen.getByTestId('wear-again-card-1')).toBeOnTheScreen();
    expect(screen.queryByTestId('wear-again-card-2')).toBeNull();
  });

  it('does not render the rail section at all when nothing has ever been worn', async () => {
    withCards([aCard({ id: 1, lastWorn: null, timesWorn: 0 })]);

    await render(<OutfitsTab />);

    expect(screen.queryByTestId('wear-again-rail')).toBeNull();
    // ...but the never-worn outfit still lists below.
    expect(screen.getByTestId('outfit-card-1')).toBeOnTheScreen();
  });

  it('caps the rail at the 5 most recent', async () => {
    withCards(
      Array.from({ length: 7 }, (_, i) =>
        aCard({ id: i + 1, lastWorn: `2026-07-${20 - i}`, timesWorn: 1 }),
      ),
    );

    await render(<OutfitsTab />);

    expect(screen.getAllByTestId(/^wear-again-card-/)).toHaveLength(5);
  });
});

/**
 * §7.1 — "Wore it" writes today's wear in place: no navigation, an in-place
 * confirmation, and the same Undo toast Detail uses (§8.5). Undo deletes exactly
 * that event.
 */
describe('Wore it — one-tap, today, in place', () => {
  it('logs today without navigating, confirms in place, and raises the Undo toast', async () => {
    withCards([aCard({ id: 1, lastWorn: '2026-07-23', timesWorn: 1 })]);
    mockLogWear.mockReturnValue(99);
    const user = userEvent.setup();

    await render(<OutfitsTab />);
    await user.press(screen.getByTestId('wear-again-wore-it-1'));

    expect(mockLogWear).toHaveBeenCalledWith(1, '2026-07-24');
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('wear-again-confirmed-1')).toBeOnTheScreen();
    expect(screen.getByTestId('wear-toast')).toBeOnTheScreen();
  });

  it('undoes exactly the event just written and dismisses the toast', async () => {
    withCards([aCard({ id: 1, lastWorn: '2026-07-23', timesWorn: 1 })]);
    mockLogWear.mockReturnValue(99);
    const user = userEvent.setup();

    await render(<OutfitsTab />);
    await user.press(screen.getByTestId('wear-again-wore-it-1'));
    await user.press(screen.getByTestId('wear-toast-undo'));

    expect(mockRemoveWear).toHaveBeenCalledWith(99);
    expect(screen.queryByTestId('wear-toast')).toBeNull();
    expect(screen.queryByTestId('wear-again-confirmed-1')).toBeNull();
  });
});

/** §7.2 — every outfit renders in the list, in the order the merge hands them. */
describe('All outfits list', () => {
  it('renders one card per outfit and taps through to Detail', async () => {
    withCards([
      aCard({ id: 1, lastWorn: '2026-07-23', timesWorn: 1 }),
      aCard({ id: 2, lastWorn: null, timesWorn: 0 }),
    ]);
    const user = userEvent.setup();

    await render(<OutfitsTab />);
    expect(screen.getAllByTestId(/^outfit-card-\d+$/)).toHaveLength(2);

    await user.press(screen.getByTestId('outfit-card-2'));
    expect(mockPush).toHaveBeenCalledWith('/outfit/2');
  });

  it('marks a never-worn outfit as such on its card', async () => {
    withCards([aCard({ id: 2, lastWorn: null, timesWorn: 0 })]);

    await render(<OutfitsTab />);

    expect(screen.getByTestId('outfit-card-worn-2')).toHaveTextContent('Never worn');
  });
});
