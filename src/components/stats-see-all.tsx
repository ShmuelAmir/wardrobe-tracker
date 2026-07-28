import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * §9.2 — "See all →", the one entry point into the Wardrobe's filtered state
 * (§9.6). It means *more rows of the same question*, so it belongs only where a
 * leaderboard was actually shown: never at `k = 0` (there is no ranking to
 * expand) and never on never-worn, which is already a finite set shown in full
 * (§9.3).
 */
export function SeeAllLink({
  onPress,
  accessibilityLabel,
  testID,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={onPress}
      testID={testID}
    >
      <Text style={styles.label}>See all →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#3a2a6d',
    fontSize: 14,
    fontWeight: '700',
  },
});
