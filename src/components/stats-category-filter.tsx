import { SegmentedControl, type Segment } from '@/components/segmented-control';
import type { StatsScope } from '@/db/queries';
import { CATEGORIES, type Category } from '@/db/schema';

/**
 * §9.4 — the global category filter: a seven-segment control (`All` + the six
 * categories) directly under the title, governing **both** leaderboards and the
 * never-worn list at once. One control, one state (§9.1).
 *
 * ⚠️ Known layout risk (§9.4): seven segments at 390pt is ~50pt each, and it
 * only fits with the `Outer`/`Acc.` abbreviations below plus `adjustsFontSizeToFit`
 * to absorb `Footwear`/`Bottom`. **If this proves cramped on the narrowest
 * supported device, the locked fallback is a horizontally-scrolling chip row
 * with full names — same information, same position, nothing else changes.**
 */

/** Only the two the spec names are abbreviated; the rest lean on font-shrink. */
const ABBREVIATION: Partial<Record<Category, string>> = {
  Outerwear: 'Outer',
  Accessory: 'Acc.',
};

const SEGMENTS: Segment<StatsScope>[] = [
  { key: 'All', value: null, label: 'All', accessibilityLabel: 'All items' },
  ...CATEGORIES.map((category) => ({
    key: category,
    value: category,
    label: ABBREVIATION[category] ?? category,
    accessibilityLabel: category,
  })),
];

export function StatsCategoryFilter({
  scope,
  onChange,
}: {
  scope: StatsScope;
  onChange: (scope: StatsScope) => void;
}) {
  return (
    <SegmentedControl
      segments={SEGMENTS}
      value={scope}
      onChange={onChange}
      accessibilityRole="button"
      testID="stats-category-filter"
      testIDPrefix="stats-filter-"
      shrinkLabels
    />
  );
}
