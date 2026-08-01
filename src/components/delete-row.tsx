import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useTheme, type Theme } from '@/theme';

/**
 * §8.3 — **delete lives at the bottom of Edit, both times**, so both Edit
 * surfaces end in the same row: the iOS Contacts pattern, reachable in Edit mode
 * and never on a read path. One component so the two can't drift apart in weight
 * or colour — the affordance's *sameness* is what teaches where delete lives.
 *
 * It is a filled `dangerSurface` block with centered `danger` text, so a delete
 * reads as dangerous — and tuned — in both themes, and the two Edit surfaces get
 * the identical weighted affordance.
 */
export function DeleteRow({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: theme.dangerSurface,
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 22,
      paddingVertical: 16,
    },
    label: {
      color: theme.danger,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
