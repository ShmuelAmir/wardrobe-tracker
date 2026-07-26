import { render, screen, userEvent } from '@testing-library/react-native';

import StatsTab from '@/app/(tabs)/stats';
import type { StatsData, StatsScope, WornItem } from '@/db/queries';
import type { Item } from '@/db/schema';

const mockUseStats = jest.fn();
jest.mock('@/db/queries', () => ({
  useStats: (scope: StatsScope) => mockUseStats(scope),
}));

function anItem(id: number, overrides: Partial<Item> = {}): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category: 'Top',
    name: `Item ${id}`,
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(2026, 0, id),
    ...overrides,
  };
}

function aWorn(id: number, wearCount: number): WornItem {
  return { ...anItem(id), wearCount, lastWorn: '2026-07-20' };
}

function statsData(overrides: Partial<StatsData> = {}): StatsData {
  return { wornCount: 0, k: 0, mostWorn: [], leastWorn: [], neverWorn: [], ...overrides };
}

/** Default: `k = 0` fresh install unless a test overrides via mockImplementation. */
function returns(data: StatsData) {
  mockUseStats.mockReturnValue({ data, loading: false });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fresh install — k = 0, everything never-worn (§9.4)', () => {
  beforeEach(() => {
    returns(
      statsData({
        wornCount: 0,
        k: 0,
        neverWorn: [anItem(1), anItem(2), anItem(3)],
      }),
    );
  });

  it('shows the honest empty copy and no podium', async () => {
    await render(<StatsTab />);
    expect(screen.getByTestId('stats-most-worn-empty')).toHaveTextContent(/No ranking yet/);
    expect(screen.queryByTestId('stats-podium')).toBeNull();
  });

  it('forces the Never tab, disables Least, and shows the whole wardrobe — not two empty things', async () => {
    await render(<StatsTab />);
    // Least tab is disabled; the wardrobe is visible on Never, not hidden.
    expect(screen.getByTestId('stats-subtab-least')).toBeDisabled();
    expect(screen.getByTestId('stats-never-row-1')).toBeOnTheScreen();
    expect(screen.getByTestId('stats-never-row-3')).toBeOnTheScreen();
    // Every never-worn row carries its "added N ago" line (§9.5).
    expect(screen.getByTestId('stats-added-1')).toBeOnTheScreen();
  });
});

describe('filtered to one worn item — k = 0 (§9.5)', () => {
  it('names the category in the empty copy after re-scoping', async () => {
    const user = userEvent.setup();
    mockUseStats.mockImplementation((scope: StatsScope) =>
      scope === 'Bottom'
        ? { data: statsData({ wornCount: 1, k: 0, neverWorn: [] }), loading: false }
        : { data: statsData({ wornCount: 0, k: 0, neverWorn: [anItem(1)] }), loading: false },
    );

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-filter-Bottom'));

    expect(screen.getByTestId('stats-most-worn-empty')).toHaveTextContent(
      /Only one item in Bottom has been worn/,
    );
  });
});

describe('podium is sized by k, never fixed at 3 (§9.4)', () => {
  it('renders the podium with a Favorite tag at k ≥ 3', async () => {
    const worn = [1, 2, 3, 4, 5, 6].map((id) => aWorn(id, 10 - id));
    returns(statsData({ wornCount: 6, k: 3, mostWorn: worn.slice(0, 3), leastWorn: worn.slice(3) }));

    await render(<StatsTab />);
    expect(screen.getByTestId('stats-podium')).toBeOnTheScreen();
    expect(screen.getByTestId('stats-podium-favorite')).toBeOnTheScreen();
  });

  it('renders ranked rows and no podium at k of 1–2', async () => {
    const worn = [aWorn(1, 5), aWorn(2, 4), aWorn(3, 1), aWorn(4, 1)];
    returns(statsData({ wornCount: 4, k: 2, mostWorn: worn.slice(0, 2), leastWorn: worn.slice(2) }));

    await render(<StatsTab />);
    expect(screen.queryByTestId('stats-podium')).toBeNull();
    // Most-worn head shows as ranked rows; Least tab (default) shows its rows.
    expect(screen.getByTestId('stats-leader-row-1')).toBeOnTheScreen();
  });
});

describe('sub-tabs — one list at a time (§9.4)', () => {
  it('defaults to Least worn and toggles to Never worn on tap', async () => {
    const user = userEvent.setup();
    const worn = [aWorn(1, 5), aWorn(2, 4), aWorn(3, 1), aWorn(4, 1)];
    returns(
      statsData({
        wornCount: 4,
        k: 2,
        mostWorn: worn.slice(0, 2),
        leastWorn: worn.slice(2),
        neverWorn: [anItem(9)],
      }),
    );

    await render(<StatsTab />);
    // Least is default: its rows are present, the never row is not.
    expect(screen.getByTestId('stats-leader-row-3')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats-never-row-9')).toBeNull();

    await user.press(screen.getByTestId('stats-subtab-never'));
    expect(screen.getByTestId('stats-never-row-9')).toBeOnTheScreen();
  });
});
