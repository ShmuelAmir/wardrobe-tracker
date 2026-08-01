const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Jul 23, 2026" from a `Date` — the header's created date and any timestamp. */
export function formatDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Jul 2026" from a `Date` — the outfit header's coarsened "added {Mon YYYY}" meta. */
export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * The short month name of a `YYYY-MM-DD` day — the outfit strip's "first worn"
 * glyph. Parsed field by field, like `formatIsoDay`, to dodge the UTC-midnight
 * timezone shift.
 */
export function isoMonth(iso: string): string {
  const month = Number(iso.split('-')[1]);
  return MONTHS[month - 1];
}

/** The four-digit year of a `YYYY-MM-DD` day — the outfit strip's "first worn {YYYY}". */
export function isoYear(iso: string): string {
  return iso.split('-')[0];
}

/**
 * "Jul 23, 2026" from a `YYYY-MM-DD` string — wear days. Parsed **field by
 * field** rather than through `new Date(iso)`, which would read the string as
 * UTC midnight and shift the day back a timezone in the western hemisphere.
 */
export function formatIsoDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * Whole days from a `YYYY-MM-DD` wear day to `today` — the §8.1 "days since last
 * worn" stat. Both sides collapse to local midnight before differencing, so the
 * result is a calendar-day gap (the clock time of `today` never bleeds in) and,
 * like `formatIsoDay`, the ISO string is parsed field by field to dodge the
 * UTC-midnight timezone shift.
 */
export function daysSince(iso: string, today: Date): number {
  const [year, month, day] = iso.split('-').map(Number);
  const worn = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - worn) / 86_400_000);
}
