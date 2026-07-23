import { render } from '@testing-library/react-native';

import OutfitsTab from '@/app/(tabs)/outfits';

const mockUseItems = jest.fn();
jest.mock('@/db/queries', () => ({ useItems: () => mockUseItems() }));

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => jest.clearAllMocks());

/**
 * §7.3 — the Outfits `+` is contextual: it opens the builder when there is a
 * wardrobe to build from, and is **hidden on an empty wardrobe** (no button that
 * can't work, §3.1 rule 6).
 */
describe('Outfits tab — contextual add', () => {
  it('hides the + when the wardrobe is empty', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: false });

    await render(<OutfitsTab />);

    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerRight: undefined }));
  });

  it('shows a + that opens the builder once items exist', async () => {
    mockUseItems.mockReturnValue({
      items: [{ id: 1, category: 'Top' }],
      loading: false,
    });

    await render(<OutfitsTab />);

    const call = mockSetOptions.mock.calls.at(-1)?.[0];
    expect(call.headerRight).toEqual(expect.any(Function));
  });

  it('does not touch the header while the first read is in flight', async () => {
    mockUseItems.mockReturnValue({ items: [], loading: true });

    await render(<OutfitsTab />);

    expect(mockSetOptions).not.toHaveBeenCalled();
  });
});
