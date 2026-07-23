import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

/**
 * §7.3 — the contextual nav-bar `+`. Lives in the header rather than as a FAB so
 * it never competes with a tab's primary action; the owning tab decides what it
 * opens — the add-item wizard on Wardrobe (§5), the outfit builder on Outfits
 * (§6). The label and testID are per-tab so each `+` still reads as its own
 * action to assistive tech.
 */
export function AddItemButton({
  onPress,
  accessibilityLabel = 'Add item',
  testID = 'add-item-button',
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={styles.button}
      testID={testID}
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
