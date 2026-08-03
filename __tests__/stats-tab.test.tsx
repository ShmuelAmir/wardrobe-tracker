import { render, screen, userEvent } from '@testing-library/react-native';

import StatsTab from '@/app/(tabs)/stats';
import type { StatsData, StatsScope, WornItem } from '@/db/queries';
import type { Item } from '@/db/schema';

const mockUseStats = jest.fn();
jest.mock('@/db/queries', () => ({
  useStats: (scope: StatsScope) => mockUseStats(scope),
}));

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

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

/**
 * §9.2/§9.6 — "See all →" is the *only* way into the Wardrobe's filtered state,
 * so what it carries is the feature: the sort of the list tapped from **and**
 * the active category. Dropping the category would discard a just-expressed
 * intent and land the user on a list whose top row isn't what they were looking
 * at.
 */
describe('"See all →" hands the leaderboard to the Wardrobe tab (§9.2)', () => {
  const worn = [1, 2, 3, 4, 5, 6].map((id) => aWorn(id, 10 - id));
  const populated = statsData({
    wornCount: 6,
    k: 3,
    mostWorn: worn.slice(0, 3),
    leastWorn: worn.slice(3),
    neverWorn: [anItem(9)],
  });

  it('re-sorts the Wardrobe most-worn from the most-worn list', async () => {
    const user = userEvent.setup();
    returns(populated);

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-see-all-most'));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/',
      params: { sort: 'most', category: '' },
    });
  });

  it('re-sorts the Wardrobe least-worn from the least-worn list', async () => {
    const user = userEvent.setup();
    returns(populated);

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-see-all-least'));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/',
      params: { sort: 'least', category: '' },
    });
  });

  it('carries the active category filter through', async () => {
    const user = userEvent.setup();
    mockUseStats.mockReturnValue({ data: populated, loading: false });

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-filter-Footwear'));
    await user.press(screen.getByTestId('stats-see-all-most'));

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/',
      params: { sort: 'most', category: 'Footwear' },
    });
  });

  it('offers nothing to see all of when there is no leaderboard (k = 0)', async () => {
    returns(statsData({ neverWorn: [anItem(1), anItem(2)] }));

    await render(<StatsTab />);

    expect(screen.queryByTestId('stats-see-all-most')).toBeNull();
    expect(screen.queryByTestId('stats-see-all-least')).toBeNull();
  });

  // Never-worn is a finite set already shown in full (§9.3) — there is no
  // "more rows of the same question" to go to.
  it('does not offer it on the never-worn list', async () => {
    const user = userEvent.setup();
    returns(populated);

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-subtab-never'));

    expect(screen.queryByTestId('stats-see-all-least')).toBeNull();
  });
});

/**
 * The podium reads rank from height and 2–1–3 position — no medal emojis — and
 * the count is a plain "N wears": the row badge's unit word, not a bare metric.
 */
describe('podium — framing (§9.4)', () => {
  const worn = [1, 2, 3].map((id) => aWorn(id, 10 - id));

  beforeEach(() => {
    returns(statsData({ wornCount: 6, k: 3, mostWorn: worn }));
  });

  it('carries no medal emoji', async () => {
    await render(<StatsTab />);
    expect(screen.queryByText(/[🥇🥈🥉]/)).toBeNull();
  });

  it('labels #1 with the Favorite crown and counts in wears', async () => {
    await render(<StatsTab />);
    expect(screen.getByTestId('stats-podium-favorite')).toHaveTextContent('Favorite');
    expect(screen.getByTestId('stats-podium-1')).toHaveTextContent(/9 wears/);
  });
});

describe('rows — one unified badge everywhere (§9.5)', () => {
  it('spells the unit out on the leaderboard badge, singular at one wear', async () => {
    const worn = [aWorn(1, 5), aWorn(2, 1)];
    returns(statsData({ wornCount: 4, k: 2, mostWorn: worn, leastWorn: [aWorn(3, 1)] }));

    await render(<StatsTab />);
    expect(screen.getByTestId('stats-wear-badge-1')).toHaveTextContent('5 wears');
    expect(screen.getByTestId('stats-wear-badge-2')).toHaveTextContent('1 wear');
  });

  // Never-worn keeps the bare attention-toned `0`: it is the one badge whose job
  // is to look wrong, not to be read as a sentence.
  it('keeps the never-worn zero bare', async () => {
    returns(statsData({ neverWorn: [anItem(1)] }));

    await render(<StatsTab />);
    expect(screen.getByTestId('stats-zero-badge-1')).toHaveTextContent('0');
  });
});

describe('sub-tabs — one list at a time (§9.4)', () => {
  // A `(0)` is noise on a tab that is disabled (Least at `k = 0`) or empty — the
  // count only earns its parentheses when there is one.
  it('drops the count from a tab that has nothing to count', async () => {
    returns(statsData({ k: 0, neverWorn: [anItem(1), anItem(2)] }));

    await render(<StatsTab />);
    expect(screen.getByTestId('stats-subtab-least')).toHaveTextContent('Least worn');
    expect(screen.getByTestId('stats-subtab-least')).not.toHaveTextContent('(0)');
    expect(screen.getByTestId('stats-subtab-never')).toHaveTextContent('Never worn (2)');
  });

  it('congratulates instead of showing an empty never-worn list', async () => {
    const user = userEvent.setup();
    const worn = [aWorn(1, 5), aWorn(2, 4), aWorn(3, 1), aWorn(4, 1)];
    returns(
      statsData({ wornCount: 4, k: 2, mostWorn: worn.slice(0, 2), leastWorn: worn.slice(2) }),
    );

    await render(<StatsTab />);
    await user.press(screen.getByTestId('stats-subtab-never'));

    expect(screen.getByTestId('stats-never-worn-empty')).toHaveTextContent(/Everything’s been worn/);
  });
});

describe('sub-tabs — selection (§9.4)', () => {
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
