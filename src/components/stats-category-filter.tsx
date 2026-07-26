import { Pressable, StyleSheet, Text, View } from 'react-native';

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

type Segment = { scope: StatsScope; key: string; label: string; full: string };

const SEGMENTS: Segment[] = [
  { scope: null, key: 'All', label: 'All', full: 'All items' },
  ...CATEGORIES.map((category) => ({
    scope: category,
    key: category,
    label: ABBREVIATION[category] ?? category,
    full: category,
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
    <View style={styles.track} testID="stats-category-filter">
      {SEGMENTS.map((segment) => {
        const selected = segment.scope === scope;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.full}
            testID={`stats-filter-${segment.key}`}
            onPress={() => onChange(segment.scope)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.label, selected && styles.labelSelected]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#eceaf2',
    borderRadius: 10,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  segmentSelected: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  label: {
    color: '#5a5568',
    fontSize: 13,
    fontWeight: '600',
  },
  labelSelected: {
    color: '#3a2a6d',
    fontWeight: '700',
  },
});
