import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  occasions,
  onCommit,
  onCancel,
}: {
  initialName: string;
  occasions: string[];
  onCommit: (name: string, occasion: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [occasion, setOccasion] = useState('');

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel} visible>
      <Pressable style={styles.backdrop} onPress={onCancel} testID="review-backdrop" />
      <View style={styles.sheet} testID="outfit-review-sheet">
        <Text style={styles.heading}>Save outfit</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          placeholder="Optional"
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

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 10,
    padding: 20,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f5f4f8',
    borderRadius: 10,
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
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#3a2a6d',
  },
  chipLabel: {
    color: '#2a2440',
    fontSize: 15,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: '#ffffff',
  },
  commit: {
    alignItems: 'center',
    backgroundColor: '#3a2a6d',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 16,
  },
  commitLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
