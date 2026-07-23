import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import OutfitBuilderScreen from '@/app/outfit-builder/index';
import { OutfitBuilderProvider } from '@/components/outfit-builder-draft';
import type { Item } from '@/db/schema';

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

const mockUseItems = jest.fn();
const mockUseOccasionChips = jest.fn();
jest.mock('@/db/queries', () => ({
  useItems: () => mockUseItems(),
  useOccasionChips: () => mockUseOccasionChips(),
}));

const mockSaveOutfit = jest.fn();
jest.mock('@/outfit-save', () => ({ saveOutfit: (...args: unknown[]) => mockSaveOutfit(...args) }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, dismissAll: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseItems.mockReturnValue({ items: [anItem(1), anItem(2)], loading: false });
  mockUseOccasionChips.mockReturnValue([]);
});

function renderScreen() {
  return render(
    <OutfitBuilderProvider>
      <OutfitBuilderScreen />
    </OutfitBuilderProvider>,
  );
}

/**
 * §6.1.4 / §6.1.5 — Save opens the review sheet, and committing writes the
 * outfit and **lands on its Detail screen**. The id `saveOutfit` returns is the
 * route it replaces into, so Back doesn't fall into a half-built flow.
 */
describe('outfit builder screen — commit', () => {
  it('opens the review sheet only after Save', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.queryByTestId('outfit-review-sheet')).toBeNull();

    await user.press(screen.getByTestId('select-item-1'));
    await user.press(screen.getByTestId('outfit-save'));

    expect(screen.getByTestId('outfit-review-sheet')).toBeOnTheScreen();
  });

  it('commits the selection and lands on the new outfit detail', async () => {
    mockSaveOutfit.mockReturnValueOnce(7);
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('select-item-1'));
    await user.press(screen.getByTestId('outfit-save'));
    await user.press(screen.getByTestId('review-commit'));

    await waitFor(() =>
      expect(mockSaveOutfit).toHaveBeenCalledWith({ name: '', occasion: '', itemIds: [1] }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/outfit/7');
  });

  it('opens a category grid from "See all" without leaving the builder', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('see-all-Top'));

    expect(mockPush).toHaveBeenCalledWith('/outfit-builder/category/Top');
  });
});
