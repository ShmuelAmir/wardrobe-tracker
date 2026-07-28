import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WardrobeChip } from '@/wardrobe-view';

/**
 * §9.6 — the arrived-at indicator: **one removable chip per active param**, each
 * clearing **independently**. That independence is the decision, not a detail —
 * a single "Clear all" can't express "drop the category but keep the most-worn
 * sort", which is a thing you genuinely want to do after tapping "See all" from
 * a filtered leaderboard.
 *
 * The chips are the only filter surface on the Wardrobe in v1: they *report* and
 * *undo* state the screen was navigated into, and offer no way to set it.
 */
export function WardrobeChips({
  chips,
  onClear,
}: {
  chips: WardrobeChip[];
  onClear: (chip: WardrobeChip) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <View style={styles.row} testID="wardrobe-chips">
      {chips.map((chip) => (
        <View key={chip.key} style={styles.chip} testID={`wardrobe-chip-${chip.key}`}>
          <Text style={styles.label}>{chip.label}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${chip.label}`}
            hitSlop={12}
            onPress={() => onClear(chip)}
            testID={`wardrobe-chip-clear-${chip.key}`}
          >
            <Ionicons name="close" size={15} color="#3a2a6d" />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingLeft: 13,
    paddingRight: 10,
    paddingVertical: 7,
  },
  label: {
    color: '#3a2a6d',
    fontSize: 13,
    fontWeight: '600',
  },
});
