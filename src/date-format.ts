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

/**
 * "Jul 23, 2026" from a `YYYY-MM-DD` string — wear days. Parsed **field by
 * field** rather than through `new Date(iso)`, which would read the string as
 * UTC midnight and shift the day back a timezone in the western hemisphere.
 */
export function formatIsoDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}
