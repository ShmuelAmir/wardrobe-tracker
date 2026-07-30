import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { daysSince } from '@/date-format';
import type { ItemStats } from '@/db/queries';
import { useTheme, type Theme } from '@/theme';

/**
 * §8.1 stats strip — three derived cells: **wear count / days since last worn /
 * outfits count**, no stored counters (§3). Unlike the outfit strip none of
 * these is tappable: this is the read path, which stays safe to browse (no wear
 * logging, no un-log sheet here). Days-since reads "—" until there's a wear to
 * date, which is the same "never worn" a zero wear count states — the two cells
 * agree by construction. The day math itself is proven directly against
 * `daysSince` (`item-detail-helpers.test.ts`).
 */
export function ItemStatsStrip({
  stats,
  outfitsCount,
}: {
  stats: ItemStats;
  outfitsCount: number;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { wearCount, lastWorn } = stats;
  const days = lastWorn === null ? null : daysSince(lastWorn, new Date());

  return (
    <View style={styles.strip} testID="item-stats-strip">
      <View style={styles.cell}>
        <Text style={styles.value} testID="item-stat-wears">
          {wearCount}
        </Text>
        <Text style={styles.label}>{wearCount === 1 ? 'wear' : 'wears'}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.value} testID="item-stat-days">
          {days === null ? '—' : days}
        </Text>
        <Text style={styles.label}>days since worn</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.value} testID="item-stat-outfits">
          {outfitsCount}
        </Text>
        <Text style={styles.label}>{outfitsCount === 1 ? 'outfit' : 'outfits'}</Text>
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
      textAlign: 'center',
    },
  });
}
