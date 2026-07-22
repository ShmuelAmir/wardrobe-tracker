import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

/**
 * §7.3 — the contextual nav-bar `+`. Lives in the header rather than as a FAB so
 * it never competes with a tab's primary action; the owning tab decides what it
 * opens (the add-item wizard on Wardrobe).
 */
export function AddItemButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Add item"
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={styles.button}
      testID="add-item-button"
    >
      <Ionicons name="add" size={28} color="#3a2a6d" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
  },
});
