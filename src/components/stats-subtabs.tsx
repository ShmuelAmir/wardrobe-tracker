import { SegmentedControl, type Segment } from '@/components/segmented-control';

/** The two §9.4 sub-tabs — one list at a time, counts in the labels. */
export type SubTab = 'least' | 'never';

/**
 * §9.4 sub-tab bar: `Least worn (k)` / `Never worn (count)`, below the head.
 * **The Least tab is disabled when `k = 0`** — the screen forces `never` there,
 * so a fresh install can't land on an empty Least tab with the whole wardrobe
 * hidden behind the unselected one (a real bug caught in the prototype).
 *
 * Rendered as a **segmented control**, the same chrome as the category filter
 * stacked above it: both controls choose which slice of the same screen you're
 * looking at, so they should look like the same kind of switch.
 */
export function StatsSubTabs({
  active,
  leastCount,
  neverCount,
  onSelect,
}: {
  active: SubTab;
  leastCount: number;
  neverCount: number;
  onSelect: (tab: SubTab) => void;
}) {
  const segments: Segment<SubTab>[] = [
    {
      key: 'least',
      value: 'least',
      label: countedLabel('Least worn', leastCount),
      disabled: leastCount === 0,
    },
    { key: 'never', value: 'never', label: countedLabel('Never worn', neverCount) },
  ];
  return (
    <SegmentedControl
      segments={segments}
      value={active}
      onChange={onSelect}
      accessibilityRole="tab"
      testID="stats-subtabs"
      testIDPrefix="stats-subtab-"
    />
  );
}

/**
 * A `(0)` is noise: on the Least tab at `k = 0` it labels a segment the user
 * can't even press, and on either tab it counts nothing. The parentheses are
 * earned only by a count there is something to count.
 */
function countedLabel(label: string, count: number): string {
  return count === 0 ? label : `${label} (${count})`;
}
