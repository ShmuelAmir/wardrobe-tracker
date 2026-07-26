import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * §8.3 — **delete lives at the bottom of Edit, both times**, so both Edit
 * surfaces end in the same row: the iOS Contacts pattern, reachable in Edit mode
 * and never on a read path. One component so the two can't drift apart in weight
 * or colour — the affordance's *sameness* is what teaches where delete lives.
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
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 16,
  },
  label: {
    color: '#c0392b',
    fontSize: 17,
    fontWeight: '600',
  },
});
