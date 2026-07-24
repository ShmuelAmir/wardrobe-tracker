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
const mockUseOutfitDetail = jest.fn();
jest.mock('@/db/queries', () => ({
  useItems: () => mockUseItems(),
  useOccasionChips: () => mockUseOccasionChips(),
  useOutfitDetail: () => mockUseOutfitDetail(),
}));

const mockSaveOutfit = jest.fn();
const mockUpdateOutfit = jest.fn();
jest.mock('@/outfit-save', () => ({
  saveOutfit: (...args: unknown[]) => mockSaveOutfit(...args),
  updateOutfit: (...args: unknown[]) => mockUpdateOutfit(...args),
}));

const mockPush = jest.fn();
const mockDismissAll = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), dismissAll: mockDismissAll }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockUseItems.mockReturnValue({ items: [anItem(1), anItem(2)], loading: false });
  mockUseOccasionChips.mockReturnValue([]);
  mockUseOutfitDetail.mockReturnValue({ detail: null, loading: false });
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
    // The builder modal closes, then Detail is pushed as a card on the tabs.
    expect(mockDismissAll).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/outfit/7');
  });

  it('opens a category grid from "See all" without leaving the builder', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('see-all-Top'));

    expect(mockPush).toHaveBeenCalledWith('/outfit-builder/category/Top');
  });
});

/**
 * §8.5 Edit item set — `?editId=` seeds the builder from the outfit's current
 * set, and Save opens **§6's own review sheet** (not a separate tag editor) then
 * re-saves in place via `updateOutfit`.
 */
describe('outfit builder screen — edit mode', () => {
  beforeEach(() => {
    mockParams = { editId: '7' };
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: { id: 7, name: 'Weekday', occasion: 'Work', createdAt: new Date() }, items: [anItem(1)] },
      loading: false,
    });
  });

  it('pre-selects the outfit and saves through the review sheet, not a tag editor', async () => {
    const user = userEvent.setup();
    await renderScreen();

    // Seeded from the outfit: item 1 already selected, so Save is enabled with no
    // fresh taps and opens the builder's own review sheet.
    await user.press(screen.getByTestId('outfit-save'));
    expect(screen.getByTestId('outfit-review-sheet')).toBeOnTheScreen();

    await user.press(screen.getByTestId('review-commit'));

    await waitFor(() => expect(mockUpdateOutfit).toHaveBeenCalled());
    expect(mockUpdateOutfit.mock.calls[0][0]).toBe(7);
    expect(mockUpdateOutfit.mock.calls[0][1].itemIds).toEqual([1]);
    // The existing occasion rides into the sheet, so an untouched re-save keeps
    // it rather than clearing the tag.
    expect(mockUpdateOutfit.mock.calls[0][1].occasion).toBe('Work');
    // Edit re-saves in place: no new Detail is pushed, the builder just closes.
    expect(mockDismissAll).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSaveOutfit).not.toHaveBeenCalled();
  });
});
