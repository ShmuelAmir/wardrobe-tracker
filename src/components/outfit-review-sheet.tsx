import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/**
 * §6.1.4 / §6.2 — the Save review sheet. Confirms **name + occasion** before the
 * outfit commits, keeping the build screen uncluttered. Occasion is single-value
 * free text: the `occasions` chips (built from history, capped at 8, §6.2) act
 * as **radio buttons** over one field — tapping one fills it, tapping the active
 * chip clears it, and typing overrides both. Outfit #1 gets `occasions === []`,
 * so it sees a **bare optional text field with no chips** (no seeding, §6.2).
 *
 * No season control anywhere here — outfits have no season (§6.3).
 */
export function OutfitReviewSheet({
  initialName,
  initialOccasion = '',
  occasions,
  onCommit,
  onCancel,
}: {
  initialName: string;
  /** The outfit's current occasion when re-saving in Edit mode (§8.5); '' when new. */
  initialOccasion?: string;
  occasions: string[];
  onCommit: (name: string, occasion: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [name, setName] = useState(initialName);
  const [occasion, setOccasion] = useState(initialOccasion);

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel} visible>
      <Pressable style={styles.backdrop} onPress={onCancel} testID="review-backdrop" />
      <View style={styles.sheet} testID="outfit-review-sheet">
        <Text style={styles.heading}>Save outfit</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          placeholder="Optional"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          style={styles.input}
          testID="review-outfit-name"
        />

        <Text style={styles.label}>Occasion</Text>
        {occasions.length > 0 ? (
          <View style={styles.chips}>
            {occasions.map((value) => {
              const active = occasion === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  // Radio behaviour: the active chip clears, any other replaces.
                  onPress={() => setOccasion(active ? '' : value)}
                  style={[styles.chip, active && styles.chipActive]}
                  testID={`occasion-chip-${value}`}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <TextInput
          placeholder="Optional — e.g. Work, Shul"
          placeholderTextColor={theme.textSecondary}
          value={occasion}
          onChangeText={setOccasion}
          style={styles.input}
          testID="review-occasion"
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => onCommit(name, occasion)}
          style={styles.commit}
          testID="review-commit"
        >
          <Text style={styles.commitLabel}>Save outfit</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.scrim,
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 10,
      padding: 20,
      paddingBottom: 32,
    },
    heading: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      opacity: 0.6,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      color: theme.textPrimary,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    chipActive: {
      backgroundColor: theme.accent,
    },
    chipLabel: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    chipLabelActive: {
      color: theme.onAccent,
    },
    commit: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      marginTop: 8,
      paddingVertical: 16,
    },
    commitLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
