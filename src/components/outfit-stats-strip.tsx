import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatIsoDay } from '@/date-format';
import type { OutfitStats } from '@/db/queries';

/**
 * §8.5 stats strip — three derived cells: **times worn / last worn / first
 * worn**, no stored counters. The wears cell is the one affordance here: it's
 * tappable (`12 · wears ›`) and opens the durable un-log path — the history
 * sheet — for the "I logged Tuesday by mistake" case a long-expired toast can
 * never reach. Last/first worn read "—" until there's a wear to date.
 */
export function OutfitStatsStrip({
  stats,
  onPressWears,
}: {
  stats: OutfitStats;
  onPressWears: () => void;
}) {
  const { timesWorn, firstWorn, lastWorn } = stats;

  return (
    <View style={styles.strip} testID="outfit-stats-strip">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${timesWorn} wears, view history`}
        onPress={onPressWears}
        style={styles.cell}
        testID="stats-wears"
      >
        <Text style={styles.value}>{timesWorn}</Text>
        <Text style={styles.label}>wears ›</Text>
      </Pressable>

      <View style={styles.cell} testID="stats-last-worn">
        <Text style={styles.value}>{lastWorn ? formatIsoDay(lastWorn) : '—'}</Text>
        <Text style={styles.label}>last worn</Text>
      </View>

      <View style={styles.cell} testID="stats-first-worn">
        <Text style={styles.value}>{firstWorn ? formatIsoDay(firstWorn) : '—'}</Text>
        <Text style={styles.label}>first worn</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: '#f5f4f8',
    borderRadius: 14,
    flexDirection: 'row',
    marginHorizontal: 20,
    paddingVertical: 14,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingHorizontal: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    opacity: 0.55,
  },
});
