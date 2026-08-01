import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/**
 * §7 — the small-caps section heading shared by the Outfits tab's two sections
 * ("Wear again", "All outfits") in Variant C (#75). One place for the uppercased,
 * letter-spaced idiom so the two headers can't drift. It carries an optional
 * `subLabel` (the rail's "tap to log for today") and an optional trailing `count`
 * (the all-outfits total) — a heading needs at most one of the two.
 */
export function SectionHeading({
  title,
  subLabel,
  count,
}: {
  title: string;
  subLabel?: string;
  count?: number;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: 2,
      paddingHorizontal: 20,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    title: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    count: {
      color: theme.textTertiary,
      fontSize: 13,
      fontWeight: '600',
    },
    subLabel: {
      color: theme.textTertiary,
      fontSize: 13,
    },
  });
}
