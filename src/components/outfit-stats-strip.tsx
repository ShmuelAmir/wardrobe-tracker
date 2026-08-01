import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysSince, isoMonth, isoYear } from '@/date-format';
import type { OutfitStats } from '@/db/queries';
import { useTheme, type Theme } from '@/theme';

/**
 * §8.5 stats strip — three derived cells: **times worn / last worn / first
 * worn**, no stored counters. The wears cell is the one affordance here: it's
 * tappable (`12 · wears ›`) and opens the durable un-log path — the history
 * sheet — for the "I logged Tuesday by mistake" case a long-expired toast can
 * never reach. Last/first worn speak in **relative** language per #67 — last as
 * `Nd` / "since last", first as a month glyph / "first worn {YYYY}" — and read
 * "—" until there's a wear to date. The absolute dates still live one tap away,
 * in the history sheet.
 */
export function OutfitStatsStrip({
  stats,
  onPressWears,
}: {
  stats: OutfitStats;
  onPressWears: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { timesWorn, firstWorn, lastWorn } = stats;
  const daysSinceLast = lastWorn === null ? null : daysSince(lastWorn, new Date());

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
        <Text style={styles.value}>{daysSinceLast === null ? '—' : `${daysSinceLast}d`}</Text>
        <Text style={styles.label}>since last</Text>
      </View>

      <View style={styles.cell} testID="stats-first-worn">
        <Text style={styles.value}>{firstWorn ? isoMonth(firstWorn) : '—'}</Text>
        <Text style={styles.label}>
          {firstWorn ? `first worn ${isoYear(firstWorn)}` : 'first worn'}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    strip: {
      backgroundColor: theme.fill,
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
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    label: {
      color: theme.textSecondary,
      fontSize: 12,
      opacity: 0.55,
    },
  });
}
