import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAddItemDraft } from '@/components/add-item-draft';

/**
 * Step 5 — Saved (§5.1). Confirms the write, then offers the two exits: **Add
 * another** clears the draft and returns to the source step for a second item,
 * and **Done** dismisses the wizard back to the wardrobe, where the new tile is
 * already live (the grid query is reactive, §2).
 */
export default function SavedStep() {
  const router = useRouter();
  const { reset } = useAddItemDraft();

  function addAnother() {
    reset();
    router.replace('/add-item');
  }

  function done() {
    reset();
    router.dismissAll();
  }

  return (
    <View style={styles.screen} testID="saved-step">
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.title}>Added to your wardrobe</Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={addAnother}
          style={[styles.button, styles.secondary]}
          testID="saved-add-another"
        >
          <Text style={styles.secondaryLabel}>Add another</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={done}
          style={[styles.button, styles.primary]}
          testID="saved-done"
        >
          <Text style={styles.primaryLabel}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  checkmark: {
    color: '#3a2a6d',
    fontSize: 56,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 16,
  },
  primary: {
    backgroundColor: '#3a2a6d',
  },
  secondary: {
    backgroundColor: '#eceaf2',
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: '#2a2440',
    fontSize: 17,
    fontWeight: '600',
  },
});
