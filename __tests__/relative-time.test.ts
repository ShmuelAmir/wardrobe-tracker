import { daysSinceDate, daysSinceIso, humanizeDaysAgo } from '@/relative-time';

const TODAY = new Date(2026, 6, 24); // 2026-07-24, local

describe('daysSinceIso — calendar-day gap from a YYYY-MM-DD wear day', () => {
  it('counts whole calendar days, ignoring the clock time of today', () => {
    const today = new Date(2026, 6, 24, 23, 30); // late evening
    expect(daysSinceIso('2026-07-24', today)).toBe(0);
    expect(daysSinceIso('2026-07-23', today)).toBe(1);
    expect(daysSinceIso('2026-07-10', today)).toBe(14);
  });

  it('parses the ISO string field-by-field, so a western timezone does not shift the day', () => {
    // new Date("2026-07-24") would be UTC midnight and read as the 23rd in the
    // western hemisphere; field parsing keeps it the 24th.
    expect(daysSinceIso('2026-07-24', TODAY)).toBe(0);
  });
});

describe('daysSinceDate — calendar-day gap from a created-at Date', () => {
  it('collapses both sides to the local calendar day', () => {
    expect(daysSinceDate(new Date(2026, 6, 24, 8, 0), new Date(2026, 6, 24, 23, 0))).toBe(0);
    expect(daysSinceDate(new Date(2026, 6, 20, 8, 0), TODAY)).toBe(4);
  });
});

describe('humanizeDaysAgo — the row label', () => {
  it('reads today / yesterday for the near days', () => {
    expect(humanizeDaysAgo(0)).toBe('today');
    expect(humanizeDaysAgo(1)).toBe('yesterday');
  });

  it('reads plain days under a week', () => {
    expect(humanizeDaysAgo(3)).toBe('3 days ago');
    expect(humanizeDaysAgo(6)).toBe('6 days ago');
  });

  it('reads weeks, months, then years, singular where it should', () => {
    expect(humanizeDaysAgo(7)).toBe('1 week ago');
    expect(humanizeDaysAgo(20)).toBe('2 weeks ago');
    expect(humanizeDaysAgo(30)).toBe('1 month ago');
    expect(humanizeDaysAgo(200)).toBe('6 months ago');
    expect(humanizeDaysAgo(365)).toBe('1 year ago');
    expect(humanizeDaysAgo(900)).toBe('2 years ago');
  });
});
