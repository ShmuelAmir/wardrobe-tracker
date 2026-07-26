/**
 * §9.5 row labels — "worn N ago" on a leaderboard row (from a `YYYY-MM-DD` wear
 * day) and "added N ago" on a never-worn row (from a created-at `Date`). Kept
 * separate from `date-format.ts` (absolute "Jul 23, 2026" formatting): Stats
 * rows speak in *relative* time, which is a different question — "how long has
 * it been" rather than "which day".
 *
 * Every gap is a **calendar-day** gap: both sides collapse to local midnight (via
 * a `UTC` epoch of the y/m/d fields, so the arithmetic is DST-proof) before
 * differencing, and ISO strings are parsed field-by-field rather than through
 * `new Date(iso)` — which reads the string as UTC midnight and shifts the day
 * back a timezone in the western hemisphere.
 */

function utcDay(year: number, monthZeroBased: number, day: number): number {
  return Date.UTC(year, monthZeroBased, day);
}

/** Whole calendar days from a `YYYY-MM-DD` day to `today`. */
export function daysSinceIso(iso: string, today: Date): number {
  const [year, month, day] = iso.split('-').map(Number);
  const from = utcDay(year, month - 1, day);
  const now = utcDay(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - from) / 86_400_000);
}

/** Whole calendar days from a created-at `Date` to `today`, both localized. */
export function daysSinceDate(date: Date, today: Date): number {
  const from = utcDay(date.getFullYear(), date.getMonth(), date.getDate());
  const now = utcDay(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - from) / 86_400_000);
}

/**
 * A day count as a relative phrase — "today", "yesterday", then days, weeks,
 * months, years, singular where the count is one. Coarsening as the gap grows is
 * what makes §9.3's oldest-first never-worn sort legible: "added 8 months ago"
 * indicts a mistake the way "added 243 days ago" never would.
 */
export function humanizeDaysAgo(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return unit(Math.floor(days / 7), 'week');
  if (days < 365) return unit(Math.floor(days / 30), 'month');
  return unit(Math.floor(days / 365), 'year');
}

function unit(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'} ago`;
}
