import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { spacing, useTheme, type Theme } from '@/theme';

/**
 * §8.5 wear logging — the only thing a user does daily, so **"Wore this today"**
 * is the big primary action and **"Other day"** is the quiet secondary that
 * opens a calendar for past-date backfill. One tap, one `wear_event`.
 *
 * The primary rides the `accent`/`onAccent` pair; the secondary is a tonal
 * `border` fill with an `accent` label, so it reads as the quieter sibling in
 * both themes.
 */
export function WearLogger({
  onToday,
  onOtherDay,
}: {
  onToday: () => void;
  onOtherDay: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row} testID="wear-logger">
      <Pressable
        accessibilityRole="button"
        onPress={onToday}
        style={styles.primary}
        testID="wore-today"
      >
        <Text style={styles.primaryLabel}>Wore this today</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onOtherDay}
        style={styles.secondary}
        testID="wore-other-day"
      >
        <Text style={styles.secondaryLabel}>Other day</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
    },
    primary: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      flex: 1,
      paddingVertical: spacing.lg,
    },
    primaryLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '700',
    },
    secondary: {
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: 14,
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    secondaryLabel: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
