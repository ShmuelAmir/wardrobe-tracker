import { daysSince, formatMonthYear, isoMonth, isoYear } from '@/date-format';
import { sourceHostname } from '@/source-url';

/**
 * §8.1 "days since last worn" is a whole-day gap between an ISO wear day and
 * today. Parsed field by field (like `formatIsoDay`) so it never shifts a day
 * across a timezone, and it is midnight-to-midnight so the number matches the
 * calendar, not the clock.
 */
describe('daysSince', () => {
  it('is 0 when the last wear is today', () => {
    expect(daysSince('2026-07-24', new Date(2026, 6, 24, 23, 0))).toBe(0);
  });

  it('counts whole days regardless of the time of day', () => {
    expect(daysSince('2026-07-20', new Date(2026, 6, 24, 1, 0))).toBe(4);
  });

  it('spans months without a timezone drift', () => {
    expect(daysSince('2026-06-30', new Date(2026, 6, 1))).toBe(1);
  });
});

/**
 * The relative-strip glyphs: the outfit header's coarsened "added {Mon
 * YYYY}" (from a `Date`) and the strip's "first worn" month/year (from an ISO
 * day, field-parsed like `formatIsoDay` to dodge the UTC-midnight shift).
 */
describe('month-year glyphs', () => {
  it('formats a Date as "Mon YYYY"', () => {
    expect(formatMonthYear(new Date(2026, 6, 23))).toBe('Jul 2026');
  });

  it('reads the month glyph from an ISO day without a timezone drift', () => {
    expect(isoMonth('2026-01-10')).toBe('Jan');
    expect(isoMonth('2026-12-31')).toBe('Dec');
  });

  it('reads the four-digit year from an ISO day', () => {
    expect(isoYear('2026-01-10')).toBe('2026');
  });
});

/**
 * §8.1 Source is the only field that leaves the app: it shows the product page's
 * hostname (a `www.` prefix is noise) and links out. The pasted string may be a
 * bare host or a resolved deep link — either way, the host is what a person
 * recognises.
 */
describe('sourceHostname', () => {
  it('reads the host from a full product URL and drops www.', () => {
    expect(sourceHostname('https://www.zara.com/us/en/some-shirt-p123.html')).toBe('zara.com');
  });

  it('keeps a host that has no www.', () => {
    expect(sourceHostname('http://shop.example.co.uk/item')).toBe('shop.example.co.uk');
  });

  it('falls back to the raw string when it cannot find a host', () => {
    expect(sourceHostname('not a url')).toBe('not a url');
  });
});
