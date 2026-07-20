import { Pressable, StyleSheet, Text } from 'react-native';

import { insertDevItem } from '@/db/dev-seed';
import { CATEGORIES } from '@/db/schema';

/**
 * ⚠️ THROWAWAY. Nothing can add an item until the photo-library ticket lands,
 * so this is the only way to see the populated grid — and to confirm the grid
 * is reactive, since the row appears with no manual refresh. **Delete this
 * component, `db/dev-seed.ts` and its call site with that ticket.**
 *
 * Never renders in a release build.
 */
export function DevSeedButton() {
  if (!__DEV__) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => insertDevItem(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)])}
      style={styles.button}
      testID="dev-seed-button"
    >
      <Text style={styles.label}>dev: add item</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
    bottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    right: 16,
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
