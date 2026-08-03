import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/**
 * §9.4/§9.5 — the Stats screen's empty state: a **dashed-border card**, not
 * centered grey prose. The dashed outline is the point: it draws the shape of the
 * thing that isn't there yet (a leaderboard, a list of neglected items) so the
 * gap reads as a slot waiting to fill rather than as a screen that failed to
 * load.
 *
 * Copy stays the caller's — the two consumers say very different things (one
 * explains a missing ranking, the other congratulates a fully-worn wardrobe).
 */
export function StatsEmptyCard({
  title,
  body,
  testID,
}: {
  title: string;
  body: string;
  testID: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 12,
      borderStyle: 'dashed',
      borderWidth: 1,
      gap: 6,
      marginHorizontal: 16,
      marginVertical: 16,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    body: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
  });
}
