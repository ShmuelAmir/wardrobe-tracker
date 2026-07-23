import { render, screen } from '@testing-library/react-native';

import OutfitDetailScreen from '@/app/outfit/[id]';
import type { Item, Outfit } from '@/db/schema';

function anItem(id: number): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category: 'Top',
    name: null,
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(),
  };
}

function anOutfit(overrides: Partial<Outfit> = {}): Outfit {
  return { id: 7, name: 'Smart evening', occasion: 'Work', createdAt: new Date(), ...overrides };
}

const mockUseOutfitDetail = jest.fn();
jest.mock('@/db/queries', () => ({ useOutfitDetail: () => mockUseOutfitDetail() }));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  Stack: { Screen: () => null },
}));

beforeEach(() => jest.clearAllMocks());

/**
 * §6.1.5 — the landing screen after Save. It reads the outfit and its items and
 * shows name, item count, and the occasion tag (no season, §6.3).
 */
describe('outfit detail — landing', () => {
  it('shows the name, item count and occasion tag', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1), anItem(2)] },
      loading: false,
    });

    await render(<OutfitDetailScreen />);

    expect(screen.getByTestId('outfit-detail')).toBeOnTheScreen();
    expect(screen.getByText('Smart evening')).toBeOnTheScreen();
    expect(screen.getByText('2 items')).toBeOnTheScreen();
    expect(screen.getByTestId('outfit-detail-occasion')).toHaveTextContent('Work');
  });

  it('omits the occasion tag when the outfit has none', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit({ occasion: null }), items: [anItem(1)] },
      loading: false,
    });

    await render(<OutfitDetailScreen />);

    expect(screen.queryByTestId('outfit-detail-occasion')).toBeNull();
    expect(screen.getByText('1 item')).toBeOnTheScreen();
  });

  it('shows nothing while the read is in flight', async () => {
    mockUseOutfitDetail.mockReturnValue({ detail: null, loading: true });

    await render(<OutfitDetailScreen />);

    expect(screen.getByTestId('outfit-detail-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfit-detail')).toBeNull();
  });
});
