import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * §8.5 wear logging — the only thing a user does daily, so **"Wore this today"**
 * is the big primary action and **"Other day"** is the quiet secondary that
 * opens a calendar for past-date backfill. One tap, one `wear_event`.
 */
export function WearLogger({
  onToday,
  onOtherDay,
}: {
  onToday: () => void;
  onOtherDay: () => void;
}) {
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 16,
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondary: {
    alignItems: 'center',
    backgroundColor: '#eceaf2',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryLabel: {
    color: '#3a2a6d',
    fontSize: 15,
    fontWeight: '600',
  },
});
