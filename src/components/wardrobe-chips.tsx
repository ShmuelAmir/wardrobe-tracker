import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { radii, spacing, useTheme, type Theme } from '@/theme';
import type { WardrobeChip } from '@/wardrobe-view';

/**
 * §9.6 — the arrived-at indicator: one removable chip per active param. Each
 * chip arrives carrying the params that drop only itself (`@/wardrobe-view`
 * spells out why that independence is the decision), so this renders and reports
 * the tap; it decides nothing.
 *
 * These chips are the only filter surface on the Wardrobe in v1: they *report*
 * and *undo* state the screen was navigated into, and offer no way to set it.
 */
export function WardrobeChips({
  chips,
  onClear,
}: {
  chips: WardrobeChip[];
  onClear: (chip: WardrobeChip) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (chips.length === 0) return null;

  return (
    <View style={styles.row} testID="wardrobe-chips">
      {chips.map((chip) => (
        <View key={chip.key} style={styles.chip} testID={`wardrobe-chip-${chip.key}`}>
          <Text variant="caption" style={styles.label}>
            {chip.label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${chip.label}`}
            hitSlop={12}
            onPress={() => onClear(chip)}
            testID={`wardrobe-chip-clear-${chip.key}`}
          >
            <Ionicons name="close" size={15} color={theme.accent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    chip: {
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: 7,
      paddingLeft: 13,
      paddingRight: 10,
      paddingVertical: 7,
    },
    label: {
      color: theme.accent,
      fontWeight: '600',
    },
  });
}
