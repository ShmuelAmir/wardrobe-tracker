import { render, screen, userEvent } from '@testing-library/react-native';

import OutfitDetailScreen from '@/app/outfit/[id]';
import type { OutfitStats, WearRow } from '@/db/queries';
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
  return {
    id: 7,
    name: 'Smart evening',
    occasion: 'Work',
    createdAt: new Date(2026, 6, 23),
    ...overrides,
  };
}

const mockUseOutfitDetail = jest.fn();
const mockUseOutfitStats = jest.fn<OutfitStats, []>();
const mockUseWearHistory = jest.fn<WearRow[], []>();
jest.mock('@/db/queries', () => ({
  useOutfitDetail: () => mockUseOutfitDetail(),
  useOutfitStats: () => mockUseOutfitStats(),
  useWearHistory: () => mockUseWearHistory(),
}));

const mockLogWear = jest.fn(() => 99);
const mockRemoveWear = jest.fn();
jest.mock('@/wear-log', () => ({
  logWear: (...args: unknown[]) => mockLogWear(...(args as [])),
  removeWear: (...args: unknown[]) => mockRemoveWear(...(args as [])),
  isoToday: () => '2026-07-23',
  // The calendar renders inside the screen and needs the real formatter.
  toIsoDate: (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`,
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

const noStats: OutfitStats = { timesWorn: 0, firstWorn: null, lastWorn: null };

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
  mockUseOutfitStats.mockReturnValue(noStats);
  mockUseWearHistory.mockReturnValue([]);
});

/**
 * §8.5 — the header shows name, item count, created date and occasion (no
 * season), and the strip derives stats.
 */
describe('outfit detail — header & stats', () => {
  it('shows name, item count, created date and occasion tag', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1), anItem(2)] },
      loading: false,
    });

    await render(<OutfitDetailScreen />);

    expect(screen.getByText('Smart evening')).toBeOnTheScreen();
    // Meta is one coarsened line: item count · month-year the outfit was added.
    expect(screen.getByTestId('outfit-detail-created')).toHaveTextContent(
      '2 items · added Jul 2026',
    );
    expect(screen.getByTestId('outfit-detail-occasion')).toHaveTextContent('Work');
    // No season anywhere on the outfit page (§6.3).
    expect(screen.queryByText(/season/i)).toBeNull();
  });

  it('derives times worn / since last / first worn into the strip in relative language', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1)] },
      loading: false,
    });
    // Last worn "5 days ago" so the relative `Nd` cell is deterministic.
    mockUseOutfitStats.mockReturnValue({
      timesWorn: 12,
      firstWorn: '2026-01-10',
      lastWorn: isoDaysAgo(5),
    });

    await render(<OutfitDetailScreen />);

    expect(screen.getByText('12')).toBeOnTheScreen();
    expect(screen.getByText('wears ›')).toBeOnTheScreen();
    // Since-last is a relative day count; first-worn is a month glyph + year.
    expect(screen.getByText('5d')).toBeOnTheScreen();
    expect(screen.getByText('since last')).toBeOnTheScreen();
    expect(screen.getByText('Jan')).toBeOnTheScreen();
    expect(screen.getByText('first worn 2026')).toBeOnTheScreen();
  });

  it('shows nothing while the read is in flight', async () => {
    mockUseOutfitDetail.mockReturnValue({ detail: null, loading: true });

    await render(<OutfitDetailScreen />);

    expect(screen.getByTestId('outfit-detail-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfit-detail')).toBeNull();
  });
});

/**
 * §8.5 wear logging — "Wore this today" writes one event for today and raises a
 * toast carrying Undo; Undo removes exactly that event.
 */
describe('outfit detail — wear logging & undo', () => {
  beforeEach(() => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1)] },
      loading: false,
    });
  });

  it('"Wore this today" logs today and shows a toast with Undo', async () => {
    const user = userEvent.setup();
    await render(<OutfitDetailScreen />);

    await user.press(screen.getByTestId('wore-today'));

    expect(mockLogWear).toHaveBeenCalledWith(7, '2026-07-23');
    expect(screen.getByTestId('wear-toast')).toBeOnTheScreen();
    expect(screen.getByTestId('wear-toast-undo')).toBeOnTheScreen();
  });

  it('Undo removes exactly the event just written and drops the toast', async () => {
    const user = userEvent.setup();
    await render(<OutfitDetailScreen />);

    await user.press(screen.getByTestId('wore-today'));
    await user.press(screen.getByTestId('wear-toast-undo'));

    expect(mockRemoveWear).toHaveBeenCalledWith(99);
    expect(screen.queryByTestId('wear-toast')).toBeNull();
  });

  it('"Other day" opens the backfill calendar', async () => {
    const user = userEvent.setup();
    await render(<OutfitDetailScreen />);

    expect(screen.queryByTestId('date-backfill-calendar')).toBeNull();
    await user.press(screen.getByTestId('wore-other-day'));

    expect(screen.getByTestId('date-backfill-calendar')).toBeOnTheScreen();
  });
});

/**
 * §8.5 — the wears cell opens the durable un-log path, the dated history sheet,
 * where an individual past wear can be removed.
 */
describe('outfit detail — wear history sheet', () => {
  it('opens the dated history sheet from the wears cell and removes a row', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1)] },
      loading: false,
    });
    mockUseWearHistory.mockReturnValue([
      { id: 5, wornOn: '2026-07-20' },
      { id: 3, wornOn: '2026-07-14' },
    ]);

    const user = userEvent.setup();
    await render(<OutfitDetailScreen />);
    await user.press(screen.getByTestId('stats-wears'));

    expect(screen.getByTestId('wear-history-sheet')).toBeOnTheScreen();
    expect(screen.getByText('Jul 20, 2026')).toBeOnTheScreen();

    await user.press(screen.getByTestId('history-remove-5'));
    expect(mockRemoveWear).toHaveBeenCalledWith(5);
  });
});

/**
 * §8.4 — an outfit can outlive all its garments. Deleting every item in it one
 * at a time and declining the cleanup each time leaves a **0-item outfit whose
 * wears still count**. That state is legal, not broken, so Detail **labels** it
 * rather than rendering a bare empty grid — the wears really did happen.
 */
describe('outfit detail — the zero-item outfit is labelled (§8.4)', () => {
  it('names the emptying and insists the wears still count toward stats', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [] },
      loading: false,
    });
    mockUseOutfitStats.mockReturnValue({
      timesWorn: 12,
      firstWorn: '2026-01-04',
      lastWorn: '2026-07-20',
    });

    await render(<OutfitDetailScreen />);

    expect(screen.getByTestId('outfit-zero-items')).toHaveTextContent(
      'Every item in this outfit was deleted — its 12 wears still count toward your stats.',
    );
  });

  it('claims no stats for an emptied outfit that was never worn', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [] },
      loading: false,
    });

    await render(<OutfitDetailScreen />);

    expect(screen.getByTestId('outfit-zero-items')).toHaveTextContent(
      'Every item in this outfit was deleted.',
    );
  });

  it('says nothing of the sort while the outfit still has garments', async () => {
    mockUseOutfitDetail.mockReturnValue({
      detail: { outfit: anOutfit(), items: [anItem(1)] },
      loading: false,
    });

    await render(<OutfitDetailScreen />);

    expect(screen.queryByTestId('outfit-zero-items')).toBeNull();
  });
});
